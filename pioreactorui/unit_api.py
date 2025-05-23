# -*- coding: utf-8 -*-
from __future__ import annotations

import os
import zipfile
from io import BytesIO
from pathlib import Path
from subprocess import run
from time import sleep

from flask import abort
from flask import Blueprint
from flask import current_app
from flask import jsonify
from flask import request
from flask import Response
from flask import send_file
from flask.typing import ResponseReturnValue
from huey.exceptions import HueyException
from huey.exceptions import TaskException
from huey.exceptions import TaskLockedException
from msgspec import to_builtins
from msgspec.yaml import decode as yaml_decode
from pioreactor.config import get_leader_hostname
from pioreactor.structs import CalibrationBase
from pioreactor.structs import subclass_union
from pioreactor.utils import local_persistent_storage
from pioreactor.utils.timing import current_utc_timestamp
from pioreactor.utils.timing import to_datetime
from werkzeug.utils import safe_join

from . import HOSTNAME
from . import publish_to_error_log
from . import query_temp_local_metadata_db
from . import tasks
from . import VERSION
from .config import env
from .config import huey
from .utils import attach_cache_control
from .utils import create_task_response
from .utils import is_rate_limited
from .utils import is_valid_unix_filename
from pioreactorui import structs


AllCalibrations = subclass_union(CalibrationBase)

unit_api = Blueprint("unit_api", __name__, url_prefix="/unit_api")


# Endpoint to check the status of a background task. unit_api is required to ping workers (who only expose unit_api)
@unit_api.route("/task_results/<task_id>", methods=["GET"])
def task_status(task_id):
    try:
        task = huey.result(task_id)
    except TaskLockedException:
        return (
            jsonify({"status": "failed", "error": "could not complete task due to lock."}),
            500,
        )
    except TaskException as e:
        # huey wraps the exception, so lets reraise it.
        try:
            exec(f"raise {str(e)}")
        except Exception as ee:
            return (
                jsonify({"status": "failed", "error": str(ee)}),
                500,
            )

    if task is None:
        return jsonify({"status": "pending or not present"}), 202
    elif isinstance(task, Exception):
        return jsonify({"status": "failed", "error": str(task)}), 500
    else:
        return jsonify({"status": "complete", "result": task}), 200


### SYSTEM


@unit_api.route("/system/update/<target>", methods=["POST", "PATCH"])
def update_target(target) -> ResponseReturnValue:
    if target not in ("app", "ui"):  # todo: firmware
        abort(404, "Invalid target")

    body = current_app.get_json(request.data, type=structs.ArgsOptionsEnvs)

    commands: tuple[str, ...] = tuple()
    commands += tuple(body.args)
    for option, value in body.options.items():
        commands += (f"--{option.replace('_', '-')}",)
        if value is not None:
            commands += (str(value),)

    if target == "app":
        task = tasks.pio_update_app(*commands)
    elif target == "ui":
        task = tasks.pio_update_ui(*commands)
    else:
        raise ValueError()

    return create_task_response(task)


@unit_api.route("/system/update", methods=["POST", "PATCH"])
def update_app_and_ui() -> ResponseReturnValue:
    body = current_app.get_json(request.data, type=structs.ArgsOptionsEnvs)

    commands: tuple[str, ...] = tuple()
    commands += tuple(body.args)
    for option, value in body.options.items():
        commands += (f"--{option.replace('_', '-')}",)
        if value is not None:
            commands += (str(value),)

    task = tasks.pio_update(*commands)
    return create_task_response(task)


@unit_api.route("/system/reboot", methods=["POST", "PATCH"])
def reboot() -> ResponseReturnValue:
    """Reboots unit"""
    # TODO: only let requests from the leader do this. Use lighttpd conf for this.

    # don't reboot the leader right away, give time for any other posts/gets to occur.
    if HOSTNAME == get_leader_hostname():
        sleep(5)
    task = tasks.reboot()
    return create_task_response(task)


@unit_api.route("/system/shutdown", methods=["POST", "PATCH"])
def shutdown() -> ResponseReturnValue:
    """Shutdown unit"""
    task = tasks.shutdown()
    return create_task_response(task)


