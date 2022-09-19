# -*- coding: utf-8 -*-
from __future__ import annotations

import logging
import subprocess
from logging import handlers

from dotenv import dotenv_values
from huey import SqliteHuey

huey = SqliteHuey(filename="huey.db")
config = dotenv_values(".env")  # a dictionary

logger = logging.getLogger("huey.consumer")
logger.setLevel(logging.INFO)

file_handler = handlers.WatchedFileHandler(config["UI_LOG_LOCATION"])
file_handler.setFormatter(
    logging.Formatter(
        "%(asctime)s [%(name)s] %(levelname)-2s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
    )
)
logger.addHandler(file_handler)
logger.info("Starting Huey...")


@huey.task()
def add_new_pioreactor(new_pioreactor_name) -> tuple[bool, str]:
    logger.info(f"Adding new pioreactor {new_pioreactor_name}")
    result = subprocess.run(
        ["pio", "add-pioreactor", new_pioreactor_name], capture_output=True, text=True
    )

    if result.returncode != 0:
        return False, str(result.stderr)
    else:
        return True, str(result.stderr)


@huey.task()
def update_app() -> bool:
    logger.info("Updating apps")
    subprocess.run(["pio", "update", "--app"])
    subprocess.run(["pios", "update"])
    subprocess.run(["pio", "update", "--ui"])
    return True


@huey.task()
def pio(*args) -> tuple[bool, str]:
    logger.info(f'Executing {("pio",) + args}')
    result = subprocess.run(("pio",) + args, capture_output=True, text=True)
    if result.returncode != 0:
        return False, result.stderr
    else:
        return True, result.stdout


@huey.task()
def pios(*args) -> tuple[bool, str]:
    logger.info(f'Executing {("pios",) + args}')
    result = subprocess.run(("pios",) + args, capture_output=True, text=True)
    if result.returncode != 0:
        return False, result.stderr
    else:
        return True, result.stdout


@huey.task()
def write_config(config_path, text) -> tuple[bool, str | Exception]:
    try:
        with open(config_path, "w") as f:
            f.write(text)
        return (True, "")
    except Exception as e:
        return (False, e)
