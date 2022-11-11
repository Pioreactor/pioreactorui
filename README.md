# PioreactorUI backend


### Starting development

`python3 -m flask --app main --debug run`. Test by going to `localhost:5000/api/get_latest_experiment` in a browser.

Run background workers with:

`huey_consumer.py tasks.huey`

### Production

This is behind a lighttp web server on the RPi. See [our lighttp config]().

#### Deployment

??


### Contributions

#### Adding an automation

You can add a X automation option by adding to a `.yaml` file to `backend/contrib/automations/X` folder. There is an example file under `backend/contrib/automations/automation.yaml.example`. The new automation will appear in the modal to switch automations on the /pioreactors page.


#### Adding a job

See the examples in `backend/contrib/background_jobs`. Under the hood, this runs `pio run <job_name>`.