@unit_api.route("/system/remove_file", methods=["POST", "PATCH"])
def remove_file() -> ResponseReturnValue:
    # use filepath in body
    body = request.get_json()

    if not body["filepath"].startswith("/home/pioreactor") or not body["filepath"].startswith(
        "/tmp"
    ):
        raise FileNotFoundError()

    task = tasks.rm(body["filepath"])
    return create_task_response(task)


# GET clock time
@unit_api.route("/system/utc_clock", methods=["GET"])
def get_clock_time():
    try:
        current_time = current_utc_timestamp()
        return jsonify({"status": "success", "clock_time": current_time}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# PATCH / POST to set clock time
@unit_api.route("/system/utc_clock", methods=["PATCH", "POST"])
def set_clock_time():
    # send UTC time in ISO 8601 format
    try:
        if HOSTNAME == get_leader_hostname() and request.json:
            data = request.json
            new_time = data.get("utc_clock_time")
            if not new_time:
                return (
                    jsonify({"status": "error", "message": "utc_clock_time field is required"}),
                    400,
                )

            # validate the timestamp
            try:
                to_datetime(new_time)
            except ValueError:
                return (
                    jsonify(
                        {
                            "status": "error",
                            "message": "Invalid utc_clock_time format. Use ISO 8601.",
                        }
                    ),
                    400,
                )

            # Update the system clock (requires admin privileges)
            t = tasks.update_clock(new_time)
            return create_task_response(t)
        else:
            # sync using chrony
            t = tasks.sync_clock()
            return create_task_response(t)

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


#### DIR
@unit_api.route("/system/path/", defaults={"req_path": ""})
@unit_api.route("/system/path/<path:req_path>")
def dir_listing(req_path: str):
    if os.path.isfile(Path(env["DOT_PIOREACTOR"]) / "DISALLOW_UI_FILE_SYSTEM"):
        abort(403, "DISALLOW_UI_FILE_SYSTEM is present")

    BASE_DIR = env["DOT_PIOREACTOR"]

    # Safely join to prevent directory traversal
    safe_path = safe_join(BASE_DIR, req_path)
    if not safe_path:
        abort(403, "Invalid path.")

    # Check if the path actually exists
    if not os.path.exists(safe_path):
        abort(404, "Path not found.")

    # If it's a file, serve the file
    if os.path.isfile(safe_path):
        if safe_path.endswith((".sqlite", ".sqlite.backup", ".sqlite-shm", ".sqlite-wal")):
            abort(403, "Access to downloading sqlite files is restricted.")

        return send_file(safe_path, mimetype="text/plain")

    # Joining the base and the requested path
    abs_path = os.path.join(BASE_DIR, req_path)

    # Return 404 if path doesn't exist
    if not os.path.exists(abs_path):
        abort(404, "Path not found.")

    # Check if path is a file and serve
    if os.path.isfile(abs_path):
        return send_file(abs_path)

    # Show directory contents
    current, dirs, files = next(os.walk(abs_path))

    return attach_cache_control(
        jsonify(
            {
                "current": current,
                "dirs": sorted([d for d in dirs if not d == "__pycache__"]),
                "files": sorted(files),
            }
        )
    )


## RUNNING JOBS CONTROL


@unit_api.route("/jobs/run/job_name/<job>", methods=["PATCH", "POST"])
def run_job(job: str) -> ResponseReturnValue:
    """
    Body should look like (all optional)
    {
      "options": {
        "option1": "value1",
        "option2": "value2"
      },
      "env": {
        "EXPERIMENT": "test",
        "JOB_SOURCE": "user",
      }
      "args": ["arg1", "arg2"]
    }
    Ex:

    curl -X POST http://worker.local/unit_api/jobs/run/job_name/stirring -H "Content-Type: application/json" -d '{
      "options": {},
      "args": []
    }'
    """
    if is_rate_limited(job):
        return jsonify({"error": "Too many requests, please try again later."}), 429

    body = current_app.get_json(request.data, type=structs.ArgsOptionsEnvs)
    args = body.args
    options = body.options
    env = body.env

    commands: tuple[str, ...] = (job,)
    commands += tuple(args)
    for option, value in options.items():
        commands += (f"--{option.replace('_', '-')}",)
        if value is not None:
            commands += (str(value),)

    task = tasks.pio_run(*commands, env=env)
    return create_task_response(task)


@unit_api.route("/jobs/stop/all", methods=["PATCH", "POST"])
def stop_all_jobs() -> ResponseReturnValue:
    task = tasks.pio_kill("--all-jobs")
    return create_task_response(task)


@unit_api.route("/jobs/stop", methods=["PATCH", "POST"])
def stop_jobs() -> ResponseReturnValue:
    job_name = request.args.get("job_name")
    experiment = request.args.get("experiment")
    job_source = request.args.get("job_source")
    job_id = request.args.get("job_id")  # note job_id is typically an int, so you might convert it.

    if not any([job_name, experiment, job_source, job_id]):
        return abort(400, "No job filter specified")

    kill_args = []
    if job_name:
        kill_args.extend(["--job-name", job_name])
    if experiment:
        kill_args.extend(["--experiment", experiment])
    if job_source:
        kill_args.extend(["--job-source", job_source])
    if job_id:
        kill_args.extend(["--job-id", job_id])

    task = tasks.pio_kill(*kill_args)
    return create_task_response(task)


@unit_api.route("/jobs/stop/job_name/<job_name>", methods=["PATCH", "POST"])
def stop_job_by_name(job_name: str) -> ResponseReturnValue:
    # deprecated, use /jobs/stop?job_name=<job_name>
    task = tasks.pio_kill("--job-name", job_name)
    return create_task_response(task)


@unit_api.route("/jobs/stop/experiment/<experiment>", methods=["PATCH", "POST"])
def stop_all_jobs_by_experiment(experiment: str) -> ResponseReturnValue:
    # deprecated, use /jobs/stop?experiment=<experiment>
    task = tasks.pio_kill("--experiment", experiment)
    return create_task_response(task)


@unit_api.route("/jobs/stop/job_source/<job_source>", methods=["PATCH", "POST"])
def stop_all_jobs_by_source(job_source: str) -> ResponseReturnValue:
    # deprecated
    task = tasks.pio_kill("--job-source", job_source)
    return create_task_response(task)


@unit_api.route("/jobs/stop/job_id/<job_id>", methods=["PATCH", "POST"])
def stop_all_jobs_by_id(job_id: int) -> ResponseReturnValue:
    # deprecated

    task = tasks.pio_kill("--job-id", job_id)
    return create_task_response(task)


@unit_api.route("/jobs/running/experiments/<experiment>", methods=["GET"])
def get_running_jobs_for_experiment(experiment: str) -> ResponseReturnValue:
    jobs = query_temp_local_metadata_db(
        """SELECT * FROM pio_job_metadata where is_running=1 and experiment = (?)""",
        (experiment,),
    )

    return jsonify(jobs)


@unit_api.route("/jobs/running", methods=["GET"])
def get_all_running_jobs() -> ResponseReturnValue:
    jobs = query_temp_local_metadata_db("SELECT * FROM pio_job_metadata where is_running=1")

    return jsonify(jobs)


@unit_api.route("/jobs/running/<job>", methods=["GET"])
def get_running_job(job) -> ResponseReturnValue:
    jobs = query_temp_local_metadata_db(
        "SELECT * FROM pio_job_metadata where is_running=1 and job_name=?", (job,)
    )

    return jsonify(jobs)


@unit_api.route("/long_running_jobs/running", methods=["GET"])
def get_all_long_running_jobs() -> ResponseReturnValue:
    jobs = query_temp_local_metadata_db(
        "SELECT * FROM pio_job_metadata where is_running=1 and is_long_running_job=1"
    )
    return jsonify(jobs)


### SETTINGS


@unit_api.route("/jobs/settings/job_name/<job_name>", methods=["GET"])
def get_settings_for_a_specific_job(job_name) -> ResponseReturnValue:
    """
    {
      "settings": {
        <setting1>: <value1>,
        <setting2>: <value2>
      }
    }
    """
    settings = query_temp_local_metadata_db(
        """
    SELECT s.setting, s.value FROM
        pio_job_published_settings s
        JOIN pio_job_metadata m
            on m.job_id = s.job_id
        WHERE m.is_running=1 AND m.job_name=(?);
    """,
        (job_name,),
    )
    assert isinstance(settings, list)
    if settings:
        return jsonify({"settings": {s["setting"]: s["value"] for s in settings}})
    else:
        return {"status": "error"}, 404


@unit_api.route("/jobs/settings/job_name/<job_name>/setting/<setting>", methods=["GET"])
def get_specific_setting_for_a_job(job_name, setting) -> ResponseReturnValue:
    setting = query_temp_local_metadata_db(
        """
    SELECT s.setting, s.value FROM
        pio_job_published_settings s
        JOIN pio_job_metadata m
            on m.job_id = s.job_id
        WHERE m.is_running=1 AND m.job_name=(?) AND setting = (?)
    """,
        (job_name, setting),
        one=True,
    )
    if setting:
        return jsonify({setting["setting"]: setting["value"]})
    else:
        return {"status": "error"}, 404


@unit_api.route("/jobs/settings/job_name/<job_name>", methods=["PATCH"])
def update_job(job_name: str) -> ResponseReturnValue:
    """
    The body should look like:

    {
      "settings": {
        <setting1>: <value1>,
        <setting2>: <value2>
      },
    }
    """
    # body = request.get_json()
    abort(503, "Not implemented.")


### PLUGINS


@unit_api.route("/plugins/installed", methods=["GET"])
def get_installed_plugins() -> ResponseReturnValue:
    result = tasks.pio_plugins_list("plugins", "list", "--json")
    try:
        status, msg = result(blocking=True, timeout=10)
    except HueyException:
        status, msg = False, "Timed out."

    if not status:
        return jsonify([])
    else:
        # sometimes an error from a plugin will be printed. We just want to last line, the json bit.
        _, _, plugins_as_json = msg.rpartition("\n")
        return attach_cache_control(
            Response(
                response=plugins_as_json,
                status=200,
                mimetype="text/json",
            )
        )


@unit_api.route("/plugins/installed/<filename>", methods=["GET"])
def get_plugin(filename: str) -> ResponseReturnValue:
    """get a specific Python file in the .pioreactor/plugin folder"""
    # security bit: strip out any paths that may be attached, ex: ../../../root/bad
    file = Path(filename).name

    try:
        if Path(file).suffix != ".py":
            raise IOError("must provide a .py file")

        specific_plugin_path = Path(env["DOT_PIOREACTOR"]) / "plugins" / file
        return attach_cache_control(
            Response(
                response=specific_plugin_path.read_text(),
                status=200,
                mimetype="text/plain",
            )
        )
    except IOError:
        abort(404, "must provide a .py file")
    except Exception:
        abort(500, "server error")


@unit_api.route("/plugins/install", methods=["POST", "PATCH"])
def install_plugin() -> ResponseReturnValue:
    """
    runs `pio plugin install ....`
    Body should look like:
    {
      "options": {
        "option1": "value1",
        "option2": "value2"
      },
      "args": ["arg1", "arg2"]
    }

    Ex:
    {
      "options": {
        "source": "pathtofile",
      },
      "args": ["my_plugin_name"]
    }

    """

    # there is a security problem here. See https://github.com/Pioreactor/pioreactor/issues/421
    if os.path.isfile(Path(env["DOT_PIOREACTOR"]) / "DISALLOW_UI_INSTALLS"):
        abort(403, "DISALLOW_UI_INSTALLS is present")

    body = current_app.get_json(request.data, type=structs.ArgsOptionsEnvs)

    commands: tuple[str, ...] = ("install",)
    commands += tuple(body.args)
    for option, value in body.options.items():
        commands += (f"--{option.replace('_', '-')}",)
        if value is not None:
            commands += (str(value),)

    task = tasks.pio_plugins(*commands)
    return create_task_response(task)


@unit_api.route("/plugins/uninstall", methods=["POST", "PATCH"])
def uninstall_plugin() -> ResponseReturnValue:
    """
    Body should look like:
    {
      "options": {
        "option1": "value1",
        "option2": "value2"
      },
      "args": ["arg1", "arg2"]
    }
    """
    body = current_app.get_json(request.data, type=structs.ArgsOptionsEnvs)

    commands: tuple[str, ...] = ("uninstall",)
    commands += tuple(body.args)
    for option, value in body.options.items():
        commands += (f"--{option.replace('_', '-')}",)
        if value is not None:
            commands += (str(value),)

    task = tasks.pio_plugins(*commands)
    return create_task_response(task)


### VERSIONS


@unit_api.route("/versions/app", methods=["GET"])
def get_app_version() -> ResponseReturnValue:
    result = run(
        ["python", "-c", "import pioreactor; print(pioreactor.__version__)"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        abort(500, "server error")
    return attach_cache_control(jsonify({"version": result.stdout.strip()}), max_age=30)


@unit_api.route("/versions/ui", methods=["GET"])
def get_ui_version() -> ResponseReturnValue:
    return attach_cache_control(jsonify({"version": VERSION}), max_age=30)


### CALIBRATIONS


@unit_api.route("/calibrations/<device>", methods=["POST"])
def create_calibration(device) -> ResponseReturnValue:
    """
    Create a new calibration for the specified device.
    """
    # calibration_dir = Path(env["DOT_PIOREACTOR"]) / "storage" / "calibrations" / device
    # if folder does not exist, users should make it with mkdir -p ... && chown -R pioreactor:www-data ...

    try:
        raw_yaml = request.get_json()["calibration_data"]
        calibration_data = yaml_decode(raw_yaml, type=AllCalibrations)
        calibration_name = calibration_data.calibration_name

        if not calibration_name or not is_valid_unix_filename(calibration_name):
            abort(400, description="Missing or invalid 'calibration_name'.")
        elif not device or not is_valid_unix_filename(device):
            abort(400, description="Missing or invalid 'device'.")

        path = calibration_data.path_on_disk_for_device(device)
        tasks.save_file(path, raw_yaml)

        # Respond with success and the created calibration details
        return jsonify({"msg": "Calibration created successfully.", "path": str(path)}), 201

    except Exception as e:
        publish_to_error_log(f"Error creating calibration: {e}", "create_calibration")
        abort(500, description="Failed to create calibration.")


@unit_api.route("/calibrations/<device>/<calibration_name>", methods=["DELETE"])
def delete_calibration(device: str, calibration_name: str) -> ResponseReturnValue:
    """
    Delete a specific calibration for a given device.
    """
    calibration_path = (
        Path(env["DOT_PIOREACTOR"])
        / "storage"
        / "calibrations"
        / device
        / f"{calibration_name}.yaml"
    )

    if not calibration_path.exists():
        abort(404, description=f"Calibration '{calibration_name}' not found for device '{device}'.")

    try:
        # Remove the calibration file
        calibration_path.unlink()

        # If the deleted calibration was active, remove its active status
        with local_persistent_storage("active_calibrations") as cache:
            if cache.get(device) == calibration_name:
                cache.pop(device)

        return (
            jsonify(
                {
                    "msg": f"Calibration '{calibration_name}' for device '{device}' deleted successfully."
                }
            ),
            200,
        )

    except Exception as e:
        publish_to_error_log(f"Error deleting calibration: {e}", "delete_calibration")
        abort(500, description="Failed to delete calibration.")


@unit_api.route("/calibrations", methods=["GET"])
def get_all_calibrations() -> ResponseReturnValue:
    calibration_dir = Path(env["DOT_PIOREACTOR"]) / "storage" / "calibrations"

    if not calibration_dir.exists():
        abort(404, "Calibration directory does not exist.")

    all_calibrations: dict[str, list] = {}

    with local_persistent_storage("active_calibrations") as cache:
        for file in sorted(calibration_dir.glob("*/*.yaml")):
            try:
                device = file.parent.name
                cal = to_builtins(yaml_decode(file.read_bytes(), type=AllCalibrations))
                cal["is_active"] = cache.get(device) == cal["calibration_name"]
                cal["pioreactor_unit"] = HOSTNAME
                if device in all_calibrations:
                    all_calibrations[device].append(cal)
                else:
                    all_calibrations[device] = [cal]
            except Exception as e:
                publish_to_error_log(f"Error reading {file.stem}: {e}", "get_all_calibrations")

    return attach_cache_control(jsonify(all_calibrations), max_age=10)


@unit_api.route("/active_calibrations", methods=["GET"])
def get_all_active_calibrations() -> ResponseReturnValue:
    calibration_dir = Path(env["DOT_PIOREACTOR"]) / "storage" / "calibrations"

    if not calibration_dir.exists():
        abort(404, "Calibration directory does not exist.")

    all_calibrations: dict[str, dict] = {}

    with local_persistent_storage("active_calibrations") as cache:
        for device in cache.iterkeys():
            cal_name = cache[device]
            cal_file_path = calibration_dir / device / f"{cal_name}.yaml"
            try:
                cal = to_builtins(yaml_decode(cal_file_path.read_bytes(), type=AllCalibrations))
                cal["is_active"] = True
                cal["pioreactor_unit"] = HOSTNAME
                all_calibrations[device] = cal
            except Exception as e:
                publish_to_error_log(
                    f"Error reading {cal_file_path.stem}: {e}", "get_all_active_calibrations"
                )

    return attach_cache_control(jsonify(all_calibrations), max_age=10)


@unit_api.route("/zipped_calibrations", methods=["GET"])
def get_all_calibrations_as_zipped_yaml() -> ResponseReturnValue:
    calibration_dir = Path(env["DOT_PIOREACTOR"]) / "storage" / "calibrations"

    if not calibration_dir.exists():
        abort(404, "Calibration directory does not exist.")

    buffer = BytesIO()

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for file_path in sorted(calibration_dir.rglob("*.yaml")):
            if file_path.is_file():
                arc_name = file_path.relative_to(calibration_dir)
                zip_file.write(str(file_path), arcname=str(arc_name))

    # Move the cursor to the beginning of the buffer
    buffer.seek(0)

    # Return the file using send_file
    return send_file(
        buffer,
        as_attachment=True,
        download_name=f"{HOSTNAME}_calibrations.zip",  # Name shown to the user
        mimetype="application/zip",
    )


@unit_api.route("/calibrations/<device>", methods=["GET"])
def get_calibrations_by_device(device) -> ResponseReturnValue:
    calibration_dir = Path(env["DOT_PIOREACTOR"]) / "storage" / "calibrations" / device

    if not calibration_dir.exists():
        abort(404, "Calibration directory does not exist.")

    calibrations: list[dict] = []

    with local_persistent_storage("active_calibrations") as c:
        for file in sorted(calibration_dir.glob("*.yaml")):
            try:
                # first try to open it using our struct, but only to verify it.
                cal = to_builtins(yaml_decode(file.read_bytes(), type=AllCalibrations))
                cal["is_active"] = c.get(device) == cal["calibration_name"]
                calibrations.append(cal)
            except Exception as e:
                publish_to_error_log(
                    f"Error reading {file.stem}: {e}", "get_calibrations_by_device"
                )

    return attach_cache_control(jsonify(calibrations), max_age=10)


@unit_api.route("/calibrations/<device>/<cal_name>", methods=["GET"])
def get_calibration(device, cal_name) -> ResponseReturnValue:
    calibration_path = (
        Path(env["DOT_PIOREACTOR"]) / "storage" / "calibrations" / device / f"{cal_name}.yaml"
    )

    if not calibration_path.exists():
        abort(404, "Calibration file does not exist.")

    with local_persistent_storage("active_calibrations") as c:
        try:
            cal = to_builtins(yaml_decode(calibration_path.read_bytes(), type=AllCalibrations))
            cal["is_active"] = c.get(device) == cal["calibration_name"]
            return attach_cache_control(jsonify(cal), max_age=10)
        except Exception as e:
            publish_to_error_log(f"Error reading {calibration_path.stem}: {e}", "get_calibration")
            abort(500, "Failed to read calibration file.")


@unit_api.route("/active_calibrations/<device>/<cal_name>", methods=["PATCH"])
def set_active_calibration(device, cal_name) -> ResponseReturnValue:
    with local_persistent_storage("active_calibrations") as c:
        c[device] = cal_name

    return {"status": "success"}, 200


@unit_api.route("/active_calibrations/<device>", methods=["DELETE"])
def remove_active_status_calibration(device) -> ResponseReturnValue:
    with local_persistent_storage("active_calibrations") as c:
        if device in c:
            c.pop(device)

    return {"status": "success"}, 200


@unit_api.errorhandler(404)
def not_found(e):
    # Return JSON for API requests
    return jsonify({"error": "Not Found"}), 404
