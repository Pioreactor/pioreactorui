# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import socket
import sqlite3
from datetime import datetime
from datetime import timezone

import paho.mqtt.client as mqtt
from dotenv import dotenv_values
from flask import Flask
from flask import g


config = dotenv_values(".env")  # a dictionary

app = Flask(__name__)


## CONNECT TO MQTT server / broker
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
