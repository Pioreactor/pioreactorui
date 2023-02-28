#!/usr/bin/python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import os
import tempfile

# make cache dir with read/write permissions for www-data and pioreactor.
# do this before importing app
os.makedirs(f"{tempfile.gettempdir()}/pioreactorui_cache", mode=0o777, exist_ok=True)


from flup.server.fcgi import WSGIServer

import tasks  # noqa: F401
import views  # noqa: F401
from app import app


if __name__ == "__main__":
    WSGIServer(app).run()
