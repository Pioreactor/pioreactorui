# -*- coding: utf-8 -*-
from __future__ import annotations

import configparser
import os
import re
import sqlite3
import subprocess
import tempfile
from datetime import datetime
from datetime import timezone
from pathlib import Path

from flask import g
from flask import jsonify
from flask import request
from flask import Response
from flask.typing import ResponseReturnValue
from huey.exceptions import HueyException
from msgspec import DecodeError
from msgspec import ValidationError
from msgspec.json import decode as json_decode
from msgspec.json import encode as json_encode
from msgspec.yaml import decode as yaml_decode
from werkzeug.utils import secure_filename

import structs
import tasks as background_tasks
from app import app
from app import client
from app import HOSTNAME
from app import modify_db
from app import publish_to_error_log
from app import publish_to_experiment_log
from app import publish_to_log
from app import query_db
from app import VERSION
from config import cache
from config import env
from config import is_testing_env


def scrub_to_valid(value: str) -> str:
    if value is None:
        raise ValueError()
    elif value.startswith("sqlite_"):
        raise ValueError()
    return "".join(chr for chr in value if (chr.isalnum() or chr == "_"))


def current_utc_datetime() -> datetime:
    # this is timezone aware.
    return datetime.now(timezone.utc)


def to_iso_format(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


def current_utc_timestamp() -> str:
    # this is timezone aware.
    return to_iso_format(current_utc_datetime())


def is_valid_unix_filename(filename: str) -> bool:
    return (
        bool(re.fullmatch(r"[a-zA-Z0-9._-]+", filename))
        and "/" not in filename
        and "\0" not in filename
    )


## PIOREACTOR CONTROL


@app.route("/api/experiments/<experiment>/workers/stop", methods=["POST"])
def stop_all_in_experiment(experiment: str) -> ResponseReturnValue:
    """Kills all jobs for workers assigned to experiment"""
    workers = query_db(
        "SELECT pioreactor_unit FROM experiment_worker_assignments WHERE experiment = ?",
        (experiment,),
    )
    assert isinstance(workers, list)

    units = sum([("--units", w["pioreactor_unit"]) for w in workers], ())
    background_tasks.pios("kill", "--all-jobs", *units)

    # also kill any jobs running on leader (this unit) that are associated to the experiment (like a profile)
    background_tasks.pio("kill", "--experiment", experiment)

    return Response(status=202)


@app.route("/api/workers/<pioreactor_unit>/experiments/<experiment>/stop", methods=["POST"])
def stop_all_jobs_on_worker(pioreactor_unit: str, experiment: str) -> ResponseReturnValue:
    """Kills all jobs for worker assigned to experiment"""

    background_tasks.pios("kill", "--units", pioreactor_unit, "--experiment", experiment)

    return Response(status=202)


@app.route(
    "/api/workers/<pioreactor_unit>/experiments/<experiment>/jobs/<job>/stop", methods=["PATCH"]
)
def stop_job_on_unit(pioreactor_unit: str, experiment: str, job: str) -> ResponseReturnValue:
    """Kills specified job on unit"""

    msg = client.publish(
        f"pioreactor/{pioreactor_unit}/{experiment}/{job}/$state/set", b"disconnected", qos=1
    )
    try:
        msg.wait_for_publish(timeout=2.0)
    except Exception:
        background_tasks.pios("kill", "--name", job, "--units", pioreactor_unit)
        return Response(status=500)

    return Response(status=202)


@app.route(
    "/api/workers/<pioreactor_unit>/experiments/<experiment>/jobs/<job>/run",
    methods=["PATCH", "POST"],
)
def run_job_on_unit(pioreactor_unit: str, experiment: str, job: str) -> ResponseReturnValue:
    """
    Runs specified job on unit.

    The body is passed to the CLI, and should look like:

    {
      "options": {
        "option1": "value1",
        "option2": "value2"
      },
      "args": ["arg1", "arg2"]
    }
    """
    try:
        client.publish(
            f"pioreactor/{pioreactor_unit}/{experiment}/run/{job}",
            request.get_data() or r'{"options": {}, "args": []}',
            qos=2,  # why 2? it's a bad idea to fire this multiple times, but we do want to fire it.
        )
    except Exception as e:
        publish_to_error_log(e, "run_job_on_unit")
        return Response(status=500)

    return Response(status=202)


@app.route(
    "/api/workers/<pioreactor_unit>/experiments/<experiment>/jobs/<job>/update", methods=["PATCH"]
)
def update_job_on_unit(pioreactor_unit: str, experiment: str, job: str) -> ResponseReturnValue:
    """
    Update specified job on unit. Use $broadcast for everyone.

    The body is passed to the CLI, and should look like:

    {
      "settings": {
        <setting1>: <value1>,
        <setting2>: <value2>
      },
    }

    Example
    ----------

    ```
     curl -X PATCH "http://localhost:4999/api/workers/pio01/experiments/Exp001/jobs/stirring/update" \
     -H "Content-Type: application/json" \
     -d '{
           "settings": {
             "target_rpm": "200"
           }
         }'
    ```


    """
    try:
        for setting, value in request.get_json()["settings"].items():
            client.publish(
                f"pioreactor/{pioreactor_unit}/{experiment}/{job}/{setting}/set",
                value,
                qos=2,
            )
    except Exception as e:
        publish_to_error_log(e, "update_job_on_unit")
        return Response(status=400)

    return Response(status=202)


@app.route("/api/units/<pioreactor_unit>/reboot", methods=["POST"])
def reboot_unit(pioreactor_unit: str) -> ResponseReturnValue:
    """Reboots unit"""
    background_tasks.pios("reboot", "--units", pioreactor_unit)
    return Response(status=202)


@app.route("/api/units/<pioreactor_unit>/shutdown", methods=["POST"])
def shutdown_unit(pioreactor_unit: str) -> ResponseReturnValue:
    """Shutdown unit"""
    background_tasks.pios("shutdown", "--units", pioreactor_unit)
    return Response(status=202)


## Logs


@app.route("/api/experiments/<experiment>/logs", methods=["GET"])
def get_logs(experiment: str) -> ResponseReturnValue:
    """Shows event logs from all units"""

    def get_level_string(min_level: str) -> str:
        levels = {
            "DEBUG": ["ERROR", "WARNING", "NOTICE", "INFO", "DEBUG"],
            "INFO": ["ERROR", "NOTICE", "INFO", "WARNING"],
            "WARNING": ["ERROR", "WARNING"],
            "ERROR": ["ERROR"],
        }

        selected_levels = levels.get(min_level, levels["INFO"])
        return " or ".join(f'level == "{level}"' for level in selected_levels)

    min_level = request.args.get("min_level", "INFO")

    try:
        recent_logs = query_db(
            f"""SELECT l.timestamp, level, l.pioreactor_unit, message, task
                FROM logs AS l
                WHERE (l.experiment=? OR l.experiment='$experiment')
                    AND ({get_level_string(min_level)})
                    AND l.timestamp >= MAX( strftime('%Y-%m-%dT%H:%M:%S', datetime('now', '-24 hours')), (SELECT created_at FROM experiments where experiment=?) )
                ORDER BY l.timestamp DESC LIMIT 50;""",
            (experiment, experiment),
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_logs")
        return Response(status=500)

    return jsonify(recent_logs)


@app.route("/api/workers/<pioreactor_unit>/experiments/<experiment>/logs", methods=["GET"])
def get_logs_for_unit_and_experiment(experiment: str, pioreactor_unit: str) -> ResponseReturnValue:
    """Shows event logs for a specific worker within an experiment"""

    def get_level_string(min_level: str) -> str:
        levels = {
            "DEBUG": ["ERROR", "WARNING", "NOTICE", "INFO", "DEBUG"],
            "INFO": ["ERROR", "NOTICE", "INFO", "WARNING"],
            "WARNING": ["ERROR", "WARNING"],
            "ERROR": ["ERROR"],
        }
        selected_levels = levels.get(min_level, levels["INFO"])
        return " or ".join(f'level == "{level}"' for level in selected_levels)

    min_level = request.args.get("min_level", "INFO")

    try:
        recent_logs = query_db(
            f"""SELECT l.timestamp, level, l.pioreactor_unit, message, task
                FROM logs AS l
                WHERE (l.experiment=? OR l.experiment='$experiment')
                    AND l.pioreactor_unit=?
                    AND ({get_level_string(min_level)})
                    AND l.timestamp >= MAX( strftime('%Y-%m-%dT%H:%M:%S', datetime('now', '-24 hours')), (SELECT created_at FROM experiments where experiment=?) )
                ORDER BY l.timestamp DESC LIMIT 50;""",
            (experiment, pioreactor_unit, experiment),
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_logs_for_unit_and_experiment")
        return Response(status=500)

    return jsonify(recent_logs)


## Time series data


@app.route("/api/experiments/<experiment>/time_series/growth_rates", methods=["GET"])
def get_growth_rates(experiment: str) -> ResponseReturnValue:
    """Gets growth rates for all units"""
    args = request.args
    filter_mod_n = float(args.get("filter_mod_N", 100.0))
    lookback = float(args.get("lookback", 4.0))

    try:
        growth_rates = query_db(
            """
            SELECT
                json_object('series', json_group_array(unit), 'data', json_group_array(json(data))) as result
            FROM (
                SELECT pioreactor_unit as unit,
                       json_group_array(json_object('x', timestamp, 'y', round(rate, 5))) as data
                FROM growth_rates
                WHERE experiment=? AND
                      ((ROWID * 0.61803398875) - cast(ROWID * 0.61803398875 as int) < 1.0/?) AND
                      timestamp > strftime('%Y-%m-%dT%H:%M:%S', datetime('now',?))
                GROUP BY 1
                );
            """,
            (experiment, filter_mod_n, f"-{lookback} hours"),
            one=True,
        )
        assert isinstance(growth_rates, dict)

    except Exception as e:
        publish_to_error_log(str(e), "get_growth_rates")
        return Response(status=400)

    return growth_rates["result"]


@app.route("/api/experiments/<experiment>/time_series/temperature_readings", methods=["GET"])
def get_temperature_readings(experiment: str) -> ResponseReturnValue:
    """Gets temperature readings for all units"""
    args = request.args
    filter_mod_n = float(args.get("filter_mod_N", 100.0))
    lookback = float(args.get("lookback", 4.0))

    try:
        temperature_readings = query_db(
            """
            SELECT json_object('series', json_group_array(unit), 'data', json_group_array(json(data))) as result
            FROM (
                SELECT
                    pioreactor_unit as unit,
                    json_group_array(json_object('x', timestamp, 'y', round(temperature_c, 2))) as data
                FROM temperature_readings
                WHERE experiment=? AND
                    ((ROWID * 0.61803398875) - cast(ROWID * 0.61803398875 as int) < 1.0/?) AND
                    timestamp > strftime('%Y-%m-%dT%H:%M:%S', datetime('now',?))
                GROUP BY 1
                );
            """,
            (experiment, filter_mod_n, f"-{lookback} hours"),
            one=True,
        )
        assert isinstance(temperature_readings, dict)

    except Exception as e:
        publish_to_error_log(str(e), "get_temperature_readings")
        return Response(status=400)

    return temperature_readings["result"]


@app.route("/api/experiments/<experiment>/time_series/od_readings_filtered", methods=["GET"])
def get_od_readings_filtered(experiment: str) -> ResponseReturnValue:
    """Gets normalized od for all units"""
    args = request.args
    filter_mod_n = float(args.get("filter_mod_N", 100.0))
    lookback = float(args.get("lookback", 4.0))

    try:
        filtered_od_readings = query_db(
            """
            SELECT
                json_object('series', json_group_array(unit), 'data', json_group_array(json(data))) as result
            FROM (
                SELECT
                    pioreactor_unit as unit,
                    json_group_array(json_object('x', timestamp, 'y', round(normalized_od_reading, 7))) as data
                FROM od_readings_filtered
                WHERE experiment=? AND
                    ((ROWID * 0.61803398875) - cast(ROWID * 0.61803398875 as int) < 1.0/?) AND
                    timestamp > strftime('%Y-%m-%dT%H:%M:%S', datetime('now',?))
                GROUP BY 1
                );
            """,
            (experiment, filter_mod_n, f"-{lookback} hours"),
            one=True,
        )
        assert isinstance(filtered_od_readings, dict)

    except Exception as e:
        publish_to_error_log(str(e), "get_od_readings_filtered")
        return Response(status=400)

    return filtered_od_readings["result"]


@app.route("/api/experiments/<experiment>/time_series/od_readings", methods=["GET"])
def get_od_readings(experiment: str) -> ResponseReturnValue:
    """Gets raw od for all units"""
    args = request.args
    filter_mod_n = float(args.get("filter_mod_N", 100.0))
    lookback = float(args.get("lookback", 4.0))

    try:
        raw_od_readings = query_db(
            """
            SELECT
                json_object('series', json_group_array(unit), 'data', json_group_array(json(data))) as result
            FROM (
                SELECT pioreactor_unit || '-' || channel as unit, json_group_array(json_object('x', timestamp, 'y', round(od_reading, 7))) as data
                FROM od_readings
                WHERE experiment=? AND
                    ((ROWID * 0.61803398875) - cast(ROWID * 0.61803398875 as int) < 1.0/?) AND
                    timestamp > strftime('%Y-%m-%dT%H:%M:%S', datetime('now', ?))
                GROUP BY 1
                );
            """,
            (experiment, filter_mod_n, f"-{lookback} hours"),
            one=True,
        )
        assert isinstance(raw_od_readings, dict)

    except Exception as e:
        publish_to_error_log(str(e), "get_od_readings")
        return Response(status=400)

    return raw_od_readings["result"]


@app.route("/api/experiments/<experiment>/time_series/<data_source>/<column>", methods=["GET"])
def get_fallback_time_series(data_source: str, experiment: str, column: str) -> ResponseReturnValue:
    args = request.args
    try:
        lookback = float(args.get("lookback", 4.0))
        data_source = scrub_to_valid(data_source)
        column = scrub_to_valid(column)
        r = query_db(
            f"SELECT json_object('series', json_group_array(unit), 'data', json_group_array(json(data))) as result FROM (SELECT pioreactor_unit as unit, json_group_array(json_object('x', timestamp, 'y', round({column}, 7))) as data FROM {data_source} WHERE experiment=? AND timestamp > strftime('%Y-%m-%dT%H:%M:%S', datetime('now',?)) and {column} IS NOT NULL GROUP BY 1);",
            (experiment, f"-{lookback} hours"),
            one=True,
        )
        assert isinstance(r, dict)

    except Exception as e:
        publish_to_error_log(str(e), "get_fallback_time_series")
        return Response(status=400)
    return r["result"]


@app.route("/api/experiments/<experiment>/media_rates", methods=["GET"])
def get_media_rates(experiment: str) -> ResponseReturnValue:
    """
    Shows amount of added media per unit. Note that it only consider values from a dosing automation (i.e. not manual dosing, which includes continously dose)

    """
    ## this one confusing

    try:
        rows = query_db(
            """
            SELECT
                d.pioreactor_unit,
                SUM(CASE WHEN event='add_media' THEN volume_change_ml ELSE 0 END) / 3 AS mediaRate,
                SUM(CASE WHEN event='add_alt_media' THEN volume_change_ml ELSE 0 END) / 3 AS altMediaRate
            FROM dosing_events AS d
            WHERE
                datetime(d.timestamp) >= datetime('now', '-3 hours') AND
                event IN ('add_alt_media', 'add_media') AND
                source_of_event LIKE 'dosing_automation%' AND
                experiment = ?
            GROUP BY d.pioreactor_unit;
            """,
            (experiment,),
        )
        assert isinstance(rows, list)
        json_result: dict[str, dict[str, float]] = {}
        aggregate: dict[str, float] = {"altMediaRate": 0.0, "mediaRate": 0.0}

        for row in rows:
            json_result[row["pioreactor_unit"]] = {
                "altMediaRate": float(row["altMediaRate"]),
                "mediaRate": float(row["mediaRate"]),
            }
            aggregate["mediaRate"] = aggregate["mediaRate"] + float(row["mediaRate"])
            aggregate["altMediaRate"] = aggregate["altMediaRate"] + float(row["altMediaRate"])

        json_result["all"] = aggregate
        return jsonify(json_result)

    except Exception as e:
        publish_to_error_log(str(e), "get_media_rates")
        return Response(status=500)


## CALIBRATIONS


@app.route("/api/calibrations/<pioreactor_unit>", methods=["GET"])
def get_available_calibrations_type_by_unit(pioreactor_unit: str) -> ResponseReturnValue:
    """
    {
        "types": [
            "temperature",
            "pH",
            "dissolved_oxygen",
            "conductivity"
        ]
    }
    """
    try:
        types = query_db(
            "SELECT DISTINCT type FROM calibrations WHERE pioreactor_unit=?",
            (pioreactor_unit),
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_available_calibrations_type_by_unit")
        return Response(status=500)

    return jsonify(types)


@app.route("/api/calibrations/<pioreactor_unit>/<calibration_type>", methods=["GET"])
def get_available_calibrations_of_type(
    pioreactor_unit: str, calibration_type: str
) -> ResponseReturnValue:
    try:
        unit_calibration = query_db(
            "SELECT * FROM calibrations WHERE type=? AND pioreactor_unit=?",
            (calibration_type, pioreactor_unit),
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_available_calibrations_of_type")
        return Response(status=500)

    return jsonify(unit_calibration)


@app.route("/api/calibrations/<pioreactor_unit>/<calibration_type>/current", methods=["GET"])
def get_current_calibrations_of_type(
    pioreactor_unit: str, calibration_type: str
) -> ResponseReturnValue:
    """
    retrieve the current calibration for type
    """
    try:
        r = query_db(
            "SELECT * FROM calibrations WHERE type=? AND pioreactor_unit=? AND is_current=1",
            (calibration_type, pioreactor_unit),
            one=True,
        )

        if r is not None:
            assert isinstance(r, dict)
            r["data"] = json_decode(r["data"])
            return jsonify(r)
        else:
            return Response(status=404)

    except Exception as e:
        publish_to_error_log(str(e), "get_current_calibrations_of_type")
        return Response(status=500)


@app.route(
    "/api/calibrations/<pioreactor_unit>/<calibration_type>/<calibration_name>", methods=["GET"]
)
def get_calibration_by_name(
    pioreactor_unit: str, calibration_type: str, calibration_name: str
) -> ResponseReturnValue:
    """
    retrieve the calibration for type with name
    """
    try:
        r = query_db(
            "SELECT * FROM calibrations WHERE type=? AND pioreactor_unit=? AND name=?",
            (calibration_type, pioreactor_unit, calibration_name),
            one=True,
        )
        if r is not None:
            assert isinstance(r, dict)
            r["data"] = json_decode(r["data"])
            return jsonify(r)
        else:
            return Response(status=404)
    except Exception as e:
        publish_to_error_log(str(e), "get_calibration_by_name")
        return Response(status=500)


@app.route(
    "/api/calibrations/<pioreactor_unit>/<calibration_type>/<calibration_name>", methods=["PATCH"]
)
def patch_calibrations(
    pioreactor_unit: str, calibration_type: str, calibration_name: str
) -> ResponseReturnValue:
    body = request.get_json()

    if "current" in body and body["current"] == 1:
        try:
            # does the new one exist in the database?
            existing_row = query_db(
                "SELECT * FROM calibrations WHERE pioreactor_unit=(?) AND type=(?) AND name=(?)",
                (pioreactor_unit, calibration_type, calibration_name),
                one=True,
            )
            if existing_row is None:
                publish_to_error_log(
                    f"calibration {calibration_name=}, {pioreactor_unit=}, {calibration_type=} doesn't exist in database.",
                    "patch_calibrations",
                )
                return Response(status=404)

            elif existing_row["is_current"] == 1:  # type: ignore
                # already current
                return Response(status=200)

            modify_db(
                "UPDATE calibrations SET is_current=0, set_to_current_at=NULL WHERE pioreactor_unit=(?) AND type=(?) AND is_current=1",
                (pioreactor_unit, calibration_type),
            )

            modify_db(
                "UPDATE calibrations SET is_current=1, set_to_current_at=CURRENT_TIMESTAMP WHERE pioreactor_unit=(?) AND type=(?) AND name=(?)",
                (pioreactor_unit, calibration_type, calibration_name),
            )
            return Response(status=200)

        except Exception as e:
            publish_to_error_log(str(e), "patch_calibrations")
            return Response(status=500)

    else:
        return Response(status=404)


@app.route("/api/calibrations", methods=["PUT"])
def create_or_update_new_calibrations() -> ResponseReturnValue:
    try:
        body = request.get_json()

        modify_db(
            "INSERT OR REPLACE INTO calibrations (pioreactor_unit, created_at, type, data, name, is_current, set_to_current_at) values (?, ?, ?, ?, ?, ?, ?)",
            (
                body["pioreactor_unit"],
                body["created_at"],
                body["type"],
                json_encode(
                    body
                ).decode(),  # keep it as a string, not bytes, probably equivalent to request.get_data(as_text=True)
                body["name"],
                0,
                None,
            ),
        )

        return Response(status=201)
    except KeyError as e:
        publish_to_error_log(str(e), "create_or_update_new_calibrations")
        return Response(status=400)
    except Exception as e:
        publish_to_error_log(str(e), "create_or_update_new_calibrations")
        return Response(status=500)


## PLUGINS


@app.route("/api/plugins/installed", methods=["GET"])
@cache.memoize(expire=15, tag="plugins")
def get_installed_plugins() -> ResponseReturnValue:
    result = background_tasks.pio("plugins", "list", "--json")
    try:
        status, msg = result(blocking=True, timeout=120)
    except HueyException:
        status, msg = False, "Timed out."

    if not status:
        publish_to_error_log(msg, "installed_plugins")
        return jsonify([])
    else:
        # sometimes an error from a plugin will be printed. We just want to last line, the json bit.
        _, _, plugins_as_json = msg.rpartition("\n")
        return plugins_as_json


@app.route("/api/plugins/installed/<filename>", methods=["GET"])
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
    except IOError as e:
        publish_to_error_log(str(e), "get_plugin")
        return Response(status=404)
    except Exception as e:
        publish_to_error_log(str(e), "get_plugin")
        return Response(status=500)


@app.route("/api/allow_ui_installs", methods=["GET"])
@cache.memoize(expire=10_000)
def able_to_install_plugins_from_ui() -> ResponseReturnValue:
    if os.path.isfile(Path(env["DOT_PIOREACTOR"]) / "DISALLOW_UI_INSTALLS"):
        return "false"
    else:
        return "true"


@app.route("/api/plugins/install", methods=["POST"])
def install_plugin() -> ResponseReturnValue:
    # there is a security problem here. See https://github.com/Pioreactor/pioreactor/issues/421
    if os.path.isfile(Path(env["DOT_PIOREACTOR"]) / "DISALLOW_UI_INSTALLS"):
        return Response(status=403)

    body = request.get_json()
    plugin_name = body["plugin_name"]

    background_tasks.pios_install_plugin(plugin_name)
    return Response(status=202)


@app.route("/api/plugins/uninstall", methods=["POST"])
def uninstall_plugin() -> ResponseReturnValue:
    body = request.get_json()
    background_tasks.pios_uninstall_plugin(body["plugin_name"])
    return Response(status=202)


## MISC


## UPLOADS


@app.route("/api/upload", methods=["POST"])
def upload() -> ResponseReturnValue:
    if os.path.isfile(Path(env["DOT_PIOREACTOR"]) / "DISALLOW_UI_UPLOADS"):
        return Response(status=403)

    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files["file"]

    # If the user does not select a file, the browser submits an
    # empty file without a filename.
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400
    if file.content_length >= 30_000_000:  # 30mb?
        return jsonify({"error": "Too large"}), 400

    if file:
        filename = secure_filename(file.filename)
        save_path = os.path.join(tempfile.gettempdir(), filename)
        file.save(save_path)
        return jsonify({"message": "File successfully uploaded", "save_path": save_path}), 200


@app.route("/api/contrib/automations/<automation_type>", methods=["GET"])
def get_automation_contrib(automation_type: str) -> ResponseReturnValue:
    # security to prevent possibly reading arbitrary file
    if automation_type not in {"temperature", "dosing", "led"}:
        return Response(status=400)

    try:
        automation_path_default = Path(env["WWW"]) / "contrib" / "automations" / automation_type
        automation_path_plugins = (
            Path(env["DOT_PIOREACTOR"])
            / "plugins"
            / "ui"
            / "contrib"
            / "automations"
            / automation_type
        )
        files = sorted(automation_path_default.glob("*.y*ml")) + sorted(
            automation_path_plugins.glob("*.y*ml")
        )

        # we dedup based on 'automation_name'.
        parsed_yaml = {}
        for file in files:
            try:
                decoded_yaml = yaml_decode(file.read_bytes(), type=structs.AutomationDescriptor)
                parsed_yaml[decoded_yaml.automation_name] = decoded_yaml
            except (ValidationError, DecodeError) as e:
                publish_to_error_log(
                    f"Yaml error in {Path(file).name}: {e}", "get_automation_contrib"
                )

        return Response(
            response=json_encode(list(parsed_yaml.values())),
            status=200,
            mimetype="application/json",
            headers={"Cache-Control": "public,max-age=10"},
        )
    except Exception as e:
        publish_to_error_log(str(e), "get_automation_contrib")
        return Response(status=400)


@app.route("/api/contrib/jobs", methods=["GET"])
def get_job_contrib() -> ResponseReturnValue:
    try:
        job_path_default = Path(env["WWW"]) / "contrib" / "jobs"
        job_path_plugins = Path(env["DOT_PIOREACTOR"]) / "plugins" / "ui" / "contrib" / "jobs"
        files = sorted(job_path_default.glob("*.y*ml")) + sorted(job_path_plugins.glob("*.y*ml"))

        # we dedup based on 'job_name'.
        parsed_yaml = {}

        for file in files:
            try:
                decoded_yaml = yaml_decode(file.read_bytes(), type=structs.BackgroundJobDescriptor)
                parsed_yaml[decoded_yaml.job_name] = decoded_yaml
            except (ValidationError, DecodeError) as e:
                publish_to_error_log(f"Yaml error in {Path(file).name}: {e}", "get_job_contrib")

        return Response(
            response=json_encode(list(parsed_yaml.values())),
            status=200,
            mimetype="application/json",
            headers={"Cache-Control": "public,max-age=10"},
        )
    except Exception as e:
        publish_to_error_log(str(e), "get_job_contrib")
        return Response(status=400)


@app.route("/api/contrib/charts", methods=["GET"])
def get_charts_contrib() -> ResponseReturnValue:
    try:
        chart_path_default = Path(env["WWW"]) / "contrib" / "charts"
        chart_path_plugins = Path(env["DOT_PIOREACTOR"]) / "plugins" / "ui" / "contrib" / "charts"
        files = sorted(chart_path_default.glob("*.y*ml")) + sorted(
            chart_path_plugins.glob("*.y*ml")
        )

        # we dedup based on chart 'chart_key'.
        parsed_yaml = {}
        for file in files:
            try:
                decoded_yaml = yaml_decode(file.read_bytes(), type=structs.ChartDescriptor)
                parsed_yaml[decoded_yaml.chart_key] = decoded_yaml
            except (ValidationError, DecodeError) as e:
                publish_to_error_log(f"Yaml error in {Path(file).name}: {e}", "get_charts_contrib")

        return Response(
            response=json_encode(list(parsed_yaml.values())),
            status=200,
            mimetype="application/json",
            headers={"Cache-Control": "public,max-age=10"},
        )
    except Exception as e:
        publish_to_error_log(str(e), "get_charts_contrib")
        return Response(status=400)


@app.route("/api/update_app", methods=["POST"])
def update_app() -> ResponseReturnValue:
    background_tasks.update_app()
    return Response(status=202)


@app.route("/api/update_app_to_develop", methods=["POST"])
def update_app_to_develop() -> ResponseReturnValue:
    background_tasks.update_app_to_develop()
    return Response(status=202)


@app.route("/api/update_app_from_release_archive", methods=["POST"])
def update_app_from_release_archive() -> ResponseReturnValue:
    body = request.get_json()
    release_archive_location = body["release_archive_location"]
    assert release_archive_location.endswith(".zip")
    background_tasks.update_app_from_release_archive(release_archive_location)
    return Response(status=202)


@app.route("/api/versions/app", methods=["GET"])
def get_app_version() -> ResponseReturnValue:
    result = subprocess.run(
        ["python", "-c", "import pioreactor; print(pioreactor.__version__)"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        publish_to_error_log(result.stdout, "get_app_version")
        publish_to_error_log(result.stderr, "get_app_version")
        return Response(status=500)
    return Response(
        response=result.stdout.strip(),
        status=200,
        mimetype="text/plain",
        headers={"Cache-Control": "public,max-age=60"},
    )


@app.route("/api/versions/ui", methods=["GET"])
def get_ui_version() -> ResponseReturnValue:
    return VERSION


@app.route("/api/cluster_time", methods=["GET"])
def get_custer_time() -> ResponseReturnValue:
    result = background_tasks.get_time()
    timestamp = result(blocking=True, timeout=5)
    return Response(
        response=timestamp,
        status=200,
        mimetype="text/plain",
    )


@app.route("/api/cluster_time", methods=["POST"])
def set_cluster_time() -> ResponseReturnValue:
    # body = request.get_json()

    # timestamp = body["timestamp"]
    # not implemented
    return 500


@app.route("/api/export_datasets", methods=["POST"])
def export_datasets() -> ResponseReturnValue:
    body = request.get_json()

    cmd_tables: list[str] = sum(
        [
            ["--tables", table_name]
            for (table_name, exporting) in body["datasetCheckbox"].items()
            if exporting
        ],
        [],
    )
    experiment_name = body["experimentSelection"]

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    if experiment_name == "<All experiments>":
        experiment_options = []
        filename = f"export_{timestamp}.zip"
    else:
        experiment_options = ["--experiment", experiment_name]

        _experiment_name = experiment_name
        chars = "\\`*_{}[]()>#+-.!$"
        for c in chars:
            _experiment_name = _experiment_name.replace(c, "_")

        filename = f"export_{_experiment_name}_{timestamp}.zip"

    filename_with_path = Path("/var/www/pioreactorui/static/exports") / filename
    result = background_tasks.pio(
        "run",
        "export_experiment_data",
        "--output",
        filename_with_path.as_posix(),
        *cmd_tables,
        *experiment_options,
    )
    try:
        status, msg = result(blocking=True, timeout=5 * 60)
    except HueyException:
        status, msg = False, "Timed out on export."
        publish_to_error_log(msg, "export_datasets")
        return {"result": status, "filename": None, "msg": msg}, 500

    if not status:
        publish_to_error_log(msg, "export_datasets")
        return {"result": status, "filename": None, "msg": msg}, 500

    return {"result": status, "filename": filename, "msg": msg}, 200


@app.route("/api/experiments", methods=["GET"])
@cache.memoize(expire=60, tag="experiments")
def get_experiments() -> ResponseReturnValue:
    try:
        response = jsonify(
            query_db(
                """SELECT experiment, created_at, description, round( (strftime("%s","now") - strftime("%s", created_at))/60/60, 0) as delta_hours
                FROM experiments
                ORDER BY created_at
                DESC;"""
            )
        )
        return response

    except Exception as e:
        publish_to_error_log(str(e), "get_experiments")
        return Response(status=500)


@app.route("/api/experiments", methods=["POST"])
def create_experiment() -> ResponseReturnValue:
    cache.evict("experiments")
    cache.evict("unit_labels")

    body = request.get_json()
    proposed_experiment_name = body["experiment"]

    if not proposed_experiment_name:
        return Response(status=404)
    elif proposed_experiment_name.lower() == "current":  # too much API rework
        return Response(status=404)
    elif proposed_experiment_name.startswith("_testing_"):  # jobs won't run as expected
        return Response(status=404)
    elif (
        ("#" in proposed_experiment_name)
        or ("+" in proposed_experiment_name)
        or ("/" in proposed_experiment_name)
        or ("\\" in proposed_experiment_name)
    ):
        return Response(status=404)

    try:
        row_count = modify_db(
            "INSERT INTO experiments (created_at, experiment, description, media_used, organism_used) VALUES (?,?,?,?,?)",
            (
                current_utc_timestamp(),
                body["experiment"],
                body.get("description"),
                body.get("mediaUsed"),
                body.get("organismUsed"),
            ),
        )

        if row_count == 0:
            raise sqlite3.IntegrityError()

        publish_to_log(
            f"New experiment created: {body['experiment']}", "create_experiment", level="INFO"
        )
        return Response(status=201)

    except sqlite3.IntegrityError:
        return Response(status=409)
    except Exception as e:
        publish_to_error_log(str(e), "create_experiment")
        return Response(status=500)


@app.route("/api/experiments/<experiment>", methods=["DELETE"])
def delete_experiment(experiment: str) -> ResponseReturnValue:
    cache.evict("experiments")
    row_count = modify_db("DELETE FROM experiments WHERE experiment=?;", (experiment,))
    background_tasks.pios("kill", "--experiment", experiment)
    if row_count > 0:
        return Response(status=204)
    else:
        return Response(status=404)
    pass


@app.route("/api/experiments/latest", methods=["GET"])
@cache.memoize(expire=30, tag="experiments")
def get_latest_experiment() -> ResponseReturnValue:
    try:
        return Response(
            response=json_encode(
                query_db(
                    "SELECT experiment, created_at, description, media_used, organism_used, delta_hours FROM latest_experiment",
                    one=True,
                )
            ),
            status=200,
            headers={
                "Cache-Control": "public,max-age=2"
            },  # don't make this too high, as it caches description, which changes fast.
            mimetype="application/json",
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_latest_experiment")
        return Response(status=500)


@app.route("/api/experiments/<experiment>/unit_labels", methods=["GET"])
def get_unit_labels(experiment: str) -> ResponseReturnValue:
    try:
        if experiment == "current":
            unit_labels = query_db(
                "SELECT r.pioreactor_unit as unit, r.label FROM pioreactor_unit_labels AS r JOIN latest_experiment USING (experiment);"
            )
        else:
            unit_labels = query_db(
                "SELECT r.pioreactor_unit as unit, r.label FROM pioreactor_unit_labels as r WHERE experiment=?;",
                (experiment,),
            )

        assert isinstance(unit_labels, list)

        keyed_by_unit = {d["unit"]: d["label"] for d in unit_labels}

        return Response(
            response=json_encode(keyed_by_unit),
            status=200,
            headers={"Cache-Control": "public,max-age=10"},
            mimetype="application/json",
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_unit_labels")
        return Response(status=500)


@app.route("/api/experiments/<experiment>/unit_labels", methods=["PUT"])
def upsert_unit_labels(experiment: str) -> ResponseReturnValue:
    """
    Update or insert a new unit label for the current experiment.

    This API endpoint accepts a PUT request with a JSON body containing a "unit" and a "label".
    The "unit" is the identifier for the pioreactor and the "label" is the desired label for that unit.
    If the unit label for the current experiment already exists, it will be updated; otherwise, a new entry will be created.

    The response will be a status code of 201 if the operation is successful, and 400 if there was an error.


    JSON Request Body:
    {
        "unit": "<unit_identifier>",
        "label": "<new_label>"
    }

    Example usage:
    PUT /api/experiments/demo/unit_labels
    {
        "unit": "unit1",
        "label": "new_label"
    }

    Returns:
    HTTP Response with status code 201 if successful, 400 if there was an error.

    Raises:
    Exception: Any error encountered during the database operation is published to the error log.
    """

    body = request.get_json()

    unit = body["unit"]
    label = body["label"]

    try:
        if (
            label == ""
        ):  # empty string, eg they are removing the label. We can't use the upsert below since then multiple pios are assigned "" and our unique constraint prevents that.
            modify_db(
                "DELETE FROM pioreactor_unit_labels WHERE experiment=(?) AND pioreactor_unit = (?)",
                (experiment, unit),
            )
        else:
            modify_db(
                "INSERT OR REPLACE INTO pioreactor_unit_labels (label, experiment, pioreactor_unit, created_at) VALUES ((?), (?), (?), strftime('%Y-%m-%dT%H:%M:%S', datetime('now')) ) ON CONFLICT(experiment, pioreactor_unit) DO UPDATE SET label=excluded.label, created_at=strftime('%Y-%m-%dT%H:%M:%S', datetime('now'))",
                (label, experiment, unit),
            )

    except Exception as e:
        publish_to_error_log(str(e), "upsert_current_unit_labels")
        return Response(status=400)

    return Response(status=201)


@app.route("/api/historical_organisms", methods=["GET"])
def get_historical_organisms_used() -> ResponseReturnValue:
    try:
        historical_organisms = query_db(
            'SELECT DISTINCT organism_used as key FROM experiments WHERE NOT (organism_used IS NULL OR organism_used == "") ORDER BY created_at DESC;'
        )

    except Exception as e:
        publish_to_error_log(str(e), "historical_organisms")
        return Response(status=500)

    return jsonify(historical_organisms)


@app.route("/api/historical_media", methods=["GET"])
def get_historical_media_used() -> ResponseReturnValue:
    try:
        historical_media = query_db(
            'SELECT DISTINCT media_used as key FROM experiments WHERE NOT (media_used IS NULL OR media_used == "") ORDER BY created_at DESC;'
        )

    except Exception as e:
        publish_to_error_log(str(e), "historical_media")
        return Response(status=500)

    return jsonify(historical_media)


@app.route("/api/experiments/<experiment>", methods=["PATCH"])
def update_experiment(experiment: str) -> ResponseReturnValue:
    cache.evict("experiments")

    body = request.get_json()
    try:
        if "description" in body:
            modify_db(
                "UPDATE experiments SET description = (?) WHERE experiment=(?)",
                (body["description"], experiment),
            )

        return Response(status=200)

    except Exception as e:
        publish_to_error_log(str(e), "update_experiment")
        return Response(status=500)


## CONFIG CONTROL


@app.route("/api/configs/<filename>", methods=["GET"])
@cache.memoize(expire=30, tag="config")
def get_config(filename: str) -> ResponseReturnValue:
    """get a specific config.ini file in the .pioreactor folder"""

    if filename == "config.ini" and is_testing_env():
        filename = "config.dev.ini"

    # security bit: strip out any paths that may be attached, ex: ../../../root/bad
    filename = Path(filename).name

    try:
        assert Path(filename).suffix == ".ini"
        specific_config_path = Path(env["DOT_PIOREACTOR"]) / filename

        return Response(
            response=specific_config_path.read_text(),
            status=200,
            mimetype="text/plain",
            headers={"Cache-Control": "public,max-age=6"},
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_config_of_file")
        return Response(status=400)


@app.route("/api/configs", methods=["GET"])
@cache.memoize(expire=60, tag="config")
def get_configs() -> ResponseReturnValue:
    """get a list of all config.ini files in the .pioreactor folder, _and_ are part of the inventory _or_ are leader"""

    all_workers = query_db("SELECT pioreactor_unit FROM workers;")
    assert isinstance(all_workers, list)
    workers_bucket = {worker["pioreactor_unit"] for worker in all_workers}
    leader_bucket = {HOSTNAME}
    pioreactors_bucket = workers_bucket | leader_bucket

    def strip_worker_name_from_config(file_name):
        return file_name.removeprefix("config_").removesuffix(".ini")

    def allow_file_through(file_name):
        if file_name == "config.ini":
            return True
        else:
            # return True
            return strip_worker_name_from_config(file_name) in pioreactors_bucket

    try:
        config_path = Path(env["DOT_PIOREACTOR"])
        return jsonify(
            [
                file.name
                for file in sorted(config_path.glob("config*.ini"))
                if allow_file_through(file.name)
            ]
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_configs")
        return Response(status=500)


@app.route("/api/configs/<filename>", methods=["PATCH"])
def update_config(filename: str) -> ResponseReturnValue:
    cache.evict("config")
    body = request.get_json()
    code = body["code"]

    if not filename.endswith(".ini"):
        return {"msg": "Incorrect filetype. Must be .ini."}, 400

    # security bit:
    # users could have filename look like ../../../../root/bad.txt
    # the below code will strip any paths.
    # General security risk here is ability to save arbitrary file to OS.
    filename = Path(filename).name

    # is the user editing a worker config or the global config?
    regex = re.compile(r"config_?(.*)?\.ini")
    is_unit_specific = regex.match(filename)
    assert is_unit_specific is not None

    if is_unit_specific[1] != "":
        units = is_unit_specific[1]
        flags = "--specific"
    else:
        units = "$broadcast"
        flags = "--shared"

    # General security risk here to save arbitrary file to OS.
    config_path = Path(env["DOT_PIOREACTOR"]) / filename

    # can the config actually be read? ex. no repeating sections, typos, etc.
    # filename is a string
    config = configparser.ConfigParser(allow_no_value=True)

    try:
        config.read_string(code)  # test parser

        # if editing config.ini (not a unit specific)
        # test to make sure we have minimal code to run pio commands
        if filename == "config.ini":
            assert config["cluster.topology"]
            assert config.get("cluster.topology", "leader_hostname")
            assert config.get("cluster.topology", "leader_address")

    except configparser.DuplicateSectionError as e:
        msg = f"Duplicate section [{e.section}] was found. Please fix and try again."
        publish_to_error_log(msg, "update_config")
        return {"msg": msg}, 400
    except configparser.DuplicateOptionError as e:
        msg = f"Duplicate option, `{e.option}`, was found in section [{e.section}]. Please fix and try again."
        publish_to_error_log(msg, "update_config")
        return {"msg": msg}, 400
    except configparser.ParsingError:
        msg = "Incorrect syntax. Please fix and try again."
        publish_to_error_log(msg, "update_config")
        return {"msg": msg}, 400
    except (AssertionError, configparser.NoSectionError, KeyError, TypeError):
        msg = "Missing required field(s) in [cluster.topology]: `leader_hostname` and/or `leader_address`. Please fix and try again."
        publish_to_error_log(msg, "update_config")
        return {"msg": msg}, 400
    except ValueError as e:
        msg = f"Error: {e}"
        publish_to_error_log(msg, "update_config")
        return {"msg": msg}, 400
    except Exception as e:
        publish_to_error_log(str(e), "update_config")
        msg = "Hm, something went wrong, check PioreactorUI logs."
        return {"msg": msg}, 500

    # if the config file is unit specific, we only need to run sync-config on that unit.
    result = background_tasks.write_config_and_sync(config_path, code, units, flags)

    try:
        status, msg_or_exception = result(blocking=True, timeout=75)
    except HueyException:
        status, msg_or_exception = False, "sync-configs timed out."

    if not status:
        publish_to_error_log(msg_or_exception, "save_new_config")
        return {"msg": str(msg_or_exception)}, 500

    return Response(status=202)


@app.route("/api/historical_configs/<filename>", methods=["GET"])
def get_historical_config_for(filename: str) -> ResponseReturnValue:
    try:
        configs_for_filename = query_db(
            "SELECT filename, timestamp, data FROM config_files_histories WHERE filename=? ORDER BY timestamp DESC",
            (filename,),
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_historical_config_for")
        return Response(status=400)

    return jsonify(configs_for_filename)


@app.route("/api/is_local_access_point_active", methods=["GET"])
@cache.memoize(expire=10_000)
def is_local_access_point_active() -> ResponseReturnValue:
    if os.path.isfile("/boot/firmware/local_access_point"):
        return "true"
    else:
        return "false"


### experiment profiles


@app.route("/api/contrib/experiment_profiles", methods=["POST"])
def create_experiment_profile() -> ResponseReturnValue:
    body = request.get_json()
    experiment_profile_body = body["body"]
    experiment_profile_filename = Path(body["filename"]).name

    # verify content
    try:
        yaml_decode(experiment_profile_body, type=structs.Profile)
    except Exception as e:
        msg = f"{e}"
        # publish_to_error_log(msg, "create_experiment_profile")
        return {"msg": msg}, 400

    # verify file
    try:
        assert is_valid_unix_filename(experiment_profile_filename)
        assert experiment_profile_filename.endswith(
            ".yaml"
        ) or experiment_profile_filename.endswith(".yml")
    except Exception:
        msg = "Invalid filename"
        # publish_to_error_log(msg, "create_experiment_profile")
        return {"msg": msg}, 400

    filepath = Path(env["DOT_PIOREACTOR"]) / "experiment_profiles" / experiment_profile_filename

    # check if exists
    if filepath.exists():
        return {"msg": "A profile already exists with that filename. Choose another."}, 400

    # save file to disk
    background_tasks.save_file(
        filepath,
        experiment_profile_body,
    )

    return Response(status=200)


@app.route("/api/contrib/experiment_profiles", methods=["PATCH"])
def edit_experiment_profile() -> ResponseReturnValue:
    body = request.get_json()
    experiment_profile_body = body["body"]
    experiment_profile_filename = Path(body["filename"]).name

    # verify content
    try:
        yaml_decode(experiment_profile_body, type=structs.Profile)
    except Exception as e:
        msg = f"{e}"
        # publish_to_error_log(msg, "create_experiment_profile")
        return {"msg": msg}, 400

    # verify file - user could have provided a different filename so we still check this.
    try:
        assert is_valid_unix_filename(experiment_profile_filename)
        assert experiment_profile_filename.endswith(
            ".yaml"
        ) or experiment_profile_filename.endswith(".yml")
    except Exception:
        msg = "Invalid filename"
        # publish_to_error_log(msg, "create_experiment_profile")
        return {"msg": msg}, 400

    filepath = Path(env["DOT_PIOREACTOR"]) / "experiment_profiles" / experiment_profile_filename

    # save file to disk
    background_tasks.save_file(
        filepath,
        experiment_profile_body,
    )

    return Response(status=200)


@app.route("/api/contrib/experiment_profiles", methods=["GET"])
def get_experiment_profiles() -> ResponseReturnValue:
    try:
        profile_path = Path(env["DOT_PIOREACTOR"]) / "experiment_profiles"
        files = sorted(profile_path.glob("*.y*ml"), key=os.path.getmtime, reverse=True)

        parsed_yaml = []
        for file in files:
            try:
                profile = yaml_decode(file.read_bytes(), type=structs.Profile)
                parsed_yaml.append({"experimentProfile": profile, "file": str(file)})
            except (ValidationError, DecodeError) as e:
                publish_to_error_log(
                    f"Yaml error in {Path(file).name}: {e}", "get_experiment_profiles"
                )

        return Response(
            response=json_encode(parsed_yaml),
            status=200,
            mimetype="application/json",
        )
    except Exception as e:
        publish_to_error_log(str(e), "get_experiment_profiles")
        return Response(status=400)


@app.route("/api/contrib/experiment_profiles/<filename>", methods=["GET"])
def get_experiment_profile(filename: str) -> ResponseReturnValue:
    file = Path(filename).name
    try:
        if not (Path(file).suffix == ".yaml" or Path(file).suffix == ".yml"):
            raise IOError("must provide a YAML file")

        specific_profile_path = Path(env["DOT_PIOREACTOR"]) / "experiment_profiles" / file
        return Response(
            response=specific_profile_path.read_text(),
            status=200,
            mimetype="text/plain",
        )
    except IOError as e:
        publish_to_error_log(str(e), "get_experiment_profile")
        return Response(status=404)
    except Exception as e:
        publish_to_error_log(str(e), "get_experiment_profile")
        return Response(status=500)


@app.route("/api/contrib/experiment_profiles/<filename>", methods=["DELETE"])
def delete_experiment_profile(filename: str) -> ResponseReturnValue:
    file = Path(filename).name
    try:
        if Path(file).suffix not in (".yaml", ".yml"):
            raise IOError("must provide a YAML file")

        specific_profile_path = Path(env["DOT_PIOREACTOR"]) / "experiment_profiles" / file
        background_tasks.rm(specific_profile_path)
        publish_to_log(f"Deleted profile {filename}.", "delete_experiment_profile")
        return Response(status=200)
    except IOError as e:
        publish_to_error_log(str(e), "delete_experiment_profile")
        return Response(status=404)
    except Exception as e:
        publish_to_error_log(str(e), "delete_experiment_profile")
        return Response(status=500)


##### Worker endpoints


@app.route("/api/workers", methods=["GET"])
def get_list_of_workers() -> ResponseReturnValue:
    # Get a list of all workers
    all_workers = query_db(
        "SELECT pioreactor_unit, added_at, is_active FROM workers ORDER BY pioreactor_unit;"
    )
    return jsonify(all_workers)


@app.route("/api/workers/setup", methods=["POST"])
def setup_worker_pioreactor() -> ResponseReturnValue:
    data = request.get_json()
    new_name = data["name"]
    version = data["version"]
    model = data["model"]

    try:
        result = background_tasks.add_new_pioreactor(new_name, version, model)
    except Exception as e:
        return {"msg": str(e)}, 500

    try:
        status, msg = result(blocking=True, timeout=250)
    except HueyException:
        status, msg = False, "Timed out, see logs."

    if status:
        return Response(status=202)
    else:
        publish_to_error_log(msg, "setup_worker_pioreactor")
        return {"msg": msg}, 500


@app.route("/api/workers", methods=["PUT"])
def add_worker() -> ResponseReturnValue:
    cache.evict("config")
    data = request.json
    pioreactor_unit = data.get("pioreactor_unit")

    if not pioreactor_unit:
        return Response(status=400)

    nrows = modify_db(
        "INSERT OR REPLACE INTO workers (pioreactor_unit, added_at, is_active) VALUES (?, STRFTIME('%Y-%m-%dT%H:%M:%f000Z', 'NOW'), 1);",
        (pioreactor_unit,),
    )
    if nrows > 0:
        return Response(status=201)
    else:
        return Response(status=404)


@app.route("/api/workers/<pioreactor_unit>", methods=["DELETE"])
def delete_worker(pioreactor_unit: str) -> ResponseReturnValue:
    row_count = modify_db("DELETE FROM workers WHERE pioreactor_unit=?;", (pioreactor_unit,))

    if row_count > 0:
        background_tasks.pios("kill", "--all-jobs", "--units", pioreactor_unit)

        filename = f"config_{pioreactor_unit}.ini"

        # delete config on disk
        config_path = Path(env["DOT_PIOREACTOR"]) / filename
        background_tasks.rm(config_path)

        # delete from histories
        modify_db("DELETE FROM config_files_histories WHERE filename=?;", (filename,))

        publish_to_log(
            f"Removed {pioreactor_unit} from cluster.",
            level="INFO",
            task="assignment",
        )

        return Response(status=204)
    else:
        return Response(status=404)


@app.route("/api/workers/<pioreactor_unit>/is_active", methods=["PUT"])
def change_worker_status(pioreactor_unit: str) -> ResponseReturnValue:
    # Get the new status from the request body
    data = request.json
    new_status = data.get("is_active")

    if new_status not in [0, 1]:
        return jsonify({"error": "Invalid status. Status must be integer 0 or 1."}), 400

    # Update the status of the worker in the database
    row_count = modify_db(
        "UPDATE workers SET is_active = (?) WHERE pioreactor_unit = (?)",
        (new_status, pioreactor_unit),
    )

    if row_count > 0:
        publish_to_log(
            f"Set {pioreactor_unit} to {'Active' if new_status else 'Inactive'}.",
            task="worker_status",
            level="INFO",
        )
        if new_status == 0:
            background_tasks.pios("kill", "--all-jobs", "--units", pioreactor_unit)
        return Response(status=204)
    else:
        return Response(status=404)


@app.route("/api/workers/<pioreactor_unit>", methods=["GET"])
def get_worker(pioreactor_unit: str) -> ResponseReturnValue:
    # Query the database for the status of the worker in the given experiment
    result = query_db(
        """
        SELECT pioreactor_unit, added_at, is_active
        FROM workers
        WHERE pioreactor_unit = ?""",
        (pioreactor_unit,),
        one=True,
    )

    # Check if the worker is found and assigned to the experiment
    if result:
        return jsonify(result)
    else:
        return jsonify({"error": "Worker not found"}), 404


### Experiment worker assignments


@app.route("/api/workers/assignments", methods=["GET"])
def get_workers_and_experiment_assignments() -> ResponseReturnValue:
    # Get the experiment that a worker is assigned to along with its status
    result = query_db(
        """
        SELECT w.pioreactor_unit, a.experiment
        FROM workers w
        LEFT JOIN experiment_worker_assignments a
          on w.pioreactor_unit = a.pioreactor_unit
        ORDER BY w.pioreactor_unit
        """,
    )
    if result:
        return jsonify(result)
    else:
        return jsonify([])


@app.route("/api/experiments/assignment_count", methods=["GET"])
def get_experiments_worker_assignments() -> ResponseReturnValue:
    # Get the number of pioreactors assigned to an experiment.
    result = query_db(
        """
        SELECT e.experiment, count(a.pioreactor_unit)
        FROM experiments e
        LEFT JOIN experiment_worker_assignments a
          on e.experiment = a.experiment
        GROUP BY 1
        HAVING count(a.pioreactor_unit) > 0
        """,
    )
    if result:
        return jsonify(result)
    else:
        return jsonify([])


@app.route("/api/workers/<pioreactor_unit>/experiment", methods=["GET"])
def get_experiment_assignment_for_worker(pioreactor_unit: str) -> ResponseReturnValue:
    # Get the experiment that a worker is assigned to along with its active status
    result = query_db(
        """
        SELECT w.pioreactor_unit, w.is_active, a.experiment
        FROM workers w
        LEFT JOIN experiment_worker_assignments a
          on w.pioreactor_unit = a.pioreactor_unit
        WHERE w.pioreactor_unit = ?
        """,
        (pioreactor_unit,),
        one=True,
    )
    assert isinstance(result, dict | None)
    if result is None:
        return jsonify({"error": f"Worker {pioreactor_unit} does not exist in the cluster."}), 404
    elif result["experiment"] is None:  # type: ignore
        return (
            jsonify({"error": f"Worker {pioreactor_unit} is not assigned to any experiment."}),
            404,
        )
    else:
        return jsonify(result)


@app.route("/api/experiments/<experiment>/workers", methods=["GET"])
def get_list_of_workers_for_experiment(experiment: str) -> ResponseReturnValue:
    workers = query_db(
        """
        SELECT w.pioreactor_unit, is_active
        FROM experiment_worker_assignments a
        JOIN workers w
          on w.pioreactor_unit = a.pioreactor_unit
        WHERE experiment = ?
        ORDER BY w.pioreactor_unit
        """,
        (experiment,),
    )
    return jsonify(workers)


@app.route("/api/experiments/<experiment>/workers", methods=["PUT"])
def add_worker_to_experiment(experiment: str) -> ResponseReturnValue:
    # assign
    data = request.json
    pioreactor_unit = data.get("pioreactor_unit")
    if not pioreactor_unit:
        return jsonify({"error": "Missing pioreactor_unit"}), 400

    row_counts = modify_db(
        "INSERT OR REPLACE INTO experiment_worker_assignments (pioreactor_unit, experiment, assigned_at) VALUES (?, ?, STRFTIME('%Y-%m-%dT%H:%M:%f000Z', 'NOW'))",
        (pioreactor_unit, experiment),
    )
    if row_counts > 0:
        publish_to_experiment_log(
            f"Assigned {pioreactor_unit} to {experiment}.",
            experiment=experiment,
            task="assignment",
            level="INFO",
        )

        return Response(status=204)
    else:
        # probably an integrity error
        return Response(status=404)


@app.route("/api/experiments/<experiment>/workers/<pioreactor_unit>", methods=["DELETE"])
def remove_worker_from_experiment(experiment: str, pioreactor_unit: str) -> ResponseReturnValue:
    # unassign
    modify_db(
        "DELETE FROM experiment_worker_assignments WHERE pioreactor_unit = ? AND experiment = ?",
        (pioreactor_unit, experiment),
    )
    background_tasks.pios("kill", "--experiment", experiment, "--units", pioreactor_unit)
    publish_to_experiment_log(
        f"Removed {pioreactor_unit} from {experiment}.",
        experiment=experiment,
        level="INFO",
        task="assignment",
    )

    return Response(status=204)


@app.route("/api/experiments/<experiment>/workers", methods=["DELETE"])
def remove_workers_from_experiment(experiment: str) -> ResponseReturnValue:
    # unassign all from experiment
    modify_db(
        "DELETE FROM experiment_worker_assignments WHERE experiment = ?",
        (experiment,),
    )
    background_tasks.pios("kill", "--experiment", experiment)
    publish_to_experiment_log(
        f"Removed all workers from {experiment}.",
        experiment=experiment,
        level="INFO",
        task="assignment",
    )

    return Response(status=204)


### FLASK META VIEWS


@app.errorhandler(404)
def not_found(e):
    try:
        return app.send_static_file("index.html")
    except Exception:
        return Response(status=404)


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()
