import subprocess
from huey import SqliteHuey

huey = SqliteHuey("/tmp/test.db") # TODO: put into .env

@huey.task()
def add_new_pioreactor(new_pioreactor_name) -> tuple[bool, str]:
    print(f"Adding new pioreactor {new_pioreactor_name}")
    result = subprocess.run(["pio", "add-pioreactor", "new_pioreactor_name"], capture_output=True)

    if result.returncode != 0:
        return False, str(result.stderr)
    else:
        return True, str(result.stderr)


@huey.task()
def update_app(new_pioreactor_name) -> tuple[bool, str]:
    print(f"Updating apps")
    subprocess.run(["pio", "update", "--app"])
    subprocess.run(["pios", "update"])
    subprocess.run(["pio", "update", "--ui"])
    return True






    


