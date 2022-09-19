# -*- coding: utf-8 -*-
from __future__ import annotations

import glob
import os
import re
import sqlite3
import subprocess
from datetime import datetime

from flask import g
from flask import jsonify
from flask import request
from flask import Response
from huey.exceptions import HueyException
from yaml import CLoader as Loader  # type: ignore
from yaml import load as yaml_load  # type: ignore

import tasks as background_tasks
from app import app
from app import client
from app import config
from app import insert_into_db
from app import logger
from app import publish_to_error_log
from app import query_db

## PIOREACTOR CONTROL


@app.route("/api/stop_all", methods=["POST"])
def stop_all():
    """Kills all jobs"""
    background_tasks.pios("kill", "--all-jobs", "-y")
    return Response(status=200)


@app.route("/api/stop/<job>/<unit>", methods=["POST"])
def stop_job_on_unit(job, unit):
    """Kills specified job on unit"""

    jobs_to_kill_over_MQTT = ["add_media", "add_alt_media", "remove_waste"]

    if job in jobs_to_kill_over_MQTT:
        client.publish(f"pioreactor/{unit}/$experiment/{job}/$state/set", "disconnected", qos=2)
    else:
        background_tasks.pios("kill", "--all-jobs", "-y", "--units", unit)

    return Response(status=200)


@app.route("/api/run/<job>/<unit>", methods=["POST"])
def run_job_on_unit(job, unit):
    """Runs specified job on unit"""

    client.publish(f"pioreactor/{unit}/$experiment/run/{job}", request.get_data() or r"{}", qos=2)

    return Response(status=200)


@app.route("/api/reboot/<unit>", methods=["POST"])
def reboot_unit(unit):
    """Reboots unit"""  # should return a 0
    background_tasks.pios("reboot", "--all-jobs", "-y", "--units", unit)
    return Response(status=200)


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
            ("'$experiment'",),
        )
    except Exception as e:
        publish_to_error_log(str(e), "recent_logs")
        return Response(status=500)

    return jsonify(recent_logs)


@app.route("/api/time_series/growth_rates/<experiment>", methods=["GET"])
def growth_rates(experiment):
    """Gets growth rates for all units"""
    args = request.args
    filter_mod_n = float(args.get("filter_mod_N", 100.0))

    try:
        growth_rates = query_db(
            "SELECT json_object('series', json_group_array(unit), 'data', json_group_array(json(data))) as result FROM (SELECT pioreactor_unit as unit, json_group_array(json_object('x', timestamp, 'y', round(rate, 5))) as data FROM growth_rates WHERE experiment=? AND ((ROWID * 0.61803398875) - cast(ROWID * 0.61803398875 as int) < 1.0/?) GROUP BY 1);",
            (experiment, filter_mod_n),
            one=True,
        )

    except Exception as e:
        publish_to_error_log(str(e), "growth_rates")
        return Response(status=400)

    return growth_rates["result"]


@app.route("/api/time_series/temperature_readings/<experiment>", methods=["GET"])
def temperature_readings(experiment):
    """Gets temperature readings for all units"""
    args = request.args
    filter_mod_n = float(args.get("filter_mod_N", 100.0))

    try:
        temperature_readings = query_db(
            "SELECT json_object('series', json_group_array(unit), 'data', json_group_array(json(data))) as result FROM (SELECT pioreactor_unit as unit, json_group_array(json_object('x', timestamp, 'y', round(temperature_c, 2))) as data FROM temperature_readings WHERE experiment=? AND ((ROWID * 0.61803398875) - cast(ROWID * 0.61803398875 as int) < 1.0/?) GROUP BY 1);",
            (experiment, filter_mod_n),
            one=True,
        )

    except Exception as e:
        publish_to_error_log(str(e), "temperature_readings")
        return Response(status=400)

    return temperature_readings["result"]


@app.route("/api/time_series/od_readings_filtered/<experiment>", methods=["GET"])
def od_readings_filtered(experiment):
    """Gets normalized od for all units"""
    args = request.args
    filter_mod_n = float(args.get("filter_mod_N", 100.0))
    lookback = float(args.get("lookback", 4.0))

    try:
        filtered_od_readings = query_db(
            "SELECT json_object('series', json_group_array(unit), 'data', json_group_array(json(data))) as result FROM (SELECT pioreactor_unit as unit, json_group_array(json_object('x', timestamp, 'y', round(normalized_od_reading, 7))) as data FROM od_readings_filtered WHERE experiment=? AND ((ROWID * 0.61803398875) - cast(ROWID * 0.61803398875 as int) < 1.0/?) AND timestamp > strftime('%Y-%m-%dT%H:%M:%S', datetime('now',?)) GROUP BY 1);",
            (experiment, filter_mod_n, f"-{lookback} hours"),
            one=True,
        )

    except Exception as e:
        publish_to_error_log(str(e), "od_readings_filtered")
        return Response(status=400)

    return filtered_od_readings["result"]


