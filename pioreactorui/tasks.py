# -*- coding: utf-8 -*-
from __future__ import annotations

import logging
import os
from logging import handlers
from shlex import join
from subprocess import check_call
from subprocess import DEVNULL
from subprocess import Popen
from subprocess import run
from subprocess import STDOUT
from typing import Any

from msgspec import DecodeError
from pioreactor import whoami
from pioreactor.config import config
from pioreactor.mureq import HTTPErrorStatus
from pioreactor.mureq import HTTPException
from pioreactor.pubsub import delete_from
from pioreactor.pubsub import get_from
from pioreactor.pubsub import patch_into
from pioreactor.pubsub import post_into
from pioreactor.utils.networking import resolve_to_address

from .config import CACHE_DIR
from .config import env
from .config import huey
from .config import is_testing_env


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

if not is_testing_env():
    PIO_EXECUTABLE = "/usr/local/bin/pio"
    PIOS_EXECUTABLE = "/usr/local/bin/pios"
else:
    PIO_EXECUTABLE = env.get("PIO_EXECUTABLE")
    PIOS_EXECUTABLE = env.get("PIOS_EXECUTABLE")

ALLOWED_ENV = (
    "EXPERIMENT",
    "JOB_SOURCE",
    "TESTING",
    "HOSTNAME",
    "HARDWARE",
    "ACTIVE",
    "FIRMWARE",
    "ACTIVE",
    "DEBUG",
    "MODEL_NAME",
    "MODEL_VERSION",
    "SKIP_PLUGINS",
)


@huey.on_startup()
def initialized():
    logger.info("Starting Huey consumer...")
    logger.info(f"Cache directory = {CACHE_DIR}")


@huey.task(priority=10)
def pio_run(*args: str, env: dict[str, str] = {}) -> bool:
    # for long running pio run jobs where we don't care about the output / status
    command = ("nohup", PIO_EXECUTABLE, "run") + args

    env = {k: v for k, v in (env or {}).items() if k in ALLOWED_ENV}
    logger.info(f"Executing `{join(command)}`, {env=}")
    Popen(
        command, start_new_session=True, env=dict(os.environ) | env, stdout=DEVNULL, stderr=STDOUT
    )
    return True


@huey.task()
def add_new_pioreactor(new_pioreactor_name: str, version: str, model: str) -> bool:
    command = [PIO_EXECUTABLE, "workers", "add", new_pioreactor_name, "-v", version, "-m", model]
    logger.info(f"Executing `{join(command)}`")
    check_call(command)
    return True


@huey.task()
def update_app_across_cluster() -> bool:
    # CPU heavy / IO heavy
    logger.info("Updating app on leader")
    update_app_on_leader = ["pio", "update", "app"]
    check_call(update_app_on_leader)

    logger.info("Updating app and ui on workers")
    update_app_across_all_workers = [PIOS_EXECUTABLE, "update", "-y"]
    run(update_app_across_all_workers)
    return True


@huey.task()
def update_app_from_release_archive_across_cluster(archive_location: str, units: str) -> bool:
    if units == "$broadcast":
        logger.info(f"Updating app on leader from {archive_location}")
        update_app_on_leader = ["pio", "update", "app", "--source", archive_location]
        check_call(update_app_on_leader)

        logger.info(f"Updating app and ui on workers from {archive_location}")
        distribute_archive_to_workers = [PIOS_EXECUTABLE, "cp", archive_location, "-y"]
        run(distribute_archive_to_workers)

        # this may include leader, and leader's UI. If it's not included, we need to update the UI later.
        update_app_across_all_workers = [
            PIOS_EXECUTABLE,
            "update",
            "--source",
            archive_location,
            "-y",
        ]
        run(update_app_across_all_workers)

        if not whoami.am_I_a_worker():
            # update the UI on the leader
            update_ui_on_leader = [
                "pio",
                "update",
                "ui",
                "--source",
                "/tmp/pioreactorui_archive.tar.gz",
            ]
            run(update_ui_on_leader)

        return True
    else:
        logger.info(f"Updating app and ui on unit {units} from {archive_location}")
        distribute_archive_to_workers = [
            PIOS_EXECUTABLE,
            "cp",
            archive_location,
            "-y",
            "--units",
            units,
        ]
        run(distribute_archive_to_workers)

        update_app_across_all_workers = [
            PIOS_EXECUTABLE,
            "update",
            "--source",
            archive_location,
            "-y",
            "--units",
            units,
        ]
        run(update_app_across_all_workers)
        return True


