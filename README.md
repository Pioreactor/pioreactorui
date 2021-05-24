# PioreactorUI


### Starting development

run `npm run dev`in both the `client/` and `backend/` folder. Test by going to `localhost:3000` in a browser.

### Adding to the UI


#### Adding an automation

You can add a X automation option by adding to a `.yaml` file to `backend/contrib/automations/X` folder. There is an example file under `backend/contrib/automations/automation.yaml.example`. The new automation will appear in the modal to switch automations on the /pioreactors page.


#### Adding a job

See the examples in `backend/contrib/background_jobs`. Under the hood, this runs `pio run <job_name>`.