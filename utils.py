# -*- coding: utf-8 -*-
# utils.py
from __future__ import annotations

import re
from datetime import datetime
from datetime import timezone


def scrub_to_valid(value: str) -> str:
    if value is None:
        raise ValueError()
    elif value.startswith("sqlite_"):
        raise ValueError()
    return "".join(chr for chr in value if (chr.isalnum() or chr == "_"))


def current_utc_datetime() -> datetime:
    # this is timezone aware.
    return datetime.now(timezone.utc)


def to_iso_format(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


def current_utc_timestamp() -> str:
    # this is timezone aware.
    return to_iso_format(current_utc_datetime())


def is_valid_unix_filename(filename: str) -> bool:
    return (
        bool(re.fullmatch(r"[a-zA-Z0-9._-]+", filename))
        and "/" not in filename
        and "\0" not in filename
    )