@huey.task()
def update_app_from_release_archive_on_specific_pioreactors(
    archive_location: str, pioreactors: list[str]
) -> bool:
    units_cli: tuple[str, ...] = sum((("--units", p) for p in pioreactors), tuple())

    logger.info(f"Updating app and ui on unit {pioreactors} from {archive_location}")
    distribute_archive_to_workers = [PIOS_EXECUTABLE, "cp", archive_location, "-y", *units_cli]
    run(distribute_archive_to_workers)

    update_app_across_all_workers = [
        PIOS_EXECUTABLE,
        "update",
        "--source",
        archive_location,
        "-y",
        *units_cli,
    ]
    run(update_app_across_all_workers)

    return True


@huey.task()
def pio(*args: str, env: dict[str, str] = {}) -> bool:
    logger.info(f'Executing `{join(("pio",) + args)}`, {env=}')
    result = run((PIO_EXECUTABLE,) + args, env=dict(os.environ) | env)
    return result.returncode == 0


@huey.task()
def pio_plugins_list(*args: str, env: dict[str, str] = {}) -> tuple[bool, str]:
    logger.info(f'Executing `{join(("pio",) + args)}`, {env=}')
    result = run(
        (PIO_EXECUTABLE,) + args, capture_output=True, text=True, env=dict(os.environ) | env
    )
    return result.returncode == 0, result.stdout.strip()


@huey.task()
@huey.lock_task("export-data-lock")
def pio_run_export_experiment_data(*args: str, env: dict[str, str] = {}) -> tuple[bool, str]:
    logger.info(f'Executing `{join(("pio", "run", "export_experiment_data") + args)}`, {env=}')
    result = run(
        (PIO_EXECUTABLE, "run", "export_experiment_data") + args,
        capture_output=True,
        text=True,
        env=dict(os.environ) | env,
    )
    return result.returncode == 0, result.stdout.strip()


@huey.task(priority=100)
def pio_kill(*args: str, env: dict[str, str] = {}) -> bool:
    logger.info(f'Executing `{join(("pio", "kill") + args)}`, {env=}')
    result = run((PIO_EXECUTABLE, "kill") + args, env=dict(os.environ) | env)
    return result.returncode == 0


@huey.task()
@huey.lock_task("plugins-lock")
def pio_plugins(*args: str, env: dict[str, str] = {}) -> bool:
    # install / uninstall only
    assert args[0] in ("install", "uninstall")
    logger.info(f'Executing `{join(("pio", "plugins") + args)}`, {env=}')
    result = run((PIO_EXECUTABLE, "plugins") + args, env=dict(os.environ) | env)
    return result.returncode == 0


@huey.task()
def update_clock(new_time: str) -> bool:
    # iso8601 format
    r = run(["sudo", "date", "-s", new_time])
    return r.returncode == 0


@huey.task()
def sync_clock() -> bool:
    # iso8601 format
    r = run(["sudo", "chronyc", "-a", "makestep"])
    return r.returncode == 0


@huey.task()
@huey.lock_task("update-lock")
def pio_update_app(*args: str, env: dict[str, str] = {}) -> bool:
    logger.info(f'Executing `{join(("pio", "update", "app") + args)}`, {env=}')
    result = run((PIO_EXECUTABLE, "update", "app") + args, env=dict(os.environ) | env)
    return result.returncode == 0


