# -*- coding: utf-8 -*-
from __future__ import annotations

import configparser
import os
import re
import sqlite3
import tempfile
from pathlib import Path
from typing import Any

from flask import abort
from flask import Blueprint
from flask import current_app
from flask import jsonify
from flask import request
from flask import Response
from flask.typing import ResponseReturnValue
from huey.api import Result
from huey.exceptions import HueyException
from msgspec import DecodeError
from msgspec import ValidationError
from msgspec.yaml import decode as yaml_decode
from pioreactor.config import get_leader_hostname
from pioreactor.experiment_profiles.profile_struct import Profile
from pioreactor.pubsub import get_from
from pioreactor.structs import Dataset
from pioreactor.utils.networking import resolve_to_address
from pioreactor.utils.timing import current_utc_datetime
from pioreactor.utils.timing import current_utc_timestamp
from pioreactor.whoami import UNIVERSAL_EXPERIMENT
from pioreactor.whoami import UNIVERSAL_IDENTIFIER
from werkzeug.utils import secure_filename

from . import client
from . import HOSTNAME
from . import modify_app_db
from . import msg_to_JSON
from . import publish_to_error_log
from . import publish_to_experiment_log
from . import publish_to_log
from . import query_app_db
from . import structs
from . import tasks
from .config import cache
from .config import env
from .config import is_testing_env
from .utils import create_task_response
from .utils import is_valid_unix_filename
from .utils import scrub_to_valid


api = Blueprint("api", __name__, url_prefix="/api")


def get_workers_in_experiment(experiment: str) -> list[str]:
    if experiment == UNIVERSAL_EXPERIMENT:
        r = query_app_db("SELECT pioreactor_unit FROM workers")
    else:
        r = query_app_db(
            "SELECT pioreactor_unit FROM experiment_worker_assignments WHERE experiment = ?",
            (experiment,),
        )
    assert isinstance(r, list)
    return [unit["pioreactor_unit"] for unit in r]


def get_all_workers() -> list[str]:
    result = query_app_db(
        """
        SELECT w.pioreactor_unit as unit
        FROM workers w
        ORDER BY w.added_at DESC
        """
    )
    assert result is not None and isinstance(result, list)
    return list(r["unit"] for r in result)


def broadcast_get_across_cluster(endpoint: str, timeout: float = 1.0) -> dict[str, Any]:
    assert endpoint.startswith("/unit_api")
    return tasks.multicast_get_across_cluster(endpoint, get_all_workers(), timeout=timeout)


def broadcast_post_across_cluster(endpoint: str, json: dict | None = None) -> Result:
    assert endpoint.startswith("/unit_api")
    return tasks.multicast_post_across_cluster(endpoint, get_all_workers(), json=json)


def broadcast_delete_across_cluster(endpoint: str, json: dict | None = None) -> Result:
    assert endpoint.startswith("/unit_api")
    return tasks.multicast_delete_across_cluster(endpoint, get_all_workers(), json=json)


def broadcast_patch_across_cluster(endpoint: str, json: dict | None = None) -> Result:
    assert endpoint.startswith("/unit_api")
    return tasks.multicast_patch_across_cluster(endpoint, get_all_workers(), json=json)


@api.route("/workers/jobs/stop/experiments/<experiment>", methods=["POST", "PATCH"])
def stop_all_jobs_in_experiment(experiment: str) -> ResponseReturnValue:
    """Kills all jobs for workers assigned to experiment"""
    workers_in_experiment = get_workers_in_experiment(experiment)
    tasks.multicast_post_across_cluster(
        f"/unit_api/jobs/stop/experiment/{experiment}", workers_in_experiment
    )

    # sometimes the leader isn't part of the experiment, but a profile associated with the experiment is running:
    tasks.pio_kill("--experiment", experiment)

    return Response(status=202)


@api.route(
    "/workers/<pioreactor_unit>/jobs/stop/experiments/<experiment>",
    methods=["POST", "PATCH"],
)
def stop_all_jobs_on_worker_for_experiment(
    pioreactor_unit: str, experiment: str
) -> ResponseReturnValue:
    """Kills all jobs for worker assigned to experiment"""
    if pioreactor_unit == UNIVERSAL_IDENTIFIER:
        broadcast_post_across_cluster(f"/unit_api/jobs/stop/experiment/{experiment}")
    else:
        tasks.multicast_post_across_cluster(
            f"/unit_api/jobs/stop/experiment/{experiment}", [pioreactor_unit]
        )

    return Response(status=202)


@api.route(
    "/workers/<pioreactor_unit>/jobs/stop/job_name/<job>/experiments/<experiment>",
    methods=["PATCH", "POST"],
)
@api.route(
    "/units/<pioreactor_unit>/jobs/stop/job_name/<job>/experiments/<experiment>",
    methods=["PATCH", "POST"],
)
def stop_job_on_unit(pioreactor_unit: str, experiment: str, job: str) -> ResponseReturnValue:
    """Kills specified job on unit"""

    msg = client.publish(
        f"pioreactor/{pioreactor_unit}/{experiment}/{job}/$state/set", b"disconnected", qos=1
    )
    try:
        msg.wait_for_publish(timeout=2.0)
    except Exception:
        tasks.multicast_post_across_cluster(
            f"/unit_api/jobs/stop/job_name/{job}", [pioreactor_unit]
        )
        return Response(status=500)

    return Response(status=202)


@api.route(
    "/workers/<pioreactor_unit>/jobs/run/job_name/<job>/experiments/<experiment>",
    methods=["PATCH", "POST"],
)
@api.route(
    "/units/<pioreactor_unit>/jobs/run/job_name/<job>/experiments/<experiment>",
    methods=["PATCH", "POST"],
)
def run_job_on_unit_in_experiment(
    pioreactor_unit: str, experiment: str, job: str
) -> ResponseReturnValue:
    """
    Runs specified job on unit.

    The body is passed to the CLI, and should look like:

    {
      "options": {
        "option1": "value1",
        "option2": "value2"
      },
      "env": {}, # JOB_SOURCE or EXPERIMENT optional
      "args": ["arg1", "arg2"]
    }
    """
    json = current_app.get_json(request.data, type=structs.ArgsOptionsEnvs)

    if pioreactor_unit == UNIVERSAL_IDENTIFIER:
        # make sure the worker is active, too
        workers = query_app_db(
            """
            SELECT a.pioreactor_unit as worker
            FROM experiment_worker_assignments a
            JOIN workers w
               on w.pioreactor_unit = a.pioreactor_unit
            WHERE experiment = ? and w.is_active = 1
            """,
            (experiment,),
        )
        assert isinstance(workers, list)
        assigned_workers = [w["worker"] for w in workers]

    else:
        # check if worker is part of experiment

        okay = query_app_db(
            """
            SELECT count(1) as count
            FROM experiment_worker_assignments a
            JOIN workers w
               on w.pioreactor_unit = a.pioreactor_unit
            WHERE a.experiment = ? AND w.pioreactor_unit = ? AND w.is_active = 1
            """,
            (experiment, pioreactor_unit),
            one=True,
        )
        assert isinstance(okay, dict)
        if okay["count"] < 1:
            assigned_workers = []
        else:
            assigned_workers = [pioreactor_unit]

    if len(assigned_workers) == 0:
        return Response(status=404)

    # and we can include experiment in the env since we know these workers are in the experiment!
    json.env = json.env | {"EXPERIMENT": experiment, "ACTIVE": "1"}

    t = tasks.multicast_post_across_cluster(
        f"/unit_api/jobs/run/job_name/{job}", assigned_workers, json=json
    )
    return create_task_response(t)


