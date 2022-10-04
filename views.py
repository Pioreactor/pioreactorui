# -*- coding: utf-8 -*-
from __future__ import annotations

import configparser
import re
import sqlite3
import subprocess
from datetime import datetime
from pathlib import Path

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
from app import env
from app import insert_into_db
from app import publish_to_error_log
from app import query_db


## PIOREACTOR CONTROL


@app.route("/api/stop_all", methods=["POST"])
def stop_all():
    """Kills all jobs"""
    background_tasks.pios("kill", "--all-jobs", "-y")
    return Response(status=204)


@app.route("/api/stop/<job>/<unit>", methods=["POST"])
def stop_job_on_unit(job: str, unit: str):
    """Kills specified job on unit"""

    jobs_to_kill_over_MQTT = ["add_media", "add_alt_media", "remove_waste"]

    if job in jobs_to_kill_over_MQTT:
        client.publish(f"pioreactor/{unit}/$experiment/{job}/$state/set", "disconnected", qos=2)
    else:
        background_tasks.pios("kill", "--all-jobs", "-y", "--units", unit)

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
def growth_rates(experiment: str):
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
def temperature_readings(experiment: str):
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
def od_readings_filtered(experiment: str):
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
def od_readings(experiment: str):
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
def alt_media_fraction(experiment: str):
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