@huey.task()
@huey.lock_task("update-lock")
def pio_update(*args: str, env: dict[str, str] = {}) -> bool:
    logger.info(f'Executing `{join(("pio", "update") + args)}`, {env=}')
    run((PIO_EXECUTABLE, "update") + args, env=dict(os.environ) | env)
    # HACK: this always returns >0 because it kills huey, I think, so just return true
    return True


@huey.task()
@huey.lock_task("update-lock")
def pio_update_ui(*args: str, env: dict[str, str] = {}) -> bool:
    logger.info(f'Executing `{join(("pio", "update", "ui") + args)}`, {env=}')
    run((PIO_EXECUTABLE, "update", "ui") + args, env=dict(os.environ) | env)
    # this always returns >0 because it kills huey, I think, so just return true
    return True


@huey.task()
def rm(path: str) -> bool:
    logger.info(f"Deleting {path}.")
    result = run(["rm", path])
    return result.returncode == 0


@huey.task()
def shutdown() -> bool:
    logger.info("Shutting down now")
    result = run(["sudo", "shutdown", "-h", "now"])
    return result.returncode == 0


@huey.task()
def reboot() -> bool:
    logger.info("Rebooting now")
    result = run(["sudo", "reboot"])
    return result.returncode == 0


@huey.task()
def pios(*args: str, env: dict[str, str] = {}) -> bool:
    logger.info(f'Executing `{join(("pios",) + args + ("-y",))}`, {env=}')
    result = run(
        (PIOS_EXECUTABLE,) + args + ("-y",),
        env=dict(os.environ) | env,
    )
    return result.returncode == 0


@huey.task()
def save_file(path: str, content: str) -> bool:
    try:
        with open(path, "w") as f:
            f.write(content)
        return True
    except Exception as e:
        logger.error(e)
        return False


@huey.task()
def write_config_and_sync(
    config_path: str, text: str, units: str, flags: str, env: dict[str, str] = {}
) -> tuple[bool, str]:
    try:
        with open(config_path, "w") as f:
            f.write(text)

        logger.info(
            f'Executing `{join((PIOS_EXECUTABLE, "sync-configs", "--units", units, flags))}`, {env=}'
        )

        result = run(
            (PIOS_EXECUTABLE, "sync-configs", "--units", units, flags),
            capture_output=True,
            text=True,
            env=env,
            check=True,
        )
        if result.returncode != 0:
            raise Exception(result.stderr.strip())

        return (True, "")

    except Exception as e:
        logger.error(str(e))
        return (False, "Could not sync configs to all Pioreactors.")


@huey.task(priority=10)
def post_to_worker(
    worker: str, endpoint: str, json: dict | None = None, params: dict | None = None
) -> tuple[str, Any]:
    try:
        address = resolve_to_address(worker)
        r = post_into(address, endpoint, json=json, params=params, timeout=1)
        r.raise_for_status()
        return worker, r.json() if r.content else None
    except (HTTPErrorStatus, HTTPException) as e:
        logger.error(
            f"Could not post to {worker}'s {address=}/{endpoint=}, sent {json=} and returned {e}. Check connection? Check port?"
        )
        return worker, None
    except DecodeError:
        logger.error(
            f"Could not decode response from {worker}'s {endpoint=}, sent {json=} and returned {r.body}."
        )
        return worker, None


@huey.task(priority=5)
def multicast_post_across_cluster(
    endpoint: str,
    workers: list[str],
    json: dict | list[dict | None] | None = None,
    params: dict | list[dict | None] | None = None,
) -> dict[str, Any]:
    # this function "consumes" one huey thread waiting fyi
    assert endpoint.startswith("/unit_api")

    if not isinstance(json, list):
        json = [json] * len(workers)

    assert json is not None

    if not isinstance(params, list):
        params = [params] * len(workers)

    tasks = post_to_worker.map(
        ((workers[i], endpoint, json[i], params[i]) for i in range(len(workers)))
    )

    return {
        worker: response for (worker, response) in tasks.get(blocking=True, timeout=30)
    }  # add a timeout so that we don't hold up a thread forever.