@app.route("/api/time_series/od_readings/<experiment>", methods=["GET"])
def od_readings(experiment):
    """Gets raw od for all units"""
    args = request.args
    filter_mod_n = float(args.get("filter_mod_N", 100.0))
    lookback = float(args.get("lookback", 4.0))

    try:
        raw_od_readings = query_db(
            """SELECT
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


@app.route("/api/time_series/alt_media_fraction/<experiment>", methods=["GET"])
def alt_media_fraction(experiment):
    """get fraction of alt media added to vial"""

    try:
        alt_media_fraction_ = query_db(
            "SELECT json_object('series', json_group_array(unit), 'data', json_group_array(json(data))) as result FROM (SELECT pioreactor_unit as unit, json_group_array(json_object('x', timestamp, 'y', round(alt_media_fraction, 7))) as data FROM alt_media_fractions WHERE experiment=? GROUP BY 1);",
            (experiment,),
            one=True,
        )

    except Exception as e:
        publish_to_error_log(str(e), "alt_media_fractions")
        return Response(status=400)

    return alt_media_fraction_["result"]


@app.route("/api/recent_media_rates", methods=["GET"])
def recent_media_rates():
    """Shows amount of added media per unit"""
    ## this one confusing
    hours = 3

    try:
        rows = query_db(
            "SELECT d.pioreactor_unit, SUM(CASE WHEN event='add_media' THEN volume_change_ml ELSE 0 END) / ? AS media_rate, SUM(CASE WHEN event='add_alt_media' THEN volume_change_ml ELSE 0 END) / ? AS alt_media_rate FROM dosing_events AS d JOIN latest_experiment USING (experiment) WHERE datetime(d.timestamp) >= datetime('now', '-? hours') AND event IN ('add_alt_media', 'add_media') AND source_of_event LIKE 'dosing_automation%' GROUP BY d.pioreactor_unit;",
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


@app.route("/api/calibrations/<pioreactor_unit>/<calibration_type>", methods=["GET"])
def get_unit_calibrations(pioreactor_unit, calibration_type):

    try:
        unit_calibration = query_db(
            "SELECT * FROM calibrations WHERE type=? AND pioreactor_unit=?",
            (calibration_type, pioreactor_unit),
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_unit_calibrations")
        return Response(status=400)

    return jsonify(unit_calibration)


## PLUGINS


@app.route("/api/get_installed_plugins", methods=["GET"])
def list_installed_plugins():

    result = background_tasks.pio("list-plugins", "--json")
    try:
        status, msg = result(blocking=True, timeout=10)
    except HueyException:
        status, msg = False, "Timed out."

    if not status:
        publish_to_error_log(msg, "get_installed_plugins")
        return jsonify([])

    else:
        return msg


@app.route("/api/install_plugin", methods=["POST"])
def install_plugin():
    body = request.get_json()
    background_tasks.pios("install-plugin", body["plugin_name"])
    return Response(status=200)


@app.route("/api/uninstall_plugin", methods=["POST"])
def uninstall_plugin():
    body = request.get_json()
    background_tasks.pios("uninstall-plugin", body["plugin_name"])
    return Response(status=200)


## MISC


@app.route("/api/contrib/automations/<automation_type>", methods=["GET"])
def get_automation_contrib(automation_type):
    # TODO: this _could_ _maybe_ be served by the webserver. After all, these are static assets.

    # security to prevent possibly reading arbitrary file
    if automation_type not in ["temperature", "dosing", "led"]:
        return Response(status=400)

    try:
        automation_path = os.path.join(config["CONTRIB_FOLDER"], "automations", automation_type)

        files = sorted(
            glob.glob(automation_path + "/*.y[a]ml")
        )  # list of strings, where strings rep. paths to  yaml files

        automations = []  # list of dict

        for file in files:
            with open(file, "rb") as file_stream:
                automations.append(
                    yaml_load(file_stream.read(), Loader=Loader)
                )  # read returns string, safe_load converts to python object == dict

        return jsonify(automations)

    except Exception as e:
        publish_to_error_log(str(e), "get_automation_contrib")
        return Response(status=400)


@app.route("/api/contrib/jobs", methods=["GET"])
def get_job_contrib():
    # TODO: this _could_ _maybe_ be served by the webserver. After all, these are static assets. Yaml conversion to js can happen on the client side

    try:
        job_path = os.path.join(config["CONTRIB_FOLDER"], "jobs")

        files = sorted(
            glob.glob(job_path + "/*.y[a]ml")
        )  # list of strings, where strings rep. paths to  yaml files

        jobs = []  # list of dict

        for file in files:
            with open(file, "rb") as file_stream:
                jobs.append(
                    yaml_load(file_stream.read(), Loader=Loader)
                )  # read returns string, safe_load converts to python object == dict

        return jsonify(jobs)

    except Exception as e:
        publish_to_error_log(str(e), "get_job_contrib")
        return Response(status=400)


@app.route("/api/update_app", methods=["POST"])
def update_app():
    background_tasks.update_app()
    return 200


@app.route("/api/get_app_version", methods=["GET"])
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
    return result.stdout.strip()


@app.route("/api/export_datasets", methods=["POST"])
def export_datasets():
    # {"experimentSelection":"Demo experiment 10","datasetCheckbox":{"pioreactor_unit_activity_data":false,"growth_rates":true,"dosing_events":false,"led_events":false,"experiments":false,"od_readings":true,"od_readings_filtered":false,"logs":false,"alt_media_fraction":false,"dosing_automation_settings":false,"led_automation_settings":false,"temperature_automation_settings":false,"kalman_filter_outputs":false,"stirring_rates":false,"temperature_readings":false,"pioreactor_unit_labels":false,"led_automation_events":false,"dosing_automation_events":false,"temperature_automation_events":false}}

    body = request.get_json()

    cmd_tables = [
        f" --tables {table_name}"
        for (table_name, exporting) in body["datasetCheckbox"].items()
        if exporting
    ]
    experiment_name = body["experimentSelection"]
    logger.debug(f"{experiment_name=}")
    logger.debug(f"{cmd_tables=}")

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    if experiment_name == "<All experiments>":
        experiment_options = []
        filename = f"export_{timestamp}.zip"
    else:
        experiment_options = ["--experiment", experiment_name.replace(" ", r"\ ")]
        filename = f"export_{experiment_name.replace(' ', '_')}_{timestamp}.zip"  # TODO: replace more strings...

    logger.debug(f"{timestamp=}")
    logger.debug(f"{filename=}")
    logger.debug(f"{experiment_options=}")

    filename_with_path = os.path.join("/var/www/pioreactorui/static/exports/", filename)
    logger.debug(f"{filename_with_path=}")

    result = background_tasks.pio(
        "run",
        "export_experiment_data",
        "--output",
        filename_with_path,
        *cmd_tables,
        *experiment_options,
    )
    try:
        status, msg = result(blocking=True, timeout=5 * 60)
    except HueyException:
        status, msg = False, "Timed out on export."
        publish_to_error_log(msg, "export_datasets")
        return Response({"result": status, "filename": None, "msg": msg}, status=500)

    if not status:
        publish_to_error_log(msg, "export_datasets")
        return Response({"result": status, "filename": None, "msg": msg}, status=500)

    return Response({"result": status, "filename": filename, "msg": msg}, status=200)


@app.route("/api/get_experiments", methods=["GET"])
def get_experiments():
    try:
        experiments = query_db(
            "SELECT experiment, created_at, description FROM experiments ORDER BY created_at DESC;"
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_experiments")
        return Response(status=400)

    return jsonify(experiments)


@app.route("/api/get_latest_experiment", methods=["GET"])
def get_latest_experiment():
    try:
        latest_experiment = query_db(
            "SELECT experiment, created_at, description, media_used, organism_used, delta_hours FROM latest_experiment",
            one=True,
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_latest_experiment")
        return Response(status=400)

    return jsonify(latest_experiment)


@app.route("/api/get_current_unit_labels", methods=["GET"])
def get_current_unit_labels():
    try:
        current_unit_labels = query_db(
            "SELECT r.pioreactor_unit as unit, r.label FROM pioreactor_unit_labels AS r JOIN latest_experiment USING (experiment);"
        )

        keyed_by_unit = {d["unit"]: d["label"] for d in current_unit_labels}

        return jsonify(keyed_by_unit)

    except Exception as e:
        publish_to_error_log(str(e), "get_current_unit_labels")
        return Response(status=400)


@app.route("/api/update_current_unit_labels", methods=["POST"])
def update_current_unit_labels():

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
        publish_to_error_log(str(e), "update_current_unit_labels")
        return Response(status=400)

    # client.publish(f"pioreactor/{unit}/{latest_experiment}/unit_label", label, retain=True)

    return Response(status=200)


@app.route("/api/get_historical_organisms_used", methods=["GET"])
def get_historical_organisms_used():
    try:
        historical_organisms = query_db(
            'SELECT DISTINCT organism_used as key FROM experiments WHERE NOT (organism_used IS NULL OR organism_used == "") ORDER BY created_at DESC;'
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_historical_organisms_used_used")
        return Response(status=400)

    return jsonify(historical_organisms)


@app.route("/api/get_historical_media_used", methods=["GET"])
def get_historical_media_used():
    try:
        historical_media = query_db(
            'SELECT DISTINCT media_used as key FROM experiments WHERE NOT (media_used IS NULL OR media_used == "") ORDER BY created_at DESC;'
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_historical_organisms_used_used")
        return Response(status=400)

    return jsonify(historical_media)


@app.route("/api/create_experiment", methods=["POST"])
def create_experiment():

    body = request.get_json()

    try:
        insert_into_db(
            "INSERT INTO experiments (created_at, experiment, description, media_used, organism_used) VALUES (?,?,?,?,?)",
            (
                body["created_at"],
                body["experiment"],
                body.get("description"),
                body.get("media_used"),
                body.get("organism_used"),
            ),
        )

        client.publish("pioreactor/latest_experiment", body["experiment"], qos=2, retain=True)
        return Response(status=200)

    except sqlite3.IntegrityError as e:
        publish_to_error_log(str(e), "create_experiment")
        return Response(status=400)
    except Exception as e:
        print(e)
        publish_to_error_log(str(e), "create_experiment")
        return Response(status=400)


@app.route("/api/update_experiment_desc", methods=["POST"])
def update_experiment_description():
    body = request.get_json()
    try:
        insert_into_db(
            "UPDATE experiments SET description = (?) WHERE experiment=(?)",
            (body["description"], body["experiment"]),
        )
        return Response(status=200)

    except Exception as e:
        publish_to_error_log(str(e), "update_experiment_desc")
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
        return Response(status=200)
    else:
        publish_to_error_log(msg, "add_new_pioreactor")
        return {"msg": msg}, 500


## CONFIG CONTROL


@app.route("/api/get_config/<filename>", methods=["GET"])
def get_config(filename):
    """get a specific config.ini file in the .pioreactor folder"""

    # security bit: strip out any paths that may be attached, ex: ../../../root/bad
    filename = os.path.basename(filename)

    try:
        specific_config_path = os.path.join(config["CONFIG_INI_FOLDER"], filename)

        with open(specific_config_path) as file_stream:
            return file_stream.read()

    except Exception as e:
        publish_to_error_log(str(e), "get_config_of_file")
        return Response(status=400)


@app.route("/api/get_configs", methods=["GET"])
def get_configs():
    """get a list of all config.ini files in the .pioreactor folder"""
    try:
        config_path = config["CONFIG_INI_FOLDER"]

        list_config_files = []

        for file in os.listdir(config_path):
            if file.startswith("config") and file.endswith(".ini"):
                list_config_files.append(file)

        return jsonify(list_config_files)

    except Exception as e:
        publish_to_error_log(str(e), "get_configs")
        return Response(status=400)


@app.route("/api/delete_config", methods=["POST"])
def delete_config():
    """TODO: make this http DELETE"""
    # TODO: test this. I think they will be a permissions issue.

    body = request.get_json()

    config_path = os.path.join(config["CONFIG_INI_FOLDER"], body["filename"])

    result = subprocess.run(["rm", config_path], capture_output=True, text=True)

    if result.returncode != 0:
        publish_to_error_log(result.stdout, "delete_config")
        publish_to_error_log(result.stderr, "delete_config")
        return Response(status=400)

    else:
        return Response(status=200)


@app.route("/api/save_new_config", methods=["POST"])
def save_new_config():
    """if the config file is unit specific, we only need to run sync-config on that unit."""

    # TODO: this is too slow. Can we chain together the background tasks so we aren't
    # contantly waiting around??

    body = request.get_json()
    filename, code = body["filename"], body["code"]

    if not filename.endswith(".ini"):
        return Response(status=400)

    # security bit:
    # users could have filename look like ../../../../root/bad.txt
    # the below code will strip any paths.
    filename = os.path.basename(filename)

    # is the user editing a worker config or the global config?
    regex = re.compile(r"config_?(.*)?\.ini")
    if regex.match(filename)[1] != "":
        units = regex.match(filename)[1]
        flags = "--specific"
    else:
        units = "$broadcast"
        flags = "--shared"

    # General security risk here to save arbitrary file to OS.
    config_path = os.path.join(config["CONFIG_INI_FOLDER"], filename)

    result = background_tasks.write_config(config_path, code)

    try:
        status, msg_or_exception = result(blocking=True, timeout=10)
    except HueyException:
        status, msg_or_exception = False, "write_config timed out"
    except Exception:
        raise msg_or_exception

    if not status:
        publish_to_error_log(msg_or_exception, "save_new_config")
        return Response(status=500)

    result = background_tasks.pios("sync-configs", "--units", units, flags)

    try:
        status, msg_or_exception = result(blocking=True, timeout=60)
    except HueyException:
        status, msg_or_exception = False, "sync-configs timed out."

    if not status:
        publish_to_error_log(msg_or_exception, "save_new_config")
        return Response(status=500)

    return Response(status=200)


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
