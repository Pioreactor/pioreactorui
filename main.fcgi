#!/usr/bin/python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import os
import tempfile

from flup.server.fcgi import WSGIServer

import tasks  # noqa: F401
import views  # noqa: F401
from app import app

# make cache dir with read/write permissions for www-data and pioreactor
os.makedirs(f"{tempfile.gettempdir()}/pioreactor_ui", mode=0o777, exist_ok=True)

if __name__ == "__main__":
    WSGIServer(app).run()