@api.route("/units/<pioreactor_unit>/jobs/running", methods=["GET"])
@api.route("/workers/<pioreactor_unit>/jobs/running", methods=["GET"])
def get_running_jobs_on_unit(pioreactor_unit: str) -> ResponseReturnValue:
    try:
        return get_from(resolve_to_address(pioreactor_unit), "/unit_api/jobs/running").json()
    except Exception:
        return Response(status=502)


@api.route("/workers/<pioreactor_unit>/blink", methods=["POST"])
def blink_worker(pioreactor_unit: str) -> ResponseReturnValue:
    msg = client.publish(
        f"pioreactor/{pioreactor_unit}/{UNIVERSAL_EXPERIMENT}/monitor/flicker_led_response_okay",
        1,
        qos=0,
    )
    msg.wait_for_publish(timeout=2.0)
    return Response(status=202)


@api.route(
    "/workers/<pioreactor_unit>/jobs/update/job_name/<job>/experiments/<experiment>",
    methods=["PATCH"],
)
@api.route(
    "/units/<pioreactor_unit>/jobs/update/job_name/<job>/experiments/<experiment>",
    methods=["PATCH"],
)
def update_job_on_unit(pioreactor_unit: str, experiment: str, job: str) -> ResponseReturnValue:
    """
    Update specified job on unit. Use $broadcast for everyone.

    The body should look like:

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


@api.route("/units/<pioreactor_unit>/system/reboot", methods=["POST"])
def reboot_unit(pioreactor_unit: str) -> ResponseReturnValue:
    """Reboots unit"""
    if pioreactor_unit == UNIVERSAL_IDENTIFIER:
        task = broadcast_post_across_cluster("/unit_api/system/reboot")
    else:
        task = tasks.multicast_post_across_cluster("/unit_api/system/reboot", [pioreactor_unit])
    return create_task_response(task)


@api.route("/units/<pioreactor_unit>/system/shutdown", methods=["POST"])
def shutdown_unit(pioreactor_unit: str) -> ResponseReturnValue:
    """Shutdown unit"""
    if pioreactor_unit == UNIVERSAL_IDENTIFIER:
        task = broadcast_post_across_cluster("/unit_api/system/shutdown")
    else:
        task = tasks.multicast_post_across_cluster("/unit_api/system/shutdown", [pioreactor_unit])
    return create_task_response(task)


@api.route("/workers/system/reboot", methods=["POST"])
def reboot_units() -> ResponseReturnValue:
    """Reboots workers"""
    return create_task_response(broadcast_post_across_cluster("/unit_api/system/reboot"))


@api.route("/workers/system/shutdown", methods=["POST"])
def shutdown_units() -> ResponseReturnValue:
    """Shutdown workers"""
    return create_task_response(broadcast_post_across_cluster("/unit_api/system/shutdown"))


## Logs


# util
def get_level_string(min_level: str) -> str:
    levels = {
        "DEBUG": ["ERROR", "WARNING", "NOTICE", "INFO", "DEBUG"],
        "INFO": ["ERROR", "NOTICE", "INFO", "WARNING"],
        "WARNING": ["ERROR", "WARNING"],
        "ERROR": ["ERROR"],
    }
    selected_levels = levels.get(min_level, levels["INFO"])
    return " or ".join(f'level == "{level}"' for level in selected_levels)


@api.route("/experiments/<experiment>/recent_logs", methods=["GET"])
def get_recent_logs(experiment: str) -> ResponseReturnValue:
    """Shows event logs from all units"""

    min_level = request.args.get("min_level", "INFO")

    try:
        recent_logs = query_app_db(
            f"""SELECT l.timestamp, level, l.pioreactor_unit, message, task, l.experiment
                FROM logs AS l
                WHERE (l.experiment=? OR l.experiment=?)
                    AND ({get_level_string(min_level)})
                    AND l.timestamp >= MAX( STRFTIME('%Y-%m-%dT%H:%M:%f000Z', 'NOW', '-24 hours'), (SELECT created_at FROM experiments where experiment=?) )
                ORDER BY l.timestamp DESC LIMIT 50;""",
            (experiment, UNIVERSAL_EXPERIMENT, experiment),
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_recent_logs")
        return Response(status=500)

    return jsonify(recent_logs)


@api.route("/experiments/<experiment>/logs", methods=["GET"])
def get_exp_logs(experiment: str) -> ResponseReturnValue:
    """Shows event logs from all units, uses pagination."""

    skip = int(request.args.get("skip", 0))

    try:
        recent_logs = query_app_db(
            f"""SELECT l.timestamp, level, l.pioreactor_unit, message, task, l.experiment
                FROM logs AS l
                JOIN experiment_worker_assignments_history h
                   on h.pioreactor_unit = l.pioreactor_unit
                   and h.assigned_at <= l.timestamp
                   and l.timestamp <= coalesce(h.unassigned_at, STRFTIME('%Y-%m-%dT%H:%M:%f000Z', 'NOW'))
                WHERE (l.experiment=? OR l.experiment=?)
                ORDER BY l.timestamp DESC LIMIT 50 OFFSET {skip};""",
            (experiment, UNIVERSAL_EXPERIMENT),
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_exp_logs")
        return Response(status=500)

    return jsonify(recent_logs)


@api.route("/logs", methods=["GET"])
def get_logs() -> ResponseReturnValue:
    """Shows event logs from all units, uses pagination."""

    skip = int(request.args.get("skip", 0))

    try:
        recent_logs = query_app_db(
            f"""SELECT l.timestamp, level, l.pioreactor_unit, message, task, l.experiment
                FROM logs AS l
                ORDER BY l.timestamp DESC LIMIT 50 OFFSET {skip};"""
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_logs")
        return Response(status=500)

    return jsonify(recent_logs)


@api.route("/experiments/<experiment>/logs", methods=["POST"])
def publish_new_log(experiment: str) -> ResponseReturnValue:
    body = request.get_json()
    topic = f"pioreactor/{body['pioreactor_unit']}/{experiment}/logs/ui/info"
    client.publish(
        topic,
        msg_to_JSON(
            msg=body["message"],
            source="user",
            level="info",
            timestamp=body["timestamp"],
            task=body["source"] or "",
        ),
    )
    return Response(status=202)


@api.route("/workers/<pioreactor_unit>/experiments/<experiment>/recent_logs", methods=["GET"])
def get_recent_logs_for_unit_and_experiment(
    pioreactor_unit: str, experiment: str
) -> ResponseReturnValue:
    """Shows event logs for a specific unit within an experiment"""

    min_level = request.args.get("min_level", "INFO")

    try:
        recent_logs = query_app_db(
            f"""SELECT l.timestamp, level, l.pioreactor_unit, message, task, l.experiment
                FROM logs AS l
                WHERE (l.experiment=? OR l.experiment=?)
                    AND (l.pioreactor_unit=? or l.pioreactor_unit=?)
                    AND ({get_level_string(min_level)})
                    AND l.timestamp >= MAX( STRFTIME('%Y-%m-%dT%H:%M:%f000Z', 'NOW', '-24 hours'), (SELECT created_at FROM experiments where experiment=?) )
                ORDER BY l.timestamp DESC LIMIT 50;""",
            (experiment, UNIVERSAL_EXPERIMENT, pioreactor_unit, UNIVERSAL_IDENTIFIER, experiment),
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_recent_logs_for_unit_and_experiment")
        return Response(status=500)

    return jsonify(recent_logs)


@api.route("/units/<pioreactor_unit>/experiments/<experiment>/logs", methods=["GET"])
def get_logs_for_unit_and_experiment(pioreactor_unit: str, experiment: str) -> ResponseReturnValue:
    """Shows event logs from all units, uses pagination."""

    skip = int(request.args.get("skip", 0))

    try:
        recent_logs = query_app_db(
            f"""SELECT l.timestamp, level, l.pioreactor_unit, message, task, l.experiment
                FROM logs AS l
                JOIN experiment_worker_assignments_history h
                   on h.pioreactor_unit = l.pioreactor_unit
                   and h.assigned_at <= l.timestamp
                   and l.timestamp <= coalesce(h.unassigned_at, STRFTIME('%Y-%m-%dT%H:%M:%f000Z', 'NOW') )
                WHERE (l.experiment=? or l.experiment=?)
                    AND (l.pioreactor_unit=? or l.pioreactor_unit=?)
                ORDER BY l.timestamp DESC LIMIT 50 OFFSET {skip};""",
            (experiment, UNIVERSAL_EXPERIMENT, pioreactor_unit, UNIVERSAL_IDENTIFIER),
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_for_unit_and_experiment")
        return Response(status=500)

    return jsonify(recent_logs)


@api.route("/units/<pioreactor_unit>/logs", methods=["GET"])
def get_logs_for_unit(pioreactor_unit: str) -> ResponseReturnValue:
    """Shows event logs from all units, uses pagination."""

    skip = int(request.args.get("skip", 0))

    try:
        recent_logs = query_app_db(
            f"""SELECT l.timestamp, level, l.pioreactor_unit, message, task, l.experiment
                FROM logs AS l
                WHERE (l.pioreactor_unit=? or l.pioreactor_unit=?)
                ORDER BY l.timestamp DESC LIMIT 50 OFFSET {skip};""",
            (pioreactor_unit, UNIVERSAL_IDENTIFIER),
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_logs_for_unit")
        return Response(status=500)

    return jsonify(recent_logs)


## Time series data


@api.route("/experiments/<experiment>/time_series/growth_rates", methods=["GET"])
def get_growth_rates(experiment: str) -> ResponseReturnValue:
    """Gets growth rates for all units"""
    args = request.args
    filter_mod_n = float(args.get("filter_mod_N", 100.0))
    lookback = float(args.get("lookback", 4.0))

    try:
        growth_rates = query_app_db(
            """
            SELECT
                json_object('series', json_group_array(unit), 'data', json_group_array(json(data))) as result
            FROM (
                SELECT pioreactor_unit as unit,
                       json_group_array(json_object('x', timestamp, 'y', round(rate, 5))) as data
                FROM growth_rates
                WHERE experiment=? AND
                      ((ROWID * 0.61803398875) - cast(ROWID * 0.61803398875 as int) < 1.0/?) AND
                      timestamp > STRFTIME('%Y-%m-%dT%H:%M:%f000Z', 'NOW', ?)
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


@api.route("/experiments/<experiment>/time_series/temperature_readings", methods=["GET"])
def get_temperature_readings(experiment: str) -> ResponseReturnValue:
    """Gets temperature readings for all units"""
    args = request.args
    filter_mod_n = float(args.get("filter_mod_N", 100.0))
    lookback = float(args.get("lookback", 4.0))

    try:
        temperature_readings = query_app_db(
            """
            SELECT json_object('series', json_group_array(unit), 'data', json_group_array(json(data))) as result
            FROM (
                SELECT
                    pioreactor_unit as unit,
                    json_group_array(json_object('x', timestamp, 'y', round(temperature_c, 2))) as data
                FROM temperature_readings
                WHERE experiment=? AND
                    ((ROWID * 0.61803398875) - cast(ROWID * 0.61803398875 as int) < 1.0/?) AND
                    timestamp > STRFTIME('%Y-%m-%dT%H:%M:%f000Z', 'NOW' , ?)
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


@api.route("/experiments/<experiment>/time_series/od_readings_filtered", methods=["GET"])
def get_od_readings_filtered(experiment: str) -> ResponseReturnValue:
    """Gets normalized od for all units"""
    args = request.args
    filter_mod_n = float(args.get("filter_mod_N", 100.0))
    lookback = float(args.get("lookback", 4.0))

    try:
        filtered_od_readings = query_app_db(
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
                    timestamp > STRFTIME('%Y-%m-%dT%H:%M:%f000Z', 'NOW', ?)
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


@api.route("/experiments/<experiment>/time_series/od_readings", methods=["GET"])
def get_od_readings(experiment: str) -> ResponseReturnValue:
    """Gets raw od for all units"""
    args = request.args
    filter_mod_n = float(args.get("filter_mod_N", 100.0))
    lookback = float(args.get("lookback", 4.0))

    try:
        raw_od_readings = query_app_db(
            """
            SELECT
                json_object('series', json_group_array(unit), 'data', json_group_array(json(data))) as result
            FROM (
                SELECT pioreactor_unit || '-' || channel as unit, json_group_array(json_object('x', timestamp, 'y', round(od_reading, 7))) as data
                FROM od_readings
                WHERE experiment=? AND
                    ((ROWID * 0.61803398875) - cast(ROWID * 0.61803398875 as int) < 1.0/?) AND
                    timestamp > STRFTIME('%Y-%m-%dT%H:%M:%f000Z', 'NOW',  ?)
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


@api.route("/experiments/<experiment>/time_series/<data_source>/<column>", methods=["GET"])
def get_fallback_time_series(data_source: str, experiment: str, column: str) -> ResponseReturnValue:
    args = request.args
    try:
        lookback = float(args.get("lookback", 4.0))
        data_source = scrub_to_valid(data_source)
        column = scrub_to_valid(column)
        r = query_app_db(
            f"SELECT json_object('series', json_group_array(unit), 'data', json_group_array(json(data))) as result FROM (SELECT pioreactor_unit as unit, json_group_array(json_object('x', timestamp, 'y', round({column}, 7))) as data FROM {data_source} WHERE experiment=? AND timestamp > STRFTIME('%Y-%m-%dT%H:%M:%f000Z', 'NOW',?) and {column} IS NOT NULL GROUP BY 1);",
            (experiment, f"-{lookback} hours"),
            one=True,
        )
        assert isinstance(r, dict)

    except Exception as e:
        publish_to_error_log(str(e), "get_fallback_time_series")
        return Response(status=400)
    return r["result"]


@api.route("/experiments/<experiment>/media_rates", methods=["GET"])
def get_media_rates(experiment: str) -> ResponseReturnValue:
    """
    Shows amount of added media per unit. Note that it only consider values from a dosing automation (i.e. not manual dosing, which includes continously dose)

    """
    ## this one confusing

    try:
        rows = query_app_db(
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


@api.route("/workers/<pioreactor_unit>/calibrations", methods=["GET"])
def get_all_calibrations(pioreactor_unit) -> ResponseReturnValue:
    if pioreactor_unit == UNIVERSAL_IDENTIFIER:
        task = broadcast_get_across_cluster("/unit_api/calibrations")
    else:
        task = tasks.multicast_get_across_cluster("/unit_api/calibrations", [pioreactor_unit])
    return create_task_response(task)


@api.route("/workers/<pioreactor_unit>/calibrations/<cal_type>", methods=["GET"])
def get_calibrations(pioreactor_unit, cal_type) -> ResponseReturnValue:
    if pioreactor_unit == UNIVERSAL_IDENTIFIER:
        task = broadcast_get_across_cluster(f"/unit_api/calibrations/{cal_type}")
    else:
        task = tasks.multicast_get_across_cluster(
            f"/unit_api/calibrations/{cal_type}", [pioreactor_unit]
        )
    return create_task_response(task)


@api.route(
    "/workers/<pioreactor_unit>/calibrations/<cal_type>/<cal_name>/active", methods=["PATCH"]
)
def set_active_calibration(pioreactor_unit, cal_type, cal_name) -> ResponseReturnValue:
    if pioreactor_unit == UNIVERSAL_IDENTIFIER:
        task = broadcast_patch_across_cluster(
            f"/unit_api/calibrations/{cal_type}/{cal_name}/active"
        )
    else:
        task = tasks.multicast_patch_across_cluster(
            f"/unit_api/calibrations/{cal_type}/{cal_name}/active", [pioreactor_unit]
        )
    return create_task_response(task)


@api.route("/workers/<pioreactor_unit>/calibrations/<cal_type>/active", methods=["DELETE"])
def remove_active_status_calibration(pioreactor_unit, cal_type) -> ResponseReturnValue:
    if pioreactor_unit == UNIVERSAL_IDENTIFIER:
        task = broadcast_delete_across_cluster(f"/unit_api/calibrations/{cal_type}/active")
    else:
        task = tasks.multicast_delete_across_cluster(
            f"/unit_api/calibrations/{cal_type}/active", [pioreactor_unit]
        )
    return create_task_response(task)


@api.route("/workers/<pioreactor_unit>/calibrations/<cal_type>/<cal_name>", methods=["DELETE"])
def remove_calibration(pioreactor_unit, cal_type, cal_name) -> ResponseReturnValue:
    if pioreactor_unit == UNIVERSAL_IDENTIFIER:
        task = broadcast_delete_across_cluster(f"/unit_api/calibrations/{cal_type}/{cal_name}")
    else:
        task = tasks.multicast_delete_across_cluster(
            f"/unit_api/calibrations/{cal_type}/{cal_name}", [pioreactor_unit]
        )
    return create_task_response(task)


## PLUGINS


@api.route("/units/<pioreactor_unit>/plugins/installed", methods=["GET"])
def get_plugins_on_machine(pioreactor_unit: str) -> ResponseReturnValue:
    if pioreactor_unit == UNIVERSAL_IDENTIFIER:
        task = broadcast_get_across_cluster("/unit_api/plugins/installed", timeout=5)
    else:
        task = tasks.multicast_get_across_cluster(
            "/unit_api/plugins/installed", [pioreactor_unit], timeout=5
        )

    return create_task_response(task)


@api.route("/plugins/install", methods=["POST", "PATCH"])
def install_plugin_across_cluster() -> ResponseReturnValue:
    # there is a security problem here. See https://github.com/Pioreactor/pioreactor/issues/421
    if os.path.isfile(Path(env["DOT_PIOREACTOR"]) / "DISALLOW_UI_INSTALLS"):
        return Response(status=403)

    return create_task_response(
        broadcast_post_across_cluster("/unit_api/plugins/install", request.get_json())
    )


@api.route("/plugins/uninstall", methods=["POST", "PATCH"])
def uninstall_plugin_across_cluster() -> ResponseReturnValue:
    return create_task_response(
        broadcast_post_across_cluster("/unit_api/plugins/uninstall", request.get_json())
    )


@api.route("/jobs/running", methods=["GET"])
def get_jobs_running_across_cluster() -> ResponseReturnValue:
    return create_task_response(broadcast_get_across_cluster("/unit_api/jobs/running"))


@api.route("/jobs/running/experiments/<experiment>", methods=["GET"])
def get_jobs_running_across_cluster_in_experiment(experiment) -> ResponseReturnValue:
    list_of_assigned_workers = get_workers_in_experiment(experiment)

    return create_task_response(
        tasks.multicast_get_across_cluster("/unit_api/jobs/running", list_of_assigned_workers)
    )


### SETTINGS


@api.route("/experiments/<experiment>/jobs/settings/job_name/<job_name>", methods=["GET"])
def get_settings_for_job_across_cluster_in_experiment(experiment, job_name) -> ResponseReturnValue:
    list_of_assigned_workers = get_workers_in_experiment(experiment)
    return create_task_response(
        tasks.multicast_get_across_cluster(
            f"/unit_api/jobs/settings/job_name/{job_name}", list_of_assigned_workers
        )
    )


@api.route(
    "/experiments/<experiment>/jobs/settings/job_name/<job_name>/setting/<setting>", methods=["GET"]
)
def get_setting_for_job_across_cluster_in_experiment(
    experiment, job_name, setting
) -> ResponseReturnValue:
    list_of_assigned_workers = get_workers_in_experiment(experiment)
    return create_task_response(
        tasks.multicast_get_across_cluster(
            f"/unit_api/jobs/settings/job_name/{job_name}/setting/{setting}",
            list_of_assigned_workers,
        )
    )


@api.route("/workers/<pioreactor_unit>/jobs/settings/job_name/<job_name>", methods=["GET"])
def get_job_settings_for_worker(pioreactor_unit, job_name) -> ResponseReturnValue:
    if pioreactor_unit == UNIVERSAL_IDENTIFIER:
        task = broadcast_get_across_cluster(f"/unit_api/jobs/settings/job_name/{job_name}")
    else:
        task = tasks.multicast_get_across_cluster(
            f"/unit_api/jobs/settings/job_name/{job_name}", [pioreactor_unit]
        )
    return create_task_response(task)


@api.route(
    "/workers/<pioreactor_unit>/jobs/settings/job_name/<job_name>/setting/<setting>",
    methods=["GET"],
)
def get_job_setting_for_worker(pioreactor_unit, job_name, setting) -> ResponseReturnValue:
    if pioreactor_unit == UNIVERSAL_IDENTIFIER:
        task = broadcast_get_across_cluster(
            f"/unit_api/jobs/settings/job_name/{job_name}/setting/{setting}"
        )
    else:
        task = tasks.multicast_get_across_cluster(
            f"/unit_api/jobs/settings/job_name/{job_name}/setting/{setting}", [pioreactor_unit]
        )
    return create_task_response(task)


## MISC


@api.route("/versions/app", methods=["GET"])
def get_app_versions_across_cluster() -> ResponseReturnValue:
    return create_task_response(broadcast_get_across_cluster("/unit_api/versions/app"))


@api.route("/versions/ui", methods=["GET"])
def get_ui_versions_across_cluster() -> ResponseReturnValue:
    return create_task_response(broadcast_get_across_cluster("/unit_api/versions/ui"))


## UPLOADS


@api.route("/system/upload", methods=["POST"])
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

    filename = secure_filename(file.filename)
    save_path = os.path.join(tempfile.gettempdir(), filename)
    file.save(save_path)
    return jsonify({"message": "File successfully uploaded", "save_path": save_path}), 200


@api.route("/contrib/automations/<automation_type>", methods=["GET"])
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
            response=current_app.json.dumps(list(parsed_yaml.values())),
            status=200,
            mimetype="application/json",
            headers={"Cache-Control": "public,max-age=/"},
        )
    except Exception as e:
        publish_to_error_log(str(e), "get_automation_contrib")
        return Response(status=400)


@api.route("/contrib/jobs", methods=["GET"])
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
            response=current_app.json.dumps(list(parsed_yaml.values())),
            status=200,
            mimetype="application/json",
            headers={"Cache-Control": "public,max-age=10"},
        )
    except Exception as e:
        publish_to_error_log(str(e), "get_job_contrib")
        return Response(status=400)


@api.route("/contrib/charts", methods=["GET"])
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
            response=current_app.json.dumps(list(parsed_yaml.values())),
            status=200,
            mimetype="application/json",
            headers={"Cache-Control": "public,max-age=10"},
        )
    except Exception as e:
        publish_to_error_log(str(e), "get_charts_contrib")
        return Response(status=400)


@api.route("/system/update_next_version", methods=["POST"])
def update_app() -> ResponseReturnValue:
    task = tasks.update_app_across_cluster()
    return create_task_response(task)


@api.route("/system/update_from_archive", methods=["POST"])
def update_app_from_release_archive() -> ResponseReturnValue:
    body = request.get_json()
    release_archive_location = body["release_archive_location"]
    assert release_archive_location.endswith(".zip")
    task = tasks.update_app_from_release_archive_across_cluster(release_archive_location)
    return create_task_response(task)


@api.route("/contrib/exportable_datasets", methods=["GET"])
def get_exportable_datasets() -> ResponseReturnValue:
    try:
        builtins = sorted((Path(env["DOT_PIOREACTOR"]) / "exportable_datasets").glob("*.y*ml"))
        plugins = sorted(
            (Path(env["DOT_PIOREACTOR"]) / "plugins" / "exportable_datasets").glob("*.y*ml")
        )
        parsed_yaml = []
        for file in builtins + plugins:
            try:
                dataset = yaml_decode(file.read_bytes(), type=Dataset)
                parsed_yaml.append(dataset)
            except (ValidationError, DecodeError) as e:
                publish_to_error_log(
                    f"Yaml error in {Path(file).name}: {e}", "get_exportable_datasets"
                )

        return Response(
            response=current_app.json.dumps(parsed_yaml),
            status=200,
            mimetype="application/json",
            headers={"Cache-Control": "public,max-age=60"},
        )
    except Exception as e:
        publish_to_error_log(str(e), "get_exportable_datasets")
        return Response(status=400)


@api.route("/contrib/exportable_datasets/<target_dataset>/preview", methods=["GET"])
def preview_exportable_datasets(target_dataset) -> ResponseReturnValue:
    builtins = sorted((Path(env["DOT_PIOREACTOR"]) / "exportable_datasets").glob("*.y*ml"))
    plugins = sorted(
        (Path(env["DOT_PIOREACTOR"]) / "plugins" / "exportable_datasets").glob("*.y*ml")
    )

    n_rows = request.args.get("n_rows", 5)

    for file in builtins + plugins:
        try:
            dataset = yaml_decode(file.read_bytes(), type=Dataset)
            if dataset.dataset_name == target_dataset:
                query = f"SELECT * FROM ({dataset.table or dataset.query}) LIMIT {n_rows};"
                result = query_app_db(query)
                return jsonify(result)
        except (ValidationError, DecodeError):
            pass
    return Response(status=404)


@api.route("/export_datasets", methods=["POST"])
def export_datasets() -> ResponseReturnValue:
    body = request.get_json()

    other_options: list[str] = []
    cmd_tables: list[str] = sum(
        [["--dataset-name", dataset_name] for dataset_name in body["selectedDatasets"]],
        [],
    )

    experiments: list[str] = body["experimentSelection"]
    partition_by_unit: bool = body["partitionByUnitSelection"]
    partition_by_experiment: bool = body["partitionByExperimentSelection"]

    if partition_by_unit:
        other_options += ["--partition-by-unit"]

    if partition_by_experiment:
        other_options += ["--partition-by-experiment"]

    timestamp = current_utc_datetime().strftime("%Y%m%d%H%M%S")
    filename = f"export_{timestamp}.zip"

    if experiments[0] == "<All experiments>":
        experiment_options: list[str] = []
    else:
        experiment_options = sum((["--experiment", experiment] for experiment in experiments), [])

    filename_with_path = Path("/var/www/pioreactorui/static/exports") / filename
    result = tasks.pio_run_export_experiment_data(  # uses a lock so multiple exports can't happen simultaneously.
        "--output", filename_with_path.as_posix(), *cmd_tables, *experiment_options, *other_options
    )
    try:
        status = result(blocking=True, timeout=5 * 60)
    except HueyException:
        status = False
        return {"result": status, "filename": None, "msg": "Timed out"}, 500

    if not status:
        publish_to_error_log("Failed.", "export_datasets")
        return {"result": status, "filename": None, "msg": "Failed."}, 500

    return {"result": status, "filename": filename, "msg": "Finished"}, 200


@api.route("/experiments", methods=["GET"])
@cache.memoize(expire=60, tag="experiments")
def get_experiments() -> ResponseReturnValue:
    try:
        response = jsonify(
            query_app_db(
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


@api.route("/experiments", methods=["POST"])
def create_experiment() -> ResponseReturnValue:
    cache.evict("experiments")
    cache.evict("unit_labels")

    body = request.get_json()
    proposed_experiment_name = body.get("experiment")

    if not proposed_experiment_name:
        return Response(status=400)
    elif len(proposed_experiment_name) >= 200:  # just too big
        return Response(status=400)
    elif proposed_experiment_name.lower() == "current":  # too much API rework
        return Response(status=400)
    elif proposed_experiment_name.startswith("_testing_"):  # jobs won't run as expected
        return Response(status=400)
    elif (
        ("#" in proposed_experiment_name)
        or ("+" in proposed_experiment_name)
        or ("$" in proposed_experiment_name)
        or ("/" in proposed_experiment_name)
        or ("%" in proposed_experiment_name)
        or ("\\" in proposed_experiment_name)
    ):
        return Response(status=400)

    try:
        row_count = modify_app_db(
            "INSERT INTO experiments (created_at, experiment, description, media_used, organism_used) VALUES (?,?,?,?,?)",
            (
                current_utc_timestamp(),
                proposed_experiment_name,
                body.get("description"),
                body.get("mediaUsed"),
                body.get("organismUsed"),
            ),
        )

        if row_count == 0:
            raise sqlite3.IntegrityError()

        publish_to_experiment_log(
            f"New experiment created: {body['experiment']}",
            proposed_experiment_name,
            "create_experiment",
            level="INFO",
        )
        return Response(status=201)

    except sqlite3.IntegrityError:
        return Response(status=409)
    except Exception as e:
        publish_to_error_log(str(e), "create_experiment")
        return Response(status=500)


@api.route("/experiments/<experiment>", methods=["DELETE"])
def delete_experiment(experiment: str) -> ResponseReturnValue:
    cache.evict("experiments")
    row_count = modify_app_db("DELETE FROM experiments WHERE experiment=?;", (experiment,))
    broadcast_post_across_cluster(f"/unit_api/jobs/stop/experiment/{experiment}")

    if row_count > 0:
        return Response(status=200)
    else:
        return Response(status=404)
    pass


@api.route("/experiments/latest", methods=["GET"])
@cache.memoize(expire=30, tag="experiments")
def get_latest_experiment() -> ResponseReturnValue:
    try:
        return Response(
            response=current_app.json.dumps(
                query_app_db(
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


@api.route("/experiments/<experiment>/unit_labels", methods=["GET"])
def get_unit_labels(experiment: str) -> ResponseReturnValue:
    try:
        if experiment == "current":
            unit_labels = query_app_db(
                "SELECT r.pioreactor_unit as unit, r.label FROM pioreactor_unit_labels AS r JOIN latest_experiment USING (experiment);"
            )
        else:
            unit_labels = query_app_db(
                "SELECT r.pioreactor_unit as unit, r.label FROM pioreactor_unit_labels as r WHERE experiment=?;",
                (experiment,),
            )

        assert isinstance(unit_labels, list)

        keyed_by_unit = {d["unit"]: d["label"] for d in unit_labels}

        return Response(
            response=current_app.json.dumps(keyed_by_unit),
            status=200,
            headers={"Cache-Control": "public,max-age=10"},
            mimetype="application/json",
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_unit_labels")
        return Response(status=500)


@api.route("/experiments/<experiment>/unit_labels", methods=["PUT", "PATCH"])
def upsert_unit_labels(experiment: str) -> ResponseReturnValue:
    """
    Update or insert a new unit label for the current experiment.


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

    """

    body = request.get_json()

    unit = body["unit"]
    label = body["label"]

    try:
        if (
            label == ""
        ):  # empty string, eg they are removing the label. We can't use the upsert below since then multiple workers are assigned "" and our unique constraint prevents that.
            modify_app_db(
                "DELETE FROM pioreactor_unit_labels WHERE experiment=(?) AND pioreactor_unit = (?)",
                (experiment, unit),
            )
        else:
            modify_app_db(
                "INSERT OR REPLACE INTO pioreactor_unit_labels (label, experiment, pioreactor_unit, created_at) VALUES ((?), (?), (?), STRFTIME('%Y-%m-%dT%H:%M:%f000Z', 'NOW') ) ON CONFLICT(experiment, pioreactor_unit) DO UPDATE SET label=excluded.label, created_at=STRFTIME('%Y-%m-%dT%H:%M:%f000Z', 'NOW')",
                (label, experiment, unit),
            )

    except Exception as e:
        publish_to_error_log(str(e), "upsert_current_unit_labels")
        return Response(status=400)

    return Response(status=201)


@api.route("/historical_organisms", methods=["GET"])
def get_historical_organisms_used() -> ResponseReturnValue:
    try:
        historical_organisms = query_app_db(
            'SELECT DISTINCT organism_used as key FROM experiments WHERE NOT (organism_used IS NULL OR organism_used == "") ORDER BY created_at DESC;'
        )

    except Exception as e:
        publish_to_error_log(str(e), "historical_organisms")
        return Response(status=500)

    return jsonify(historical_organisms)


@api.route("/historical_media", methods=["GET"])
def get_historical_media_used() -> ResponseReturnValue:
    try:
        historical_media = query_app_db(
            'SELECT DISTINCT media_used as key FROM experiments WHERE NOT (media_used IS NULL OR media_used == "") ORDER BY created_at DESC;'
        )

    except Exception as e:
        publish_to_error_log(str(e), "historical_media")
        return Response(status=500)

    return jsonify(historical_media)


@api.route("/experiments/<experiment>", methods=["PATCH"])
def update_experiment(experiment: str) -> ResponseReturnValue:
    cache.evict("experiments")

    body = request.get_json()
    try:
        if "description" in body:
            row_count = modify_app_db(
                "UPDATE experiments SET description = (?) WHERE experiment=(?)",
                (body["description"], experiment),
            )

            if row_count == 1:
                return Response(status=200)
            else:
                return Response(status=404)
        else:
            return Response(status=400)

    except Exception as e:
        publish_to_error_log(str(e), "update_experiment")
        return Response(status=500)


@api.route("/experiments/<experiment>", methods=["GET"])
def get_experiment(experiment: str) -> ResponseReturnValue:
    try:
        result = query_app_db(
            """SELECT experiment, created_at, description, round( (strftime("%s","now") - strftime("%s", created_at))/60/60, 0) as delta_hours
            FROM experiments
            WHERE experiment=(?)
            ;
            """,
            (experiment,),
            one=True,
        )
        if result is not None:
            return jsonify(result)
        else:
            return Response(status=404)

    except Exception as e:
        publish_to_error_log(str(e), "get_experiments")
        return Response(status=500)


## CONFIG CONTROL


@api.route("/configs/<filename>", methods=["GET"])
@cache.memoize(expire=30, tag="config")
def get_config(filename: str) -> ResponseReturnValue:
    """get a specific config.ini file in the .pioreactor folder"""

    if filename == "config.ini" and is_testing_env():
        filename = "config.dev.ini"

    # security bit: strip out any paths that may be attached, ex: ../../../root/bad
    filename = Path(filename).name

    try:
        if Path(filename).suffix != ".ini":
            abort(404)

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


@api.route("/configs", methods=["GET"])
@cache.memoize(expire=60, tag="config")
def get_configs() -> ResponseReturnValue:
    """get a list of all config.ini files in the .pioreactor folder, _and_ are part of the inventory _or_ are leader"""

    all_workers = query_app_db("SELECT pioreactor_unit FROM workers;")
    assert isinstance(all_workers, list)
    workers_bucket = {worker["pioreactor_unit"] for worker in all_workers}
    leader_bucket = {
        get_leader_hostname()
    }  # should be same as current HOSTNAME since this runs on the leader.
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


@api.route("/configs/<filename>", methods=["PATCH"])
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
        units = UNIVERSAL_IDENTIFIER
        flags = "--shared"

    # General security risk here to save arbitrary file to OS.
    config_path = Path(env["DOT_PIOREACTOR"]) / filename

    # can the config actually be read? ex. no repeating sections, typos, etc.
    # filename is a string
    config = configparser.ConfigParser(allow_no_value=True)

    # make unicode replacements
    # https://github.com/Pioreactor/pioreactor/issues/539
    code = code.replace(chr(8211), chr(45))  # en-dash to dash
    code = code.replace(chr(8212), chr(45))  # em

    try:
        config.read_string(code)  # test parser

        # if editing config.ini (not a unit specific)
        # test to make sure we have minimal code to run pio commands
        if filename == "config.ini":
            assert config["cluster.topology"]
            assert config.get("cluster.topology", "leader_hostname")
            assert config.get("cluster.topology", "leader_address")
            assert config["mqtt"]

            if config.get("cluster.topology", "leader_address").startswith("http") or config.get(
                "mqtt", "broker_address"
            ).startswith("http"):
                raise ValueError("Don't start addresses with http:// or https://")

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
    except (AssertionError, configparser.NoSectionError, KeyError) as e:
        msg = f"Missing required field(s): {e}"
        publish_to_error_log(msg, "update_config")
        return {"msg": msg}, 400
    except ValueError as e:
        publish_to_error_log(str(e), "update_config")
        return {"msg": msg}, 400
    except Exception as e:
        publish_to_error_log(str(e), "update_config")
        msg = "Hm, something went wrong, check Pioreactor logs."
        return {"msg": msg}, 500

    # if the config file is unit specific, we only need to run sync-config on that unit.
    result = tasks.write_config_and_sync(config_path, code, units, flags)

    try:
        status, msg_or_exception = result(blocking=True, timeout=75)
    except HueyException:
        status, msg_or_exception = False, "sync-configs timed out."

    if not status:
        publish_to_error_log(msg_or_exception, "save_new_config")
        return {"msg": str(msg_or_exception)}, 500

    return Response(status=200)


@api.route("/configs/<filename>/history", methods=["GET"])
def get_historical_config_for(filename: str) -> ResponseReturnValue:
    try:
        configs_for_filename = query_app_db(
            "SELECT filename, timestamp, data FROM config_files_histories WHERE filename=? ORDER BY timestamp DESC",
            (filename,),
        )

    except Exception as e:
        publish_to_error_log(str(e), "get_historical_config_for")
        return Response(status=400)

    return jsonify(configs_for_filename)


@api.route("/is_local_access_point_active", methods=["GET"])
@cache.memoize(expire=10_000)
def is_local_access_point_active() -> ResponseReturnValue:
    if os.path.isfile("/boot/firmware/local_access_point"):
        return "true"
    else:
        return "false"


### experiment profiles


@api.route("/contrib/experiment_profiles", methods=["POST"])
def create_experiment_profile() -> ResponseReturnValue:
    body = request.get_json()
    experiment_profile_body = body["body"]
    experiment_profile_filename = Path(body["filename"]).name

    # verify content
    try:
        yaml_decode(experiment_profile_body, type=Profile)
    except Exception as e:
        msg = f"{e}"
        # publish_to_error_log(msg, "create_experiment_profile")
        return {"msg": msg}, 400

    # verify file
    try:
        if not is_valid_unix_filename(experiment_profile_filename):
            abort(404)

        if not (
            experiment_profile_filename.endswith(".yaml")
            or experiment_profile_filename.endswith(".yml")
        ):
            abort(404)

    except Exception:
        msg = "Invalid filename"
        # publish_to_error_log(msg, "create_experiment_profile")
        return {"msg": msg}, 400

    filepath = Path(env["DOT_PIOREACTOR"]) / "experiment_profiles" / experiment_profile_filename

    # check if exists
    if filepath.exists():
        return {"msg": "A profile already exists with that filename. Choose another."}, 400

    # save file to disk
    tasks.save_file(
        filepath,
        experiment_profile_body,
    )

    return Response(status=200)


@api.route("/contrib/experiment_profiles", methods=["PATCH"])
def update_experiment_profile() -> ResponseReturnValue:
    body = request.get_json()
    experiment_profile_body = body["body"]
    experiment_profile_filename = Path(body["filename"]).name

    # verify content
    try:
        yaml_decode(experiment_profile_body, type=Profile)
    except Exception as e:
        # publish_to_error_log(msg, "create_experiment_profile")
        return {"msg": str(e)}, 400

    # verify file - user could have provided a different filename so we still check this.
    try:
        if not is_valid_unix_filename(experiment_profile_filename):
            abort(404)

        if not (
            experiment_profile_filename.endswith(".yaml")
            or experiment_profile_filename.endswith(".yml")
        ):
            abort(404)

    except Exception:
        # publish_to_error_log(msg, "create_experiment_profile")
        return {"msg": "Invalid filename"}, 400

    filepath = Path(env["DOT_PIOREACTOR"]) / "experiment_profiles" / experiment_profile_filename

    # save file to disk
    tasks.save_file(
        filepath,
        experiment_profile_body,
    )

    return Response(status=200)


@api.route("/contrib/experiment_profiles", methods=["GET"])
def get_experiment_profiles() -> ResponseReturnValue:
    try:
        profile_path = Path(env["DOT_PIOREACTOR"]) / "experiment_profiles"
        files = sorted(profile_path.glob("*.y*ml"), key=os.path.getmtime, reverse=True)

        parsed_yaml = []
        for file in files:
            try:
                profile = yaml_decode(file.read_bytes(), type=Profile)
                parsed_yaml.append({"experimentProfile": profile, "file": str(file)})
            except (ValidationError, DecodeError) as e:
                publish_to_error_log(
                    f"Yaml error in {Path(file).name}: {e}", "get_experiment_profiles"
                )

        return Response(
            response=current_app.json.dumps(parsed_yaml),
            status=200,
            mimetype="application/json",
        )
    except Exception as e:
        publish_to_error_log(str(e), "get_experiment_profiles")
        return Response(status=400)


@api.route("/contrib/experiment_profiles/<filename>", methods=["GET"])
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


@api.route("/contrib/experiment_profiles/<filename>", methods=["DELETE"])
def delete_experiment_profile(filename: str) -> ResponseReturnValue:
    file = Path(filename).name
    try:
        if Path(file).suffix not in (".yaml", ".yml"):
            raise IOError("must provide a YAML file")

        specific_profile_path = Path(env["DOT_PIOREACTOR"]) / "experiment_profiles" / file
        tasks.rm(specific_profile_path)
        publish_to_log(f"Deleted profile {filename}.", "delete_experiment_profile")
        return Response(status=200)
    except IOError as e:
        publish_to_error_log(str(e), "delete_experiment_profile")
        return Response(status=404)
    except Exception as e:
        publish_to_error_log(str(e), "delete_experiment_profile")
        return Response(status=500)


##### Worker endpoints


@api.route("/units", methods=["GET"])
def get_list_of_units() -> ResponseReturnValue:
    # Get a list of all units (workers + leader)
    all_units = query_app_db(
        f"""SELECT DISTINCT pioreactor_unit FROM (
            SELECT "{get_leader_hostname()}" AS pioreactor_unit
                UNION
            SELECT pioreactor_unit FROM workers
        );"""
    )
    return jsonify(all_units)


@api.route("/workers", methods=["GET"])
def get_list_of_workers() -> ResponseReturnValue:
    # Get a list of all workers
    all_workers = query_app_db(
        "SELECT pioreactor_unit, added_at, is_active FROM workers ORDER BY pioreactor_unit;"
    )
    return jsonify(all_workers)


@api.route("/workers/setup", methods=["POST"])
def setup_worker_pioreactor() -> ResponseReturnValue:
    data = request.get_json()
    new_name = data["name"]
    version = data["version"]
    model = data["model"]

    try:
        result = tasks.add_new_pioreactor(new_name, version, model)
    except Exception as e:
        return {"msg": str(e)}, 500

    try:
        status = result(blocking=True, timeout=250)
    except HueyException:
        status = False

    if status:
        return {"msg": f"Worker {new_name} added successfully."}, 200
    else:
        return {"msg": f"Failed to add worker {new_name}. See logs."}, 500


@api.route("/workers", methods=["PUT"])
def add_worker() -> ResponseReturnValue:
    cache.evict("config")
    data = request.get_json()
    pioreactor_unit = data.get("pioreactor_unit")

    if not pioreactor_unit:
        return jsonify({"error": "Missing pioreactor_unit"}), 400

    nrows = modify_app_db(
        "INSERT OR REPLACE INTO workers (pioreactor_unit, added_at, is_active) VALUES (?, STRFTIME('%Y-%m-%dT%H:%M:%f000Z', 'NOW'), 1);",
        (pioreactor_unit,),
    )
    if nrows > 0:
        return Response(status=201)
    else:
        return Response(status=404)


@api.route("/workers/<pioreactor_unit>", methods=["DELETE"])
def delete_worker(pioreactor_unit: str) -> ResponseReturnValue:
    row_count = modify_app_db("DELETE FROM workers WHERE pioreactor_unit=?;", (pioreactor_unit,))
    if row_count > 0:
        tasks.multicast_post_across_cluster("/unit_api/jobs/stop/all", [pioreactor_unit])

        # only delete configs if not the leader...
        if pioreactor_unit != HOSTNAME:
            unit_config = f"config_{pioreactor_unit}.ini"

            # delete config on disk
            config_path = Path(env["DOT_PIOREACTOR"]) / unit_config
            tasks.rm(config_path)

            # delete from histories
            modify_app_db("DELETE FROM config_files_histories WHERE filename=?;", (unit_config,))

            # delete configs on worker
            tasks.multicast_post_across_cluster(
                "/unit_api/system/remove_file",
                [pioreactor_unit],
                json={"filepath": str(Path(env["DOT_PIOREACTOR"]) / "config.ini")},
            )
            tasks.multicast_post_across_cluster(
                "/unit_api/system/remove_file",
                [pioreactor_unit],
                json={"filepath": str(Path(env["DOT_PIOREACTOR"]) / "unit_config.ini")},
            )

        publish_to_log(
            f"Removed {pioreactor_unit} from inventory.",
            level="INFO",
            task="assignment",
        )

        return Response(status=202)
    else:
        return Response(status=404)


@api.route("/workers/<pioreactor_unit>/is_active", methods=["PUT"])
def change_worker_status(pioreactor_unit: str) -> ResponseReturnValue:
    # Get the new status from the request body
    data = request.json
    new_status = data.get("is_active")

    if new_status not in [0, 1]:
        return jsonify({"error": "Invalid status. Status must be integer 0 or 1."}), 400

    # Update the status of the worker in the database
    row_count = modify_app_db(
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
            tasks.multicast_post_across_cluster("/unit_api/jobs/stop/all", [pioreactor_unit])
        return Response(status=200)
    else:
        return Response(status=404)


@api.route("/workers/<pioreactor_unit>", methods=["GET"])
def get_worker(pioreactor_unit: str) -> ResponseReturnValue:
    # Query the database for the status of the worker in the given experiment
    result = query_app_db(
        """
        SELECT pioreactor_unit, added_at, is_active
        FROM workers
        WHERE pioreactor_unit = ?
        """,
        (pioreactor_unit,),
        one=True,
    )

    # Check if the worker is found and assigned to the experiment
    if result:
        return jsonify(result)
    else:
        return jsonify({"error": "Worker not found"}), 404


### Experiment worker assignments


@api.route("/workers/assignments", methods=["GET"])
def get_workers_and_experiment_assignments() -> ResponseReturnValue:
    # Get the experiment that a worker is assigned to along with its status
    result = query_app_db(
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


@api.route("/workers/assignments", methods=["DELETE"])
def remove_all_workers_from_all_experiments() -> ResponseReturnValue:
    # unassign all
    modify_app_db(
        "DELETE FROM experiment_worker_assignments",
    )
    task = broadcast_post_across_cluster("/unit_api/jobs/stop/all")
    publish_to_log(
        "Removed all worker assignments.",
        level="INFO",
        task="unassignment",
    )

    return create_task_response(task)


@api.route("/experiments/assignment_count", methods=["GET"])
def get_experiments_worker_assignments() -> ResponseReturnValue:
    # Get the number of pioreactors assigned to an experiment.
    result = query_app_db(
        """
        SELECT e.experiment, count(a.pioreactor_unit) as worker_count
        FROM experiments e
        LEFT JOIN experiment_worker_assignments a
          on e.experiment = a.experiment
        GROUP BY 1
        HAVING count(a.pioreactor_unit) > 0
        ORDER BY 2 DESC
        """,
    )
    if result:
        return jsonify(result)
    else:
        return jsonify([])


@api.route("/workers/<pioreactor_unit>/experiment", methods=["GET"])
def get_experiment_assignment_for_worker(pioreactor_unit: str) -> ResponseReturnValue:
    # Get the experiment that a worker is assigned to along with its active status
    result = query_app_db(
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
        return (
            jsonify({"error": f"Worker {pioreactor_unit} does not exist in the cluster."}),
            404,
        )
    elif result["experiment"] is None:  # type: ignore
        return (
            jsonify({"error": f"Worker {pioreactor_unit} is not assigned to any experiment."}),
            404,
        )
    else:
        return jsonify(result)


@api.route("/experiments/<experiment>/workers", methods=["GET"])
def get_list_of_workers_for_experiment(experiment: str) -> ResponseReturnValue:
    workers = query_app_db(
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


@api.route("/experiments/<experiment>/historical_workers", methods=["GET"])
def get_list_of_historical_workers_for_experiment(experiment: str) -> ResponseReturnValue:
    workers = query_app_db(
        """
         SELECT pioreactor_unit, experiment, MAX(unassigned_at is NULL) as is_currently_assigned_to_experiment
         FROM experiment_worker_assignments_history
         WHERE experiment=?
         GROUP by 1,2;
        """,
        (experiment,),
    )
    return jsonify(workers)


@api.route("/experiments/<experiment>/workers", methods=["PUT"])
def add_worker_to_experiment(experiment: str) -> ResponseReturnValue:
    # assign
    data = request.json
    pioreactor_unit = data.get("pioreactor_unit")
    if not pioreactor_unit:
        return jsonify({"error": "Missing pioreactor_unit"}), 400

    row_counts = modify_app_db(
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

        return Response(status=200)
    else:
        # probably an integrity error
        return Response(status=404)


@api.route("/experiments/<experiment>/workers/<pioreactor_unit>", methods=["DELETE"])
def remove_worker_from_experiment(experiment: str, pioreactor_unit: str) -> ResponseReturnValue:
    # unassign
    row_count = modify_app_db(
        "DELETE FROM experiment_worker_assignments WHERE pioreactor_unit = ? AND experiment = ?",
        (pioreactor_unit, experiment),
    )
    if row_count > 0:
        tasks.multicast_post_across_cluster(
            f"/unit_api/jobs/stop/experiment/{experiment}", [pioreactor_unit]
        )
        publish_to_experiment_log(
            f"Removed {pioreactor_unit} from {experiment}.",
            experiment=experiment,
            level="INFO",
            task="assignment",
        )
        return Response(status=200)
    else:
        return Response(status=404)


@api.route("/experiments/<experiment>/workers", methods=["DELETE"])
def remove_workers_from_experiment(experiment: str) -> ResponseReturnValue:
    # unassign all from specific experiment
    modify_app_db(
        "DELETE FROM experiment_worker_assignments WHERE experiment = ?",
        (experiment,),
    )
    task = broadcast_post_across_cluster(f"/unit_api/jobs/stop/experiment/{experiment}")
    publish_to_experiment_log(
        f"Removed all workers from {experiment}.",
        experiment=experiment,
        level="INFO",
        task="assignment",
    )

    return create_task_response(task)
