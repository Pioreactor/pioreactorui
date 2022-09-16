# -*- coding: utf-8 -*-
from __future__ import annotations

import subprocess

from huey import SqliteHuey

huey = SqliteHuey(filename="huey.db")


@huey.task()
def add_new_pioreactor(new_pioreactor_name) -> tuple[bool, str]:
    print(f"Adding new pioreactor {new_pioreactor_name}")
    result = subprocess.run(
        ["pio", "add-pioreactor", new_pioreactor_name], capture_output=True, text=True
    )

    if result.returncode != 0:
        return False, str(result.stderr)
    else:
        return True, str(result.stderr)


@huey.task()
def update_app(new_pioreactor_name) -> bool:
    print("Updating apps")
    subprocess.run(["pio", "update", "--app"])
    subprocess.run(["pios", "update"])
    subprocess.run(["pio", "update", "--ui"])
    return True


@huey.task()
def pio(*args) -> tuple[bool, str]:
    result = subprocess.run(("pio",) + args, capture_output=True, text=True)
    print(result.stdout)
    print(result.stderr)
    if result.returncode != 0:
        return False, result.stderr
    else:
        return True, result.stdout


@huey.task()
def pios(*args) -> tuple[bool, str]:
    result = subprocess.run(("pios",) + args, capture_output=True, text=True)
    print(result.stdout)
    print(result.stderr)
    if result.returncode != 0:
        return False, result.stderr
    else:
        return True, result.stdout


@huey.task()
def write_config(config_path, text) -> tuple[bool, str]:
    try:
        with open(config_path, "w") as f:
            f.write(text)
        return (True, "")
    except Exception as e:
        return False, str(e)
