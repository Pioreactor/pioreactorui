# -*- coding: utf-8 -*-
from __future__ import annotations

import tempfile
from pathlib import Path

import diskcache as dc
from dotenv import dotenv_values
from huey import SqliteHuey


CACHE_DIR = Path(tempfile.gettempdir()) / "pioreactorui_cache"

env = dotenv_values(".env")
huey = SqliteHuey(filename=CACHE_DIR / "huey.db")


cache = dc.Cache(
    directory=CACHE_DIR,
    tag_index=True,
    disk_min_file_size=2**16,
)
