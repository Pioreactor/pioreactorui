# -*- coding: utf-8 -*-
from __future__ import annotations

import logging
import json
import socket
import sqlite3
from datetime import datetime
from datetime import timezone

import paho.mqtt.client as mqtt
from dotenv import dotenv_values
from flask import Flask
from flask import g
from huey import SqliteHuey

logger = logging.getLogger(__name__) # grabs underlying WSGI logger
file_handler = logging.FileHandler('test.log') # creates handler for the log file
logger.addHandler(file_handler) # adds handler to the werkzeug WSGI logger
logger.setLevel(logging.DEBUG)

logger.debug("Starting...")


logger.debug("Load .env")
config = dotenv_values(".env")  # a dictionary

app = Flask(__name__)

logger.debug("Starting Huey")
huey = SqliteHuey(filename="/tmp/huey.db")

## CONNECT TO MQTT server / broker
logger.debug("Starting MQTT")
client = mqtt.Client()
client.connect("localhost")
client.loop_start()
LOG_TOPIC = f"pioreactor/{socket.gethostname()}/$experiment/logs/ui"



## UTILS
def msg_to_JSON(msg, task, level):
    return json.dumps(
        {
            "message": msg.strip(),
            "task": task,
            "source": "ui",
            "level": level,
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
    )


def publish_to_log(msg, task, level="DEBUG"):
    print(msg)
    client.publish(LOG_TOPIC, msg_to_JSON(msg, task, level))


def publish_to_error_log(msg, task):
    logger.error(msg)
    publish_to_log(json.dumps(msg), task, "ERROR")


def _make_dicts(cursor, row):
    return dict((cursor.description[idx][0], value) for idx, value in enumerate(row))


def _get_db_connection():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(config["DB_LOCATION"])
        db.row_factory = _make_dicts

    return db


def query_db(query, args=(), one=False):
    cur = _get_db_connection().execute(query, args)
    rv = cur.fetchall()
    cur.close()
    return (rv[0] if rv else None) if one else rv


def insert_into_db(insert_smt, args=()):
    con = _get_db_connection()
    cur = con.cursor()
    cur.execute(insert_smt, args)
    con.commit()
    cur.close()
    return

