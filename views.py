# -*- coding: utf-8 -*-
from __future__ import annotations

import configparser
import re
import sqlite3
import subprocess
from datetime import datetime
from datetime import timezone
from pathlib import Path

from flask import g
from flask import jsonify
from flask import request
from flask import Response
from huey.exceptions import HueyException
from msgspec import ValidationError
from msgspec.json import encode as json_encode
from msgspec.yaml import decode as yaml_decode

import structs
import tasks as background_tasks
from app import app
from app import client
from app import insert_into_db
from app import publish_to_error_log
from app import publish_to_log
from app import query_db
from app import VERSION
from config import cache
from config import env


def current_utc_datetime() -> datetime:
    # this is timezone aware.
    return datetime.now(timezone.utc)


def to_iso_format(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


def current_utc_timestamp() -> str:
    # this is timezone aware.
    return to_iso_format(current_utc_datetime())


## PIOREACTOR CONTROL


@app.route("/api/stop_all", methods=["POST"])
def stop_all():
    """Kills all jobs"""
    background_tasks.pios("kill", "--all-jobs", "-y")
    return Response(status=204)


@app.route("/api/stop/<job>/<unit>", methods=["POST"])
def stop_job_on_unit(job: str, unit: str):
    """Kills specified job on unit"""

    jobs_to_kill_over_MQTT = {
        "add_media",
        "add_alt_media",
        "remove_waste",
        "circulate_media",
        "circulate_alt_media",
    }

    if job in jobs_to_kill_over_MQTT:
        msg = client.publish(
            f"pioreactor/{unit}/$experiment/{job}/$state/set", b"disconnected", qos=1
        )
        try:
            msg.wait_for_publish(timeout=1.0)
        except Exception:
            return Response(status=500)
    else:
        background_tasks.pios("kill", job, "-y", "--units", unit)

    return Response(status=204)


@app.route("/api/run/<job>/<unit>", methods=["POST"])
def run_job_on_unit(job: str, unit: str):
    """Runs specified job on unit"""

    client.publish(f"pioreactor/{unit}/$experiment/run/{job}", request.get_data() or r"{}", qos=2)

    return Response(status=204)


@app.route("/api/reboot/<unit>", methods=["POST"])
def reboot_unit(unit: str):
    """Reboots unit"""
    background_tasks.pios("reboot", "-y", "--units", unit)
    return Response(status=204)


## DATA FOR CARDS ON OVERVIEW


@app.route("/api/recent_logs", methods=["GET"])
def recent_logs():
    """Shows event logs from all units"""
    args = request.args
    if "min_level" in args:
        min_level = args["min_level"]
    else:
        min_level = "INFO"

    if min_level == "DEBUG":
        level_string = '(level == "ERROR" or level == "WARNING" or level == "NOTICE" or level == "INFO" or level == "DEBUG")'
    elif min_level == "INFO":
        level_string = (
            '(level == "ERROR" or level == "NOTICE" or level == "INFO" or level == "WARNING")'
        )
    elif min_level == "WARNING":
        level_string = '(level == "ERROR" or level == "WARNING")'
    elif min_level == "ERROR":
        level_string = '(level == "ERROR")'
    else:
        level_string = (
            '(level == "ERROR" or level == "NOTICE" or level == "INFO" or level == "WARNING")'
        )

    try:
        recent_logs = query_db(
            f"SELECT l.timestamp, level=='ERROR'as is_error, level=='WARNING' as is_warning, level=='NOTICE' as is_notice, l.pioreactor_unit, message, task FROM logs AS l LEFT JOIN latest_experiment AS le ON (le.experiment = l.experiment OR l.experiment=?) WHERE {level_string} AND l.timestamp >= MAX(strftime('%Y-%m-%dT%H:%M:%S', datetime('now', '-24 hours')), le.created_at) ORDER BY l.timestamp DESC LIMIT 50;",
            ("$experiment",),
        )
    except Exception as e:
        publish_to_error_log(str(e), "recent_logs")
        return Response(status=500)

    return jsonify(recent_logs)


@app.route("/api/time_series/growth_rates/<experiment>", methods=["GET"])
@cache.memoize(expire=10)
def growth_rates(experiment: str):
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

    except Exception as e:
        publish_to_error_log(str(e), "growth_rates")
        return Response(status=400)

    return growth_rates["result"]


@app.route("/api/time_series/temperature_readings/<experiment>", methods=["GET"])
@cache.memoize(expire=10)
def temperature_readings(experiment: str):
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

    except Exception as e:
        publish_to_error_log(str(e), "temperature_readings")
        return Response(status=400)

    return temperature_readings["result"]


@app.route("/api/time_series/od_readings_filtered/<experiment>", methods=["GET"])
@cache.memoize(expire=10)
def od_readings_filtered(experiment: str):
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

    except Exception as e:
        publish_to_error_log(str(e), "od_readings_filtered")
        return Response(status=400)

    return filtered_od_readings["result"]


@app.route("/api/time_series/od_readings/<experiment>", methods=["GET"])
@cache.memoize(expire=10)
def od_readings(experiment: str):
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

    except Exception as e:
        publish_to_error_log(str(e), "od_readings")
        return Response(status=400)

    return raw_od_readings["result"]


@app.route("/api/time_series/<data_source>/<experiment>/<column>", methods=["GET"])
@cache.memoize(expire=30)
def fallback_time_series(data_source: str, experiment: str, column: str):
    args = request.args
    lookback = float(args.get("lookback", 4.0))
    try:
        r = query_db(
            f"SELECT json_object('series', json_group_array(unit), 'data', json_group_array(json(data))) as result FROM (SELECT pioreactor_unit as unit, json_group_array(json_object('x', timestamp, 'y', round({column}, 7))) as data FROM {data_source} WHERE experiment=? AND timestamp > strftime('%Y-%m-%dT%H:%M:%S', datetime('now',?)) GROUP BY 1);",
            (experiment, f"-{lookback} hours"),
            one=True,
        )

    except Exception as e:
        publish_to_error_log(str(e), "fallback_time_series")
        return Response(status=400)
    return r["result"]


@app.route("/api/recent_media_rates", methods=["GET"])
@cache.memoize(expire=30)
def recent_media_rates():
    """
    Shows amount of added media per unit. Note that it only consider values from a dosing automation (i.e. not manual dosing, which includes continously dose)

    """
    ## this one confusing
    hours = 3

    try:
        rows = query_db(
            """
            SELECT
                d.pioreactor_unit,
                SUM(CASE WHEN event='add_media' THEN volume_change_ml ELSE 0 END) / ? AS media_rate,
                SUM(CASE WHEN event='add_alt_media' THEN volume_change_ml ELSE 0 END) / ? AS alt_media_rate
            FROM dosing_events AS d
            JOIN latest_experiment USING (experiment)
            WHERE
                datetime(d.timestamp) >= datetime('now', '-? hours') AND
                event IN ('add_alt_media', 'add_media') AND
                source_of_event LIKE 'dosing_automation%'
            GROUP BY d.pioreactor_unit;
            """,
            (hours, hours),
        )

        json_result = {}
        aggregate = {"altMediaRate": 0.0, "mediaRate": 0.0}
        for row in rows:
            json_result[row["pioreactor_unit"]] = {
                "alt_media_rate": row["alt_media_rate"],
                "media_rate": row["media_rate"],
            }
            aggregate["media_rate"] = aggregate["media_rate"] + row["media_rate"]
            aggregate["alt_media_rate"] = aggregate["alt_media_rate"] + row["alt_media_rate"]

        json_result["all"] = aggregate
        return jsonify(json_result)

    except Exception as e:
        publish_to_error_log(str(e), "recent_media_rates")
        return Response(status=400)


## CALIBRATIONS


@app.route("/api/calibration_types", methods=["GET"])
def get_calibration_types():

    try:
        types = query_db(
            "SELECT DISTINCT type FROM calibrations",
        )

    except Exception as e:
        publish_to_error_log(str(e), "calibration_types")
        return Response(status=400)

    return jsonify(types)


@app.route("/api/calibrations/<pioreactor_unit>/<calibration_type>", methods=["GET"])
def get_unit_calibrations_of_type(pioreactor_unit: str, calibration_type: str):

    try:
        unit_calibration = query_db(
            "SELECT * FROM calibrations WHERE type=? AND pioreactor_unit=?",
            (calibration_type, pioreactor_unit),
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_unit_calibrations_of_type")
        return Response(status=400)

    return jsonify(unit_calibration)


## PLUGINS


@app.route("/api/installed_plugins", methods=["GET"])
@cache.memoize(expire=30, tag="plugins")
def list_installed_plugins():

    result = background_tasks.pio("list-plugins", "--json")
    try:
        status, msg = result(blocking=True, timeout=10)
    except HueyException:
        status, msg = False, "Timed out."

    if not status:
        publish_to_error_log(msg, "installed_plugins")
        return jsonify([])
    else:
        return msg


@app.route("/api/installed_plugins/<filename>", methods=["GET"])
def get_plugin(filename: str):
    """get a specific Python file in the .pioreactor/plugin folder"""
    # security bit: strip out any paths that may be attached, ex: ../../../root/bad
    file = Path(filename).name

    try:
        assert Path(file).suffix == ".py"

        specific_plugin_path = Path(env["DOT_PIOREACTOR"]) / "plugins" / file
        return Response(
            response=specific_plugin_path.read_text(),
            status=200,
            mimetype="text/plain",
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_plugin")
        return Response(status=400)


@app.route("/api/install_plugin", methods=["POST"])
def install_plugin():
    body = request.get_json()
    background_tasks.pios_install_plugin(body["plugin_name"])
    return Response(status=204)


@app.route("/api/uninstall_plugin", methods=["POST"])
def uninstall_plugin():
    body = request.get_json()
    background_tasks.pios_uninstall_plugin(body["plugin_name"])
    return Response(status=204)


## MISC


@app.route("/api/contrib/automations/<automation_type>", methods=["GET"])
@cache.memoize(expire=30, tag="plugins")
def get_automation_contrib(automation_type: str):

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
        files = sorted(automation_path_default.glob("*.y[a]ml")) + sorted(
            automation_path_plugins.glob("*.y[a]ml")
        )

        parsed_yaml = []
        for file in files:
            try:
                parsed_yaml.append(
                    yaml_decode(file.read_bytes(), type=structs.AutomationDescriptor)
                )
            except ValidationError as e:
                publish_to_error_log(
                    f"Yaml error in {Path(file).name}: {e}", "get_automation_contrib"
                )

        return Response(
            response=json_encode(parsed_yaml),
            status=200,
            mimetype="application/json",
            headers={"Cache-Control": "public,max-age=10"},
        )
    except Exception as e:
        publish_to_error_log(str(e), "get_automation_contrib")
        return Response(status=400)


@app.route("/api/contrib/jobs", methods=["GET"])
@cache.memoize(expire=30, tag="plugins")
def get_job_contrib():

    try:
        job_path_default = Path(env["WWW"]) / "contrib" / "jobs"
        job_path_plugins = Path(env["DOT_PIOREACTOR"]) / "plugins" / "ui" / "contrib" / "jobs"
        files = sorted(job_path_default.glob("*.y[a]ml")) + sorted(
            job_path_plugins.glob("*.y[a]ml")
        )

        parsed_yaml = []
        for file in files:
            try:
                parsed_yaml.append(
                    yaml_decode(file.read_bytes(), type=structs.BackgroundJobDescriptor)
                )
            except ValidationError as e:
                publish_to_error_log(f"Yaml error in {Path(file).name}: {e}", "get_job_contrib")

        return Response(
            response=json_encode(parsed_yaml),
            status=200,
            mimetype="application/json",
            headers={"Cache-Control": "public,max-age=10"},
        )
    except Exception as e:
        publish_to_error_log(str(e), "get_job_contrib")
        return Response(status=400)


@app.route("/api/contrib/charts", methods=["GET"])
@cache.memoize(expire=30, tag="plugins")
def get_charts_contrib():
    try:
        chart_path_default = Path(env["WWW"]) / "contrib" / "charts"
        chart_path_plugins = Path(env["DOT_PIOREACTOR"]) / "plugins" / "ui" / "contrib" / "charts"
        files = sorted(chart_path_default.glob("*.y[a]ml")) + sorted(
            chart_path_plugins.glob("*.y[a]ml")
        )
        parsed_yaml = []
        for file in files:
            try:
                parsed_yaml.append(yaml_decode(file.read_bytes(), type=structs.ChartDescriptor))
            except ValidationError as e:
                publish_to_error_log(f"Yaml error in {Path(file).name}: {e}", "get_charts_contrib")

        return Response(
            response=json_encode(parsed_yaml),
            status=200,
            mimetype="application/json",
            headers={"Cache-Control": "public,max-age=10"},
        )
    except Exception as e:
        publish_to_error_log(str(e), "get_charts_contrib")
        return Response(status=400)


@app.route("/api/update_app", methods=["POST"])
def update_app():
    background_tasks.update_app()
    return Response(status=200)


@app.route("/api/app_version", methods=["GET"])
@cache.memoize(expire=60, tag="app")
def get_app_version():
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
        headers={"Cache-Control": "public,max-age=10"},
    )


@app.route("/api/ui_version", methods=["GET"])
def get_ui_version():
    return VERSION


@app.route("/api/export_datasets", methods=["POST"])
def export_datasets():
    body = request.get_json()

    cmd_tables = sum(
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
def get_experiments():
    try:
        response = jsonify(
            query_db(
                "SELECT experiment, created_at, description FROM experiments ORDER BY created_at DESC;"
            )
        )
        return response

    except Exception as e:
        publish_to_error_log(str(e), "get_experiments")
        return Response(status=500)


@app.route("/api/experiments", methods=["POST"])
def create_experiment():
    cache.evict("experiments")
    cache.evict("unit_labels")

    body = request.get_json()

    try:
        insert_into_db(
            "INSERT INTO experiments (created_at, experiment, description, media_used, organism_used) VALUES (?,?,?,?,?)",
            (
                current_utc_timestamp(),
                body["experiment"],
                body.get("description"),
                body.get("mediaUsed"),
                body.get("organismUsed"),
            ),
        )
        publish_to_log(
            f"New experiment created: {body['experiment']}", "create_experiment", level="INFO"
        )
        return Response(status=200)

    except sqlite3.IntegrityError:
        return Response(status=400)
    except Exception as e:
        publish_to_error_log(str(e), "create_experiment")
        return Response(status=500)


@app.route("/api/experiments/latest", methods=["GET"])
@cache.memoize(expire=30, tag="experiments")
def get_latest_experiment():
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


@app.route("/api/current_unit_labels", methods=["GET"])
@cache.memoize(expire=30, tag="unit_labels")
def get_current_unit_labels():
    try:
        current_unit_labels = query_db(
            "SELECT r.pioreactor_unit as unit, r.label FROM pioreactor_unit_labels AS r JOIN latest_experiment USING (experiment);"
        )

        keyed_by_unit = {d["unit"]: d["label"] for d in current_unit_labels}

        return Response(
            response=json_encode(keyed_by_unit),
            status=200,
            headers={"Cache-Control": "public,max-age=10"},
            mimetype="application/json",
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_current_unit_labels")
        return Response(status=500)


@app.route("/api/current_unit_labels", methods=["PUT"])
def upsert_current_unit_labels():
    cache.evict("unit_labels")

    body = request.get_json()

    unit = body["unit"]
    label = body["label"]

    latest_experiment_dict = query_db("SELECT experiment FROM latest_experiment", one=True)

    latest_experiment = latest_experiment_dict["experiment"]

    try:
        insert_into_db(
            "INSERT OR REPLACE INTO pioreactor_unit_labels (label, experiment, pioreactor_unit, created_at) VALUES ((?), (?), (?), strftime('%Y-%m-%dT%H:%M:%S', datetime('now')) ) ON CONFLICT(experiment, pioreactor_unit) DO UPDATE SET label=excluded.label, created_at=strftime('%Y-%m-%dT%H:%M:%S', datetime('now'))",
            (label, latest_experiment, unit),
        )

    except Exception as e:
        publish_to_error_log(str(e), "upsert_current_unit_labels")
        return Response(status=400)

    # client.publish(f"pioreactor/{unit}/{latest_experiment}/unit_label", label, retain=True)

    return Response(status=204)


@app.route("/api/historical_organisms", methods=["GET"])
def get_historical_organisms_used():
    try:
        historical_organisms = query_db(
            'SELECT DISTINCT organism_used as key FROM experiments WHERE NOT (organism_used IS NULL OR organism_used == "") ORDER BY created_at DESC;'
        )

    except Exception as e:
        publish_to_error_log(str(e), "historical_organisms")
        return Response(status=500)

    return jsonify(historical_organisms)


@app.route("/api/historical_media", methods=["GET"])
def get_historical_media_used():
    try:
        historical_media = query_db(
            'SELECT DISTINCT media_used as key FROM experiments WHERE NOT (media_used IS NULL OR media_used == "") ORDER BY created_at DESC;'
        )

    except Exception as e:
        publish_to_error_log(str(e), "historical_media")
        return Response(status=500)

    return jsonify(historical_media)


@app.route("/api/experiment_desc", methods=["PUT"])
def update_experiment_description():
    cache.evict("experiments")

    body = request.get_json()
    try:
        insert_into_db(
            "UPDATE experiments SET description = (?) WHERE experiment=(?)",
            (body["description"], body["experiment"]),
        )
        return Response(status=204)

    except Exception as e:
        publish_to_error_log(str(e), "update_experiment_description")
        return Response(status=500)


@app.route("/api/add_new_pioreactor", methods=["POST"])
def add_new_pioreactor():
    new_name = request.get_json()["newPioreactorName"]
    try:
        result = background_tasks.add_new_pioreactor(new_name)
    except Exception as e:
        publish_to_error_log(str(e), "add_new_pioreactor")
        return {"msg": str(e)}, 500

    try:
        status, msg = result(blocking=True, timeout=60)
    except HueyException:
        status, msg = False, "Timed out, see logs."

    if status:
        return Response(status=204)
    else:
        publish_to_error_log(msg, "add_new_pioreactor")
        return {"msg": msg}, 500


## CONFIG CONTROL


@app.route("/api/configs/<filename>", methods=["GET"])
@cache.memoize(expire=30, tag="config")
def get_config(filename: str):
    """get a specific config.ini file in the .pioreactor folder"""

    # security bit: strip out any paths that may be attached, ex: ../../../root/bad
    filename = Path(filename).name

    try:

        assert Path(filename).suffix == ".ini"

        specific_config_path = Path(env["DOT_PIOREACTOR"]) / filename
        return Response(
            response=specific_config_path.read_text(),
            status=200,
            mimetype="text/plain",
            headers={"Cache-Control": "public,max-age=10"},
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_config_of_file")
        return Response(status=400)


@app.route("/api/configs", methods=["GET"])
@cache.memoize(expire=60, tag="config")
def get_configs():
    """get a list of all config.ini files in the .pioreactor folder"""
    try:
        config_path = Path(env["DOT_PIOREACTOR"])
        return jsonify([file.name for file in config_path.glob("config*.ini")])

    except Exception as e:
        publish_to_error_log(str(e), "get_configs")
        return Response(status=500)


@app.route("/api/configs/<filename>", methods=["DELETE"])
def delete_config(filename):
    cache.evict("config")
    filename = Path(filename).name  # remove any ../../ prefix stuff
    config_path = Path(env["DOT_PIOREACTOR"]) / filename

    background_tasks.rm(config_path)
    publish_to_log(f"Deleted config {filename}.", "delete_config")
    return Response(status=204)


@app.route("/api/configs/<filename>", methods=["PUT"])
def update_new_config(filename):
    """if the config file is unit specific, we only need to run sync-config on that unit."""
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
    if regex.match(filename)[1] != "":
        units = regex.match(filename)[1]
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
        publish_to_error_log(msg, "save_new_config")
        return {"msg": msg}, 400
    except configparser.DuplicateOptionError as e:
        msg = f"Duplicate option, `{e.option}`, was found in section [{e.section}]. Please fix and try again."
        publish_to_error_log(msg, "save_new_config")
        return {"msg": msg}, 400
    except configparser.ParsingError:
        msg = "Incorrect syntax. Please fix and try again."
        publish_to_error_log(msg, "save_new_config")
        return {"msg": msg}, 400
    except (AssertionError, configparser.NoSectionError, KeyError, TypeError):
        msg = "Missing required field(s) in [cluster.topology]: `leader_hostname` and/or `leader_address`. Please fix and try again."
        publish_to_error_log(msg, "save_new_config")
        return {"msg": msg}, 400
    except Exception as e:
        publish_to_error_log(str(e), "save_new_config")
        msg = "Hm, something went wrong, check PioreactorUI logs."
        return {"msg": msg}, 500

    result = background_tasks.write_config_and_sync(config_path, code, units, flags)

    try:
        status, msg_or_exception = result(blocking=True, timeout=60)
    except HueyException:
        status, msg_or_exception = False, "sync-configs timed out."

    if not status:
        publish_to_error_log(msg_or_exception, "save_new_config")
        return {"msg": str(msg_or_exception)}, 500

    return Response(status=204)


@app.route("/api/historical_configs/<filename>", methods=["GET"])
@cache.memoize(expire=60, tag="config")
def get_historical_config_for(filename: str):
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
@cache.memoize(expire=None)
def is_local_access_point_active():
    import os

    if os.environ.get("LOCAL_ACCESS_POINT") == "1":
        return "true"
    else:
        return "false"


### FLASK META VIEWS


@app.errorhandler(404)
def not_found(e):
    try:
        return app.send_static_file("index.html")
    except Exception:
        return "Not found! Missing index.html?", 404


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()
