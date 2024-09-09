# -*- coding: utf-8 -*-
from __future__ import annotations

import logging
from logging import handlers
from shlex import join
from shlex import quote
from subprocess import check_call as run_and_check_call
from subprocess import run
from typing import Any

from pioreactor.config import config
from pioreactor.pubsub import get_from
from pioreactor.pubsub import post_into
from pioreactor.utils.networking import resolve_to_address

from config import cache
from config import CACHE_DIR
from config import huey

logger = logging.getLogger("huey.consumer")
logger.setLevel(logging.INFO)

file_handler = handlers.WatchedFileHandler(
    config.get("logging", "ui_log_file", fallback="/var/log/pioreactor.log")
)
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
def add_new_pioreactor(new_pioreactor_name: str, version: str, model: str) -> tuple[bool, str]:
    # CPU heavy
    logger.info(f"Adding new pioreactor {new_pioreactor_name}, {model} {version}")
    result = run(
        ["pio", "workers", "add", new_pioreactor_name, "-v", version, "-m", model],
        capture_output=True,
        text=True,
    )
    cache.evict("config")
    if result.returncode != 0:
        return False, str(result.stderr.strip())
    else:
        return True, str(result.stderr.strip())


@huey.task()
def update_app_across_cluster() -> bool:
    # CPU heavy / IO heavy
    logger.info("Updating app on leader")
    update_app_on_leader = ["pio", "update", "app"]
    run_and_check_call(update_app_on_leader)

    logger.info("Updating app on workers")
    update_app_across_all_workers = ["pios", "update", "-y"]
    run(update_app_across_all_workers)

    # do this last as this update will kill huey
    logger.info("Updating UIs")
    update_ui = ["pios", "update", "ui"]
    run_and_check_call(update_ui)
    cache.evict("app")
    return True


@huey.task()
def update_app_from_release_archive_across_cluster(archive_location: str) -> bool:
    logger.info(f"Updating app on leader from {archive_location}")
    update_app_on_leader = ["pio", "update", "app", "--source", archive_location]
    run_and_check_call(update_app_on_leader)

    logger.info("Updating app to development on workers")
    distribute_archive_to_workers = ["pios", "cp", archive_location, "-y"]
    run(distribute_archive_to_workers)
    update_app_across_all_workers = ["pios", "update", "--source", archive_location, "-y"]
    run(update_app_across_all_workers)

    # remove bits if success
    cache.evict("app")
    run(["rm", f"/tmp/{archive_location}"])

    # do this last as this update will kill huey
    logger.info("Updating UI")
    update_ui = [
        "pios",
        "update",
        "ui",
        "--source",
        "/tmp/pioreactorui_archive",
    ]  # this /tmp location is added during `pio update app`, kinda gross
    run_and_check_call(update_ui)

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
def shutdown() -> tuple[bool, str]:
    logger.info("Shutting down now")
    result = run(["sudo", "shutdown", "-h", "now"], capture_output=True, text=True)
    if result.returncode != 0:
        return False, result.stderr.strip()
    else:
        return True, result.stdout.strip()


@huey.task()
def reboot() -> tuple[bool, str]:
    logger.info("Rebooting now")
    result = run(["sudo", "reboot"], capture_output=True, text=True)
    if result.returncode != 0:
        return False, result.stderr.strip()
    else:
        return True, result.stdout.strip()


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
def write_config_and_sync(config_path: str, text: str, units: str, flags: str):
    try:
        with open(config_path, "w") as f:
            f.write(text)

        result = run(
            ("pios", "sync-configs", "--units", quote(units), quote(flags)),
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise Exception(result.stderr.strip())

        return (True, "")

    except Exception as e:
        logger.error(str(e))
        return (False, "Could not sync configs to all Pioreactors.")


@huey.task()
def get_across_cluster(endpoint: str, workers: list[str]):
    result: dict[str, Any] = {}
    for worker in workers:
        try:
            r = get_from(resolve_to_address(worker), endpoint, timeout=6)
            r.raise_for_status()
            result[worker] = r.json()
        except Exception:
            logger.error(f"Could not get from {worker}. Check connection?")
    return result


@huey.task()
def post_across_cluster(endpoint: str, workers: list[str], body: bytes | None = None):
    result: dict[str, Any] = {}
    for worker in workers:
        try:
            r = post_into(resolve_to_address(worker), endpoint, body=body, timeout=6)
            r.raise_for_status()
            result[worker] = r.json()
        except Exception:
            logger.error(f"Could not post to {worker}. Check connection?")
    return result
