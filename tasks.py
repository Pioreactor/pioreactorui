# -*- coding: utf-8 -*-
from __future__ import annotations

import logging
import subprocess
import tempfile
from logging import handlers

import diskcache as dc
from dotenv import dotenv_values
from huey import SqliteHuey

env = dotenv_values(".env")
huey = SqliteHuey(filename="huey.db")

logger = logging.getLogger("huey.consumer")
logger.setLevel(logging.INFO)

file_handler = handlers.WatchedFileHandler(env["UI_LOG_LOCATION"])
file_handler.setFormatter(
    logging.Formatter(
        "%(asctime)s [%(name)s] %(levelname)-2s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
    )
)
logger.addHandler(file_handler)


cache = dc.Cache(directory=f"{tempfile.gettempdir()}/pioreactor_ui", tag_index=True)
logger.debug(f"Cache location: {cache.directory}")

logger.info("Starting Huey...")


@huey.task()
def add_new_pioreactor(new_pioreactor_name: str) -> tuple[bool, str]:
    logger.info(f"Adding new pioreactor {new_pioreactor_name}")
    result = subprocess.run(
        ["pio", "add-pioreactor", new_pioreactor_name], capture_output=True, text=True
    )
    cache.evict("config")
    if result.returncode != 0:
        return False, str(result.stderr)
    else:
        return True, str(result.stderr)


@huey.task()
def update_app() -> bool:
    logger.info("Updating app on leader")
    update_app_on_leader = ["pio", "update", "app"]
    subprocess.run(update_app_on_leader)

    logger.info("Updating app on workers")
    update_app_across_all_workers = ["pios", "update", "-y"]
    subprocess.run(update_app_across_all_workers)

    logger.info("Updating UI on leader")
    update_ui_on_leader = ["pio", "update", "ui"]
    subprocess.run(update_ui_on_leader)
    cache.evict("app")
    return True


@huey.task()
def pio(*args) -> tuple[bool, str]:
    logger.info(f'Executing `{" ".join(("pio",) + args)}`')
    result = subprocess.run(("pio",) + args, capture_output=True, text=True)
    if result.returncode != 0:
        return False, result.stderr
    else:
        return True, result.stdout


@huey.task()
def rm(path) -> tuple[bool, str]:
    logger.info(f"Deleting {path}.")
    result = subprocess.run(["rm", path], capture_output=True, text=True)
    if result.returncode != 0:
        return False, result.stderr
    else:
        return True, result.stdout


@huey.task()
def pios(*args) -> tuple[bool, str]:
    logger.info(f'Executing `{" ".join(("pios",) + args)}`')
    result = subprocess.run(("pios",) + args, capture_output=True, text=True)
    if result.returncode != 0:
        return False, result.stderr
    else:
        return True, result.stdout


@huey.task()
def pios_install_plugin(plugin_name) -> tuple[bool, str]:
    logger.info(f"Executing `pios install-plugin {plugin_name}`")
    result = subprocess.run(("pios", "install-plugin", plugin_name), capture_output=True, text=True)
    cache.evict("plugins")
    cache.evict("config")
    if result.returncode != 0:
        return False, result.stderr
    else:
        return True, result.stdout


@huey.task()
def pios_uninstall_plugin(plugin_name) -> tuple[bool, str]:
    logger.info(f"Executing `pios uninstall-plugin {plugin_name}`")
    result = subprocess.run(
        ("pios", "uninstall-plugin", plugin_name), capture_output=True, text=True
    )
    cache.evict("plugins")
    cache.evict("config")
    if result.returncode != 0:
        return False, result.stderr
    else:
        return True, result.stdout


@huey.task()
def write_config_and_sync(config_path: str, text: str, units: str, flags: str) -> tuple[bool, str]:
    try:
        with open(config_path, "w") as f:
            f.write(text)

        result = subprocess.run(
            ("pios", "sync-configs", "--units", units, flags), capture_output=True, text=True
        )
        if result.returncode != 0:
            raise Exception(result.stderr)

        return (True, "")

    except Exception as e:
        logger.error(str(e))
        return (False, "Hm, something went wrong, check PioreactorUI logs.")
