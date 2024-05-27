# -*- coding: utf-8 -*-
"""
this contains shared data for both huey and the flask app

"""
from __future__ import annotations

import tempfile
from pathlib import Path

import diskcache as dc
from dotenv import dotenv_values
from huey import SqliteHuey
from configparser import ConfigParser



CACHE_DIR = Path(tempfile.gettempdir()) / "pioreactorui_cache"

env = dotenv_values(".env", verbose=True)
huey = SqliteHuey(filename=CACHE_DIR / "huey.db")
config = ConfigParser()
config.read(Path(env['DOT_PIOREACTOR']) / "config.ini")

cache = dc.Cache(
    directory=CACHE_DIR,
    tag_index=True,
    disk_min_file_size=2**16,
)