@huey.task(priority=10)
def get_from_worker(
    worker: str, endpoint: str, json: dict | None = None, timeout=5.0, return_raw=False
) -> tuple[str, Any]:
    try:
        address = resolve_to_address(worker)

        r = get_from(address, endpoint, json=json, timeout=timeout)
        r.raise_for_status()
        if not return_raw:
            return worker, r.json() if r.content else None
        else:
            return worker, r.content or None
    except (HTTPErrorStatus, HTTPException) as e:
        logger.error(
            f"Could not get from {worker}'s {address=}/{endpoint=}, sent {json=} and returned {e}. Check connection? Check port?"
        )
        return worker, None
    except DecodeError:
        logger.error(
            f"Could not decode response from {worker}'s {endpoint=}, sent {json=} and returned {r.body}."
        )
        return worker, None


@huey.task(priority=5)
def multicast_get_across_cluster(
    endpoint: str,
    workers: list[str],
    json: dict | list[dict | None] | None = None,
    timeout: float = 5.0,
    return_raw=False,
) -> dict[str, Any]:
    # this function "consumes" one huey thread waiting fyi
    assert endpoint.startswith("/unit_api")

    if not isinstance(json, list):
        json = [json] * len(workers)

    tasks = get_from_worker.map(
        ((workers[i], endpoint, json[i], timeout, return_raw) for i in range(len(workers)))
    )
    return {
        worker: response for (worker, response) in tasks.get(blocking=True, timeout=30)
    }  # add a timeout so that we don't hold up a thread forever.


@huey.task(priority=10)
def patch_to_worker(worker: str, endpoint: str, json: dict | None = None) -> tuple[str, Any]:
    try:
        address = resolve_to_address(worker)
        r = patch_into(address, endpoint, json=json, timeout=1)
        r.raise_for_status()
        return worker, r.json() if r.content else None
    except (HTTPErrorStatus, HTTPException) as e:
        logger.error(
            f"Could not PATCH to {worker}'s {address=}/{endpoint=}, sent {json=} and returned {e}. Check connection? Check port?"
        )
        return worker, None
    except DecodeError:
        logger.error(
            f"Could not decode response from {worker}'s {endpoint=}, sent {json=} and returned {r.body}."
        )
        return worker, None


@huey.task(priority=5)
def multicast_patch_across_cluster(
    endpoint: str, workers: list[str], json: dict | None = None
) -> dict[str, Any]:
    # this function "consumes" one huey thread waiting fyi
    assert endpoint.startswith("/unit_api")

    tasks = patch_to_worker.map(((worker, endpoint, json) for worker in workers))

    return {
        worker: response for (worker, response) in tasks.get(blocking=True, timeout=30)
    }  # add a timeout so that we don't hold up a thread forever.


@huey.task(priority=10)
def delete_from_worker(worker: str, endpoint: str, json: dict | None = None) -> tuple[str, Any]:
    try:
        r = delete_from(resolve_to_address(worker), endpoint, json=json, timeout=1)
        r.raise_for_status()
        return worker, r.json() if r.content else None
    except (HTTPErrorStatus, HTTPException) as e:
        logger.error(
            f"Could not DELETE {worker}'s {endpoint=}, sent {json=} and returned {e}. Check connection?"
        )
        return worker, None
    except DecodeError:
        logger.error(
            f"Could not decode response from {worker}'s {endpoint=}, sent {json=} and returned {r.body}."
        )
        return worker, None


@huey.task(priority=5)
def multicast_delete_across_cluster(
    endpoint: str, workers: list[str], json: dict | None = None
) -> dict[str, Any]:
    # this function "consumes" one huey thread waiting fyi
    assert endpoint.startswith("/unit_api")

    tasks = delete_from_worker.map(((worker, endpoint, json) for worker in workers))

    return {
        worker: response for (worker, response) in tasks.get(blocking=True, timeout=30)
    }  # add a timeout so that we don't hold up a thread forever.
