#!/usr/bin/python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import tasks  # noqa: F401
from app import create_app
from flup.server.fcgi import WSGIServer

import views  # noqa: F401


if __name__ == "__main__":
    WSGIServer(create_app()).run()
