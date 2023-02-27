# -*- coding: utf-8 -*-
from __future__ import annotations

import logging
import pathlib
import shutil
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


cache = dc.Cache(
    directory=f"{tempfile.gettempdir()}/pioreactorui_cache",
    tag_index=True,
    disk_min_file_size=2**16,
)
logger.debug(f"Cache location: {cache.directory}")

#### techdebt
# What needs to be accomplished?
# 1. Both Huey (tasks.py) and lighttp (app.py, entry point is main.fcgi) need RW to the cache, which is a SQLite db (with associated metadata files) in /tmp dir
# 2. Huey is run with user `pioreactor` (as it runs pio tasks), and lighttp is run by `www-data` user.
#  - Note that `pioreactor` is part of `www-data` group, too
# 3. At startup (or any restart), systemd starts huey.service and lighttpd.service
# 4. If huey.service starts first, then the sqlite files are owned by `pioreactor`, and lighttp fails since it can't RW the db.
# 5. So we explicitly change the owner _and_ RW permissions on the necessary files
# 6. Why the on_startup? main.fcgi imports tasks.py, which runs this code block, but with a user (www-data) that can't edit these files.


@huey.on_startup()
def create_correct_permissions():
    # set permissions on files need for cache
    cache_dir = pathlib.Path(cache.directory)

    (cache_dir).chmod(mode=0o770)
    shutil.chown(cache_dir, user="pioreactor", group="www-data")

    (cache_dir / "cache.db").chmod(mode=0o770)
    shutil.chown(cache_dir / "cache.db", user="pioreactor", group="www-data")

    (cache_dir / "cache.db-shm").chmod(mode=0o770)
    shutil.chown(cache_dir / "cache.db-shm", user="pioreactor", group="www-data")

    (cache_dir / "cache.db-wal").chmod(mode=0o770)
    shutil.chown(cache_dir / "cache.db-wal", user="pioreactor", group="www-data")
    return


#######


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
