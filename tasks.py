# -*- coding: utf-8 -*-
from __future__ import annotations

import logging
from logging import handlers
from shlex import join
from subprocess import check_call
from subprocess import run

from config import cache
from config import CACHE_DIR
from config import env
from config import huey

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


@huey.on_startup()
def initialized():
    logger.info("Starting Huey consumer...")
    logger.info(f"Cache directory = {CACHE_DIR}")


@huey.task()
def add_new_pioreactor(new_pioreactor_name: str) -> tuple[bool, str]:
    logger.info(f"Adding new pioreactor {new_pioreactor_name}")
    result = run(["pio", "workers", "add", new_pioreactor_name], capture_output=True, text=True)
    cache.evict("config")
    if result.returncode != 0:
        return False, str(result.stderr.strip())
    else:
        return True, str(result.stderr.strip())


@huey.task()
def update_app() -> bool:
    logger.info("Updating app on leader")
    update_app_on_leader = ["pio", "update", "app"]
    check_call(update_app_on_leader)

    logger.info("Updating UI on leader")
    update_ui_on_leader = ["pio", "update", "ui"]
    check_call(update_ui_on_leader)

    logger.info("Updating app on workers")
    update_app_across_all_workers = ["pios", "update", "-y"]
    run(update_app_across_all_workers)

    cache.evict("app")
    return True


@huey.task()
def update_app_to_develop() -> bool:
    logger.info("Updating app to development on leader")
    update_app_on_leader = ["pio", "update", "app", "-b", "develop"]
    check_call(update_app_on_leader)

    logger.info("Updating UI to development on leader")
    update_ui_on_leader = ["pio", "update", "ui", "-b", "develop"]
    check_call(update_ui_on_leader)

    logger.info("Updating app to development on workers")
    update_app_across_all_workers = ["pios", "update", "-y", "-b", "develop"]
    run(update_app_across_all_workers)

    cache.evict("app")
    return True


@huey.task()
def update_app_from_release_archive(archive_location: str) -> bool:
    logger.info(f"Updating app on leader from {archive_location}")
    update_app_on_leader = ["pio", "update", "app", "--source", archive_location]
    check_call(update_app_on_leader)

    logger.info("Updating UI to development on leader")
    update_ui_on_leader = [
        "pio",
        "update",
        "ui",
        "--source",
        "/tmp/pioreactorui_archive",
    ]  # this /tmp location is added during `pio update app`, kinda gross
    check_call(update_ui_on_leader)

    logger.info("Updating app to development on workers")
    distribute_archive_to_workers = ["pios", "cp", archive_location, "-y"]
    run(distribute_archive_to_workers)
    update_app_across_all_workers = ["pios", "update", "--source", archive_location, "-y"]
    run(update_app_across_all_workers)

    # remove bits if success
    cache.evict("app")
    run(["rm", f"/tmp/{archive_location}", "/tmp/pioreactorui_archive"])
    return True


@huey.task()
def pio(*args) -> tuple[bool, str]:
    logger.info(f'Executing `{join(("pio",) + args)}`')
    result = run(("pio",) + args, capture_output=True, text=True)
    if result.returncode != 0:
        return False, result.stderr.strip()
    else:
        return True, result.stdout.strip()


@huey.task()
def rm(path: str) -> tuple[bool, str]:
    logger.info(f"Deleting {path}.")
    result = run(["rm", path], capture_output=True, text=True)
    if result.returncode != 0:
        return False, result.stderr.strip()
    else:
        return True, result.stdout.strip()


@huey.task()
def get_time(path: str) -> str:
    result = run(["date"], capture_output=True, text=True)
    return result.stdout.strip()


@huey.task()
def pios(*args) -> tuple[bool, str]:
    logger.info(f'Executing `{join(("pios",) + args + ("-y",))}`')
    result = run(("pios",) + args + ("-y",), capture_output=True, text=True)
    if result.returncode != 0:
        return False, result.stderr.strip()
    else:
        return True, result.stdout.strip()


@huey.task()
def pios_install_plugin(plugin_name: str) -> tuple[bool, str]:
    logger.info(f"Executing `pios plugins install {plugin_name} -y`")
    result = run(("pios", "plugins", "install", plugin_name, "-y"), capture_output=True, text=True)
    cache.evict("plugins")
    cache.evict("config")
    if result.returncode != 0:
        return False, result.stderr.strip()
    else:
        return True, result.stdout.strip()


@huey.task()
def pios_uninstall_plugin(plugin_name: str) -> tuple[bool, str]:
    logger.info(f"Executing `pios plugins uninstall {plugin_name} -y`")
    result = run(
        ("pios", "plugins", "uninstall", plugin_name, "-y"), capture_output=True, text=True
    )
    cache.evict("plugins")
    cache.evict("config")
    if result.returncode != 0:
        return False, result.stderr.strip()
    else:
        return True, result.stdout.strip()


@huey.task()
def save_file(path: str, content: str):
    try:
        with open(path, "w") as f:
            f.write(content)
        return True
    except Exception as e:
        logger.error(e)
        return False


@huey.task()
def write_config_and_sync(config_path: str, text: str, units: str, flags: str) -> tuple[bool, str]:
    try:
        with open(config_path, "w") as f:
            f.write(text)

        result = run(
            ("pios", "sync-configs", "--units", units, flags), capture_output=True, text=True
        )
        if result.returncode != 0:
            raise Exception(result.stderr.strip())

        return (True, "")

    except Exception as e:
        logger.error(str(e))
        return (False, "Hm, something went wrong, check PioreactorUI logs.")
