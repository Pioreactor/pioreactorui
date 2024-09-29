# -*- coding: utf-8 -*-
from __future__ import annotations

import tasks  # noqa: F401,F403 # Import tasks so they are registered with Huey instance.
from app import create_app

import views  # noqa: F401,F403 # Import views so they are registered with Flask app.


if __name__ == "__main__":
    create_app().run()