@app.route("/api/get_calibration_types", methods=["GET"])
def get_calibration_types():

    try:
        types = query_db(
            "SELECT DISTINCT type FROM calibrations",
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_calibration_types")
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
    return Response(status=204)


@app.route("/api/uninstall_plugin", methods=["POST"])
def uninstall_plugin():
    body = request.get_json()
    background_tasks.pios("uninstall-plugin", body["plugin_name"])
    return Response(status=204)


## MISC


@app.route("/api/contrib/automations/<automation_type>", methods=["GET"])
def get_automation_contrib(automation_type: str):
    # TODO: this _could_ _maybe_ be served by the webserver. After all, these are static assets.

    # security to prevent possibly reading arbitrary file
    if automation_type not in ["temperature", "dosing", "led"]:
        return Response(status=400)

    try:
        automation_path_default = Path(env["WWW"]) / "contrib" / "automations" / automation_type
        automation_path_plugins = (
            Path(env["DOT_PIOREACTOR"]) / "plugins" / "ui" / "automations" / automation_type
        )
        files = sorted(automation_path_default.glob("*.y[a]ml")) + sorted(
            automation_path_plugins.glob("*.y[a]ml")
        )
        return jsonify([yaml_load(file.read_bytes(), Loader=Loader) for file in files])
    except Exception as e:
        publish_to_error_log(str(e), "get_automation_contrib")
        return Response(status=400)


@app.route("/api/contrib/jobs", methods=["GET"])
def get_job_contrib():
    # TODO: this _could_ _maybe_ be served by the webserver. After all, these are static assets. Yaml conversion to js can happen on the client side

    try:
        job_path_default = Path(env["WWW"]) / "contrib" / "jobs"
        job_path_plugins = Path(env["DOT_PIOREACTOR"]) / "plugins" / "contrib" / "jobs"
        files = sorted(job_path_default.glob("*.y[a]ml")) + sorted(
            job_path_plugins.glob("*.y[a]ml")
        )
        return jsonify([yaml_load(file.read_bytes(), Loader=Loader) for file in files])
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


@app.route("/api/get_experiments", methods=["GET"])
def get_experiments():
    try:
        return jsonify(
            query_db(
                "SELECT experiment, created_at, description FROM experiments ORDER BY created_at DESC;"
            )
        )

    except Exception as e:
        publish_to_error_log(e, "get_experiments")
        return Response(status=400)


@app.route("/api/get_latest_experiment", methods=["GET"])
def get_latest_experiment():
    try:
        return jsonify(
            query_db(
                "SELECT experiment, created_at, description, media_used, organism_used, delta_hours FROM latest_experiment",
                one=True,
            )
        )

    except Exception as e:
        publish_to_error_log(e, "get_latest_experiment")
        return Response(status=400)


@app.route("/api/get_current_unit_labels", methods=["GET"])
def get_current_unit_labels():
    try:
        current_unit_labels = query_db(
            "SELECT r.pioreactor_unit as unit, r.label FROM pioreactor_unit_labels AS r JOIN latest_experiment USING (experiment);"
        )

        keyed_by_unit = {d["unit"]: d["label"] for d in current_unit_labels}

        return jsonify(keyed_by_unit)

    except Exception as e:
        publish_to_error_log(e, "get_current_unit_labels")
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

    return Response(status=204)


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

        # we want to make sure that this is published to MQTT
        msg = client.publish(
            "pioreactor/latest_experiment/experiment", body["experiment"], qos=2, retain=True
        )
        while msg.wait_for_publish(timeout=60):
            pass
        assert msg.is_published()
        client.publish(
            "pioreactor/latest_experiment/created_at", body["created_at"], qos=2, retain=True
        )

        return Response(status=200)

    except sqlite3.IntegrityError as e:
        publish_to_error_log(e, "create_experiment")
        return Response(status=400)
    except Exception as e:
        publish_to_error_log(e, "create_experiment")
        return Response(status=400)


@app.route("/api/update_experiment_desc", methods=["POST"])
def update_experiment_description():
    body = request.get_json()
    try:
        insert_into_db(
            "UPDATE experiments SET description = (?) WHERE experiment=(?)",
            (body["description"], body["experiment"]),
        )
        return Response(status=204)

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
        return Response(status=204)
    else:
        publish_to_error_log(msg, "add_new_pioreactor")
        return {"msg": msg}, 500


## CONFIG CONTROL


@app.route("/api/get_config/<filename>", methods=["GET"])
def get_config(filename: str):
    """get a specific config.ini file in the .pioreactor folder"""

    # security bit: strip out any paths that may be attached, ex: ../../../root/bad
    filename = Path(filename).name

    try:
        specific_config_path = Path(env["DOT_PIOREACTOR"]) / filename
        return specific_config_path.read_text()

    except Exception as e:
        publish_to_error_log(str(e), "get_config_of_file")
        return Response(status=400)


@app.route("/api/get_configs", methods=["GET"])
def get_configs():
    """get a list of all config.ini files in the .pioreactor folder"""
    try:
        config_path = Path(env["DOT_PIOREACTOR"])
        return jsonify([file.name for file in config_path.glob("config*.ini")])

    except Exception as e:
        publish_to_error_log(str(e), "get_configs")
        return Response(status=400)


@app.route("/api/delete_config", methods=["POST"])
def delete_config():
    """TODO: should this http be DELETE?"""

    body = request.get_json()
    filename = Path(body["filename"]).name  # remove any ../../ prefix stuff
    config_path = Path(env["DOT_PIOREACTOR"]) / filename

    background_tasks.rm(config_path)
    return Response(status=204)


@app.route("/api/save_new_config", methods=["POST"])
def save_new_config():
    """if the config file is unit specific, we only need to run sync-config on that unit."""

    body = request.get_json()
    filename, code = body["filename"], body["code"]

    if not filename.endswith(".ini"):
        return {"msg": "Incorrect filetype. Must be .ini."}, 400

    # security bit:
    # users could have filename look like ../../../../root/bad.txt
    # the below code will strip any paths.
    # General security risk here to save arbitrary file to OS.
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

        # test to make sure we have minimal code to run pio commands
        assert config["cluster.topology"]
        assert config.get("cluster.topology", "leader_hostname")
        assert config.get("cluster.topology", "leader_address")
    except configparser.DuplicateSectionError as e:
        msg = f"Duplicate section [{e.section}] was found."
        publish_to_error_log(msg, "save_new_config")
        return {"msg": msg}, 400
    except configparser.DuplicateOptionError as e:
        msg = f"Duplicate option {[e.option]} was found in section {[e.section]}."
        publish_to_error_log(msg, "save_new_config")
        return {"msg": msg}, 400
    except configparser.ParsingError:
        msg = "Incorrect syntax."
        publish_to_error_log(msg, "save_new_config")
        return {"msg": msg}, 400
    except (AssertionError, configparser.NoSectionError, KeyError, TypeError):
        msg = "Missing required fields in [cluster.topology]: `leader_hostname` and/or `leader_address` ."
        publish_to_error_log(msg, "save_new_config")
        return {"msg": msg}, 400
    except Exception as e:
        publish_to_error_log(str(e), "save_new_config")
        msg = "Hm, something went wrong, check PioreactorUI logs."
        return {"msg": msg}, 400

    result = background_tasks.write_config_and_sync(config_path, code, units, flags)

    try:
        status, msg_or_exception = result(blocking=True, timeout=60)
    except HueyException:
        status, msg_or_exception = False, "sync-configs timed out."

    if not status:
        publish_to_error_log(msg_or_exception, "save_new_config")
        return {"msg": str(msg_or_exception)}, 500

    return Response(status=204)


@app.route("/api/get_historical_configs/<filename>", methods=["GET"])
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
