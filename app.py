# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import logging
import socket
import sqlite3
import typing as t
from datetime import datetime
from datetime import timezone
from logging import handlers

import paho.mqtt.client as mqtt
from flask import Flask
from flask import g
from paho.mqtt.enums import CallbackAPIVersion

from config import config
from config import env
from version import __version__

NAME = "pioreactorui"
VERSION = __version__
HOSTNAME = socket.gethostname()


# set up logging
logger = logging.getLogger(NAME)
logger.setLevel(logging.DEBUG)

logs_format = logging.Formatter(
    "%(asctime)s [%(name)s] %(levelname)-2s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S%z",
)

ui_logs = handlers.WatchedFileHandler(env["UI_LOG_LOCATION"])
ui_logs.setFormatter(logs_format)
logger.addHandler(ui_logs)

# TODO: can't do this because of permissions: www-data can't write to this log file...
# general_logs = handlers.WatchedFileHandler(config.get("logging", "log_file"))
# general_logs.setFormatter(logs_format)
# logger.addHandler(general_logs)


logger.debug(f"Starting {NAME}={VERSION} on {HOSTNAME}...")
logger.debug(f".env={dict(env)}")

app = Flask(NAME)

# connect to MQTT server
logger.debug("Starting MQTT client")

client = mqtt.Client(callback_api_version=CallbackAPIVersion.VERSION2)
client.username_pw_set(
    config.get("mqtt", "username", fallback="pioreactor"),
    config.get("mqtt", "password", fallback="raspberry"),
)
client.connect(
    host=config.get("mqtt", "broker_address", fallback="localhost"),
    port=config.getint("mqtt", "broker_port", fallback=1883),
)
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
        msg = json.dumps(msg)

    getattr(logger, level.lower())(msg)

    topic = f"pioreactor/{HOSTNAME}/{experiment}/logs/ui/{level.lower()}"
    client.publish(topic, msg_to_JSON(msg, task, level))


def publish_to_error_log(msg, task: str) -> None:
    publish_to_log(msg, task, "ERROR")


def _make_dicts(cursor, row) -> dict:
    return dict((cursor.description[idx][0], value) for idx, value in enumerate(row))


def _get_db_connection():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(config["storage"]["database"])
        db.row_factory = _make_dicts
        db.execute("PRAGMA foreign_keys = 1")

    return db


def query_db(
    query: str, args=(), one: bool = False
) -> dict[str, t.Any] | list[dict[str, t.Any]] | None:
    cur = _get_db_connection().execute(query, args)
    rv = cur.fetchall()
    cur.close()
    return (rv[0] if rv else None) if one else rv


def modify_db(statement: str, args=()) -> int:
    con = _get_db_connection()
    cur = con.cursor()
    try:
        cur.execute(statement, args)
        con.commit()
    except sqlite3.IntegrityError:
        return 0
    except Exception as e:
        print(e)
        con.rollback()  # TODO: test
        raise e
    finally:
        row_changes = cur.rowcount
        cur.close()
    return row_changes
