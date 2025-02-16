# -*- coding: utf-8 -*-
# utils.py
from __future__ import annotations

import re
from time import time

from flask import jsonify
from flask import Response
from flask.typing import ResponseReturnValue
from pioreactor.utils import local_intermittent_storage
from pioreactor.whoami import get_unit_name


def attach_cache_control(response: Response, max_age=5) -> Response:
    """
    Takes in a Flask Response object and sets the Cache-Control header
    to 'public, max-age=<max_age>'.
    """
    response.headers["Cache-Control"] = f"public, max-age={max_age}"
    return response


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
        bool(re.fullmatch(r"[\sa-zA-Z0-9._-]+", filename))
        and "/" not in filename
        and "\0" not in filename
    )


def is_rate_limited(job: str, expire_time_seconds=1.0) -> bool:
    """
    Check if the user has made a request within the debounce duration.
    """
    with local_intermittent_storage("debounce") as cache:
        if cache.get(job) and (time() - cache.get(job)) < expire_time_seconds:
            return True
        else:
            cache.set(job, time())
            return False
