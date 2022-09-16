#!/usr/bin/python3
# -*- coding: utf-8 -*-
from __future__ import annotations

from flup.server.fcgi import WSGIServer

import tasks  # noqa: F401
import views  # noqa: F401
from app import app


if __name__ == "__main__":
    WSGIServer(app).run()
