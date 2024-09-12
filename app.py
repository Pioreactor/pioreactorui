# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import logging
import sqlite3
import tempfile
import time
import typing as t
from datetime import datetime
from datetime import timezone
from logging import handlers

import paho.mqtt.client as mqtt
from flask import Flask
from flask import g
from paho.mqtt.enums import CallbackAPIVersion
from pioreactor.config import config
from pioreactor.config import get_leader_hostname
from pioreactor.whoami import am_I_leader
from pioreactor.whoami import get_unit_name

from config import env
from version import __version__

VERSION = __version__
HOSTNAME = get_unit_name()
NAME = f"pioreactorui-{HOSTNAME}"


# set up logging
logger = logging.getLogger(NAME)
logger.setLevel(logging.DEBUG)

logs_format = logging.Formatter(
    "%(asctime)s [%(name)s] %(levelname)-2s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S%z",
)

ui_logs = handlers.WatchedFileHandler(
    config.get("logging", "ui_log_file", fallback="/var/log/pioreactor.log")
)
ui_logs.setFormatter(logs_format)
logger.addHandler(ui_logs)


logger.debug(f"Starting {NAME}={VERSION} on {HOSTNAME}...")
logger.debug(f".env={dict(env)}")

app = Flask(NAME)

# connect to MQTT server, only if leader. workers don't need to.


client = mqtt.Client(callback_api_version=CallbackAPIVersion.VERSION2)
client.username_pw_set(
    config.get("mqtt", "username", fallback="pioreactor"),
    config.get("mqtt", "password", fallback="raspberry"),
)
client.connect(
    host=config.get("mqtt", "broker_address", fallback="localhost"),
    port=config.getint("mqtt", "broker_port", fallback=1883),
)

if am_I_leader():
    logger.debug("Starting MQTT client")
    # we currently only need to communicate with MQTT for the leader.
    client.loop_start()

## UTILS


def msg_to_JSON(msg: str, task: str, level: str) -> str:
    return json.dumps(
        {
            "message": msg.strip(),
            "task": task,
            "source": "ui",
            "level": level,
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
    )


def publish_to_log(msg: str, task: str, level="DEBUG") -> None:
    publish_to_experiment_log(msg, "$experiment", task, level)


def publish_to_experiment_log(msg: str | t.Any, experiment: str, task: str, level="DEBUG") -> None:
    if not isinstance(msg, str):
        # attempt to serialize
        try:
            msg = json.dumps(msg)
        except TypeError:
            msg = str(msg)

    getattr(logger, level.lower())(msg)

    topic = f"pioreactor/{get_leader_hostname()}/{experiment}/logs/ui/{level.lower()}"
    client.publish(topic, msg_to_JSON(msg, task, level))


def publish_to_error_log(msg, task: str) -> None:
    publish_to_log(msg, task, "ERROR")


def _make_dicts(cursor, row) -> dict:
    return dict((cursor.description[idx][0], value) for idx, value in enumerate(row))


def _get_local_metadata_db_connection():
    db = getattr(g, "_metadata_database", None)
    if db is None:
        db = g._local_metadata_database = sqlite3.connect(
            f"{tempfile.gettempdir()}/local_intermittent_pioreactor_metadata.sqlite"
        )
        db.row_factory = _make_dicts
    return db


def query_app_db(
    query: str, args=(), one: bool = False
) -> dict[str, t.Any] | list[dict[str, t.Any]] | None:
    assert am_I_leader()
    cur = _get_app_db_connection().execute(query, args)
    rv = cur.fetchall()
    cur.close()
    return (rv[0] if rv else None) if one else rv


def query_local_metadata_db(
    query: str, args=(), one: bool = False
) -> dict[str, t.Any] | list[dict[str, t.Any]] | None:
    cur = _get_local_metadata_db_connection().execute(query, args)
    rv = cur.fetchall()
    cur.close()
    return (rv[0] if rv else None) if one else rv


def _get_app_db_connection():
    db = getattr(g, "_app_database", None)
    if db is None:
        db = g._app_database = sqlite3.connect(config.get("storage", "database"), timeout=30)
        db.row_factory = _make_dicts
        db.execute("PRAGMA foreign_keys = 1")
    return db


def modify_app_db(statement: str, args=(), retries=5, retry_delay=1) -> int:
    """
    Executes a modifying SQL statement (INSERT, UPDATE, DELETE).

    Args:
        statement: SQL statement to execute.
        args: Arguments for SQL placeholders.
        retries: Number of retries if the database is locked.
        retry_delay: Delay between retries in seconds.

    Returns:
        Number of rows modified, or 0 in case of IntegrityError.
    """
    assert am_I_leader()  # Ensure the leader-only operation is enforced
    for attempt in range(retries):
        con = _get_app_db_connection()
        try:
            with con:  # Context manager for the connection (commits automatically)
                with con.cursor() as cur:  # Context manager for the cursor
                    cur.execute(statement, args)
                    row_changes = cur.rowcount
            return row_changes

        except sqlite3.IntegrityError:
            return 0  # Return 0 on integrity error (e.g., foreign key constraint violation)

        except sqlite3.OperationalError as e:
            if "database is locked" in str(e):
                time.sleep(retry_delay)  # Delay before retrying
            else:
                raise e  # Reraise other operational errors

        except Exception as e:
            logging.error(f"Unexpected error in query: {statement}, args: {args}, error: {e}")
            con.rollback()  # Rollback on generic error
            raise e  # Reraise unexpected exceptions

    publish_to_error_log(
        f"Failed to execute query after {retries} attempts: {statement}, args: {args}", "query"
    )
    raise sqlite3.OperationalError("Failed to execute query after retries")
