# -*- coding: utf-8 -*-
from __future__ import annotations

import os
from pathlib import Path
from subprocess import run
from time import sleep

from flask import abort
from flask import Blueprint
from flask import current_app
from flask import jsonify
from flask import request
from flask import Response
from flask.typing import ResponseReturnValue
from huey.exceptions import HueyException
from huey.exceptions import TaskException
from msgspec.yaml import decode as yaml_decode
from pioreactor.calibrations import CALIBRATION_PATH
from pioreactor.config import get_leader_hostname
from pioreactor.utils import local_persistant_storage
from pioreactor.utils.timing import current_utc_timestamp
from pioreactor.utils.timing import to_datetime

from . import HOSTNAME
from . import query_temp_local_metadata_db
from . import tasks
from . import VERSION
from .config import cache
from .config import env
from .config import huey
from .utils import create_task_response
from pioreactorui import structs


unit_api = Blueprint("unit_api", __name__, url_prefix="/unit_api")


# Endpoint to check the status of a background task. unit_api is required to ping workers (who only expose unit_api)
@unit_api.route("/task_results/<task_id>", methods=["GET"])
def task_status(task_id):
    try:
        task = huey.result(task_id)
    except TaskException:
        return (
            jsonify(
                {"status": "failed", "error": "task was prevented from completing due to a lock."}
            ),
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
        abort(404)

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
    try:
        if HOSTNAME == get_leader_hostname() and request.json:
            data = request.json
            new_time = data.get("utc_clock_time")
            if not new_time:
                return (
                    jsonify({"status": "error", "message": "utc_clock_time field is required"}),
                    400,
                )

            # Convert and validate the timestamp
            try:
                datetime_obj = to_datetime(new_time)
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
            run(["sudo", "date", "-s", datetime_obj.strftime("%Y-%m-%d %H:%M:%S")], check=True)
            return jsonify({"status": "success", "message": "Clock time successfully updated"}), 200
        else:
            # sync using chrony
            run(["sudo", "chronyc", "-a", "makestep"], check=True)
            return jsonify({"status": "success", "message": "Clock time successfully synced"}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


## RUNNING JOBS CONTROL


def is_rate_limited(job: str, expire_time_seconds=1.0) -> bool:
    """
    Check if the user has made a request within the debounce duration.
    """
    if cache.get(f"debounce:{job}") is None:
        cache.set(f"debounce:{job}", b"dummy-key", expire=expire_time_seconds)
        return False
    else:
        return True


@unit_api.route("/jobs/run/job_name/<job>", methods=["PATCH", "POST"])
def run_job(job: str) -> ResponseReturnValue:
    # DONT USE YET
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


@unit_api.route("/jobs/stop/job_name/<job_name>", methods=["PATCH", "POST"])
def stop_job_by_name(job_name: str) -> ResponseReturnValue:
    task = tasks.pio_kill("--job-name", job_name)
    return create_task_response(task)


@unit_api.route("/jobs/stop/experiment/<experiment>", methods=["PATCH", "POST"])
def stop_all_jobs_by_experiment(experiment: str) -> ResponseReturnValue:
    task = tasks.pio_kill("--experiment", experiment)
    return create_task_response(task)


@unit_api.route("/jobs/stop/job_source/<job_source>", methods=["PATCH", "POST"])
def stop_all_jobs_by_source(job_source: str) -> ResponseReturnValue:
    task = tasks.pio_kill("--job-source", job_source)
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
            on m.id = s.job_id
        WHERE m.is_running=1 AND m.job_name=(?);
    """,
        (job_name,),
    )
    assert isinstance(settings, list)
    if settings:
        return jsonify({"settings": {s["setting"]: s["value"] for s in settings}})
    else:
        return Response(status=404)


@unit_api.route("/jobs/settings/job_name/<job_name>/setting/<setting>", methods=["GET"])
def get_specific_setting_for_a_job(job_name, setting) -> ResponseReturnValue:
    setting = query_temp_local_metadata_db(
        """
    SELECT s.setting, s.value FROM
        pio_job_published_settings s
        JOIN pio_job_metadata m
            on m.id = s.job_id
        WHERE m.is_running=1 AND m.job_name=(?) AND setting = (?)
    """,
        (job_name, setting),
        one=True,
    )
    if setting:
        return jsonify({setting["setting"]: setting["value"]})
    else:
        return Response(status=404)


@unit_api.route("/jobs/settings/job_name/<job_name>", methods=["PATCH"])
def update_job(job: str) -> ResponseReturnValue:
    # DONT USE YET
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
    return Response(status=503)


### PLUGINS


@unit_api.route("/plugins/installed", methods=["GET"])
def get_installed_plugins() -> ResponseReturnValue:
    result = tasks.pio_plugins_list("plugins", "list", "--json")
    try:
        status, msg = result(blocking=True, timeout=120)
    except HueyException:
        status, msg = False, "Timed out."

    if not status:
        return jsonify([])
    else:
        # sometimes an error from a plugin will be printed. We just want to last line, the json bit.
        _, _, plugins_as_json = msg.rpartition("\n")
        return plugins_as_json


@unit_api.route("/plugins/installed/<filename>", methods=["GET"])
def get_plugin(filename: str) -> ResponseReturnValue:
    """get a specific Python file in the .pioreactor/plugin folder"""
    # security bit: strip out any paths that may be attached, ex: ../../../root/bad
    file = Path(filename).name

    try:
        if Path(file).suffix != ".py":
            raise IOError("must provide a .py file")

        specific_plugin_path = Path(env["DOT_PIOREACTOR"]) / "plugins" / file
        return Response(
            response=specific_plugin_path.read_text(),
            status=200,
            mimetype="text/plain",
        )
    except IOError:
        return Response(status=404)
    except Exception:
        return Response(status=500)


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
        return Response(status=403)

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
        return Response(status=500)
    return Response(
        response=current_app.json.dumps({"version": result.stdout.strip()}),
        status=200,
        mimetype="text/json",
        headers={"Cache-Control": "public,max-age=60"},
    )


@unit_api.route("/versions/ui", methods=["GET"])
def get_ui_version() -> ResponseReturnValue:
    return Response(
        response=current_app.json.dumps({"version": VERSION}),
        status=200,
        mimetype="text/json",
        headers={"Cache-Control": "public,max-age=60"},
    )


### CALIBRATIONS


@unit_api.route("/calibrations", methods=["GET"])
def get_all_calibrations() -> ResponseReturnValue:
    calibration_dir = Path(f"{env['DOT_PIOREACTOR']}/storage/calibrations")

    if not calibration_dir.exists():
        return Response(status=404)

    all_calibrations: dict[str, list] = {}

    with local_persistant_storage("active_calibrations") as cache:
        for file in calibration_dir.glob("*/*.yaml"):
            try:
                cal = yaml_decode(file.read_bytes())
                cal_type = cal["calibration_type"]
                cal["is_active"] = cache.get(cal_type) == cal["calibration_name"]
                if cal_type in all_calibrations:
                    all_calibrations[cal_type].append(cal)
                else:
                    all_calibrations[cal_type] = [cal]
            except Exception as e:
                print(f"Error reading {file.stem}: {e}")

    return jsonify(all_calibrations)


@unit_api.route("/calibrations/<cal_type>", methods=["GET"])
def get_calibrations(cal_type) -> ResponseReturnValue:
    calibration_dir = Path(f"{env['DOT_PIOREACTOR']}/storage/calibrations/{cal_type}")

    if not calibration_dir.exists():
        return Response(status=404)

    calibrations: list[dict] = []

    with local_persistant_storage("active_calibrations") as c:
        for file in calibration_dir.glob("*.yaml"):
            try:
                cal = yaml_decode(file.read_bytes())
                cal["is_active"] = c.get(cal_type) == cal["calibration_name"]
                calibrations.append(cal)
            except Exception as e:
                print(f"Error reading {file.stem}: {e}")

    return jsonify(calibrations)


@unit_api.route("/calibrations/<cal_type>/<cal_name>/active", methods=["PATCH"])
def set_active_calibration(cal_type, cal_name) -> ResponseReturnValue:
    with local_persistant_storage("active_calibrations") as c:
        c[cal_type] = cal_name

    return Response(status=200)


@unit_api.route("/calibrations/<cal_type>/active", methods=["DELETE"])
def remove_active_status_calibration(cal_type) -> ResponseReturnValue:
    with local_persistant_storage("active_calibrations") as c:
        c.pop(cal_type)

    return Response(status=200)


@unit_api.route("/calibrations/<cal_type>/<cal_name>", methods=["DELETE"])
def remove_calibration(cal_type, cal_name) -> ResponseReturnValue:
    target_file = CALIBRATION_PATH / cal_type / f"{cal_name}.yaml"
    if not target_file.exists():
        return Response(status=404)

    target_file.unlink()

    return Response(status=200)


@unit_api.errorhandler(404)
def not_found(e):
    # Return JSON for API requests
    return jsonify({"error": "Not Found"}), 404
