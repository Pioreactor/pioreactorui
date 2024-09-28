# -*- coding: utf-8 -*-
from __future__ import annotations

import tasks  # noqa: F401,F403 # Import tasks so they are registered with Huey instance.
import views  # noqa: F401,F403 # Import views so they are registered with Flask app.
from app import create_app


if __name__ == "__main__":
    create_app().run()
