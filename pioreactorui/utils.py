# -*- coding: utf-8 -*-
# utils.py
from __future__ import annotations

import re

from flask import jsonify
from flask.typing import ResponseReturnValue
from pioreactor.whoami import get_unit_name


def create_task_response(task) -> ResponseReturnValue:
    return (
        jsonify(
            {
                "unit": get_unit_name(),
                "task_id": task.id,
                "result_url_path": f"/unit_api/task_results/{task.id}",
            }
        ),
        202,
    )


def scrub_to_valid(value: str) -> str:
    if value is None:
        raise ValueError()
    elif value.startswith("sqlite_"):
        raise ValueError()
    return "".join(chr for chr in value if (chr.isalnum() or chr == "_"))


def is_valid_unix_filename(filename: str) -> bool:
    return (
        bool(re.fullmatch(r"[a-zA-Z0-9._-]+", filename))
        and "/" not in filename
        and "\0" not in filename
    )
