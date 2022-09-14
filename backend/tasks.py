import subprocess
from huey import SqliteHuey

huey = SqliteHuey("/tmp/test.db") # TODO: put into .env

@huey.task()
def add_new_pioreactor(new_pioreactor_name):

    result = subprocess.run(["pio", "add-pioreactor", "new_pioreactor_name"], capture_output=True)

    if result.returncode != 0:
        return True
    else:
        return False



    


