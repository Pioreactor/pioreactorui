### 25.5.22
 - New system logs page
 - bug fixes

### 25.5.1

 - update MUI
 - Upload Calibration dialog


### 25.4.9

Bug fixes

### 25.4.3

Bug fixes


### 25.3.31

#### Enhancements

- **Support for Pioreactor 40mL**
  - UI and backend now accommodates the new Pioreactor 40mL. Change the Pioreactor model on the Inventory page.
- **Device models and versions now tracked in the database**
  - Models and versions for each Pioreactor are now stored in the `worker` table.
  We're deprecating the `[pioreactor]` section in `config.ini`. You can manage models and versions on the **Inventory** page.
- **Improvements to dosing automation settings**:
  - When starting a dosing automation, you can set the initial and max culture volumes.

#### Bug Fixes

- Fixed occasional crash on the **Overview** page in the UI.
- UI page `/pioreactors/<some_unit>` now uses that unit's specific configuration from `config_<some_unit>.ini`.


### 25.3.5

 - Fix for updating across cluster and leader saying it failed


### 25.3.3

- **New time option on the Overview page: "Now" for only real-time data**
  - The UI now has a “Now” option that filters out historical data, displaying only real-time sensor readings and status updates.
- **Deprecation of `/unit_api/jobs/stop/...` endpoint**
  - The `/unit_api/jobs/stop/...` API endpoint is being deprecated in favor of using query parameters:
    - Instead of `/unit_api/jobs/stop/job_name`, use `/unit_api/jobs/stop/?job_name=...`.
    - The special case `/unit_api/jobs/stop/all` remains valid and unchanged.
- **Fix for "More" button in the Logs UI page**
  - Previously, clicking "More" in the Logs UI would default to "Standard" log level instead of retaining the selected filter. Now, it correctly uses the log level chosen by the user.
- **Fix for API returning incorrect responses for Huey-related tasks**
  - API responses related to background tasks (e.g., adding a new Pioreactor, syncing configs, updating firmware) were sometimes incorrect or missing details. This has been fixed.
- **Fix for missing log events in Event Logs after worker unassignment**
  - Some log events (such as clean-up and assignment events) were missing when they occurred after a worker was unassigned. These now appear correctly. Additionally, some unrelated log entries that were mistakenly displayed have been removed.

### 25.2.10
- **UI Improvements**:
  - Improved chart colors.
  - Added the ability to choose the level of detail on the new Event Logs page.
  - Ability to run multiple experiment profiles per experiment.
  - Users can now specify which Pioreactor to update on the Updates page (available only with release archives)
- Introduced:
  - `GET /unit_api/jobs/running/<job>`
  - `GET /api/experiment_profiles/running/experiments/<experiment>`
- Fixed UI not displaying third-party calibrations.
- Fixed manual dosing issues in the UI.
- Fixed manual log recording in the UI.

### 25.1.21
 - Bug fixes for the UI

### 25.1.20
 - Bug fixes for the UI


### 25.1.15

#### Highlights
 - New UI updates:
   - An `Event Logs` page for seeing the logs generated by your Pioreactors
   - A detailed overview of your cluster's leader-specific duties on the new `Leader`'s page.
     - See the Leader's filesystem, logs, update cluster clocks, and view important running jobs.
  - View different Pioreactors' plugins on the `Plugins` page, and install to specific Pioreactor vs entire cluster.
  - Manage your calibrations from the UI's new `Calibrations` page.
    - View existing calibrations, set active calibrations, and download calibration files.

#### Web API changes
 - New API to retrieve and set clocks on Pioreactors
  - GET `/api/units/<pioreactor_unit>/system/utc_clock`
  - GET `/unit_api/system/utc_clock`
  - POST `/api/system/utc_clock`
  - POST `/unit_api/system/utc_clock`
 - New log APIs
  - GET `/api/experiments/<experiment>/recent_logs`
  - GET `/api/experiments/<experiment>/logs`
  - GET `/api/logs`
  - GET `/api/workers/<pioreactor_unit>/experiments/<experiment>/recent_logs`
  - GET `/api/workers/<pioreactor_unit>/experiments/<experiment>/logs`
  - GET `/api/units/<pioreactor_unit>/logs`
  - POST `/workers/<pioreactor_unit>/experiments/<experiment>/logs`
 - New calibrations APIs
  - GET `/api/workers/<pioreactor_unit>/calibrations`
  - GET `/unit_api/calibrations`
  - GET `/unit_api/active_calibrations`
  - GET `/api/workers/<pioreactor_unit>/calibrations/<device>`
  - GET `/unit_api/calibrations/<device>`
  - PATCH `/api/workers/<pioreactor_unit>/active_calibrations/<device>/<cal_name>`
  - PATCH `/unit_api/active_calibrations/<device>/<cal_name>`
  - DELETE `/api/workers/<pioreactor_unit>/active_calibrations/<device>/<cal_name>`
  - DELETE `/api/workers/<pioreactor_unit>/calibrations/<device>/<cal_name>`
  - DELETE `/unit_api/active_calibrations/<device>/<cal_name>`
  - DELETE `/unit_api/calibrations/<device>/<cal_name>`
 - New API for plugins
  - GET `/api/units/<pioreactor_unit>/plugins/installed`
  - PATCH `/api/units/<pioreactor_unit>/plugins/install`
  - PATCH `/api/units/<pioreactor_unit>/plugins/uninstall`
 - Changed the `settings` API (see docs).
 - New `/api/units` that returns a list of units (this is workers & leader). If leader is also a worker, then it's identical to `/api/workers`
 - New `/api/experiments/<experiment>/historical_worker_assignments` that stores historical assignments to experiments
 - New Path API for getting the dir structure of `~/.pioreactor`:
  - `/unit_api/system/path/<path>`


### 24.12.10
 - Hotfix for UI settings bug


### 24.12.3
 - fix dosing in the UI not working in Manage All
 - New Export Data page
 - New API for exporting datasets

### 24.10.30
 - fix manual dosing updates in the UI not working.

### 24.10.29
 - fix for workers being locked up

### 24.10.28
 - fix for env bug


### 24.10.16 and 24.10.20
 - New dataset exports from the Export data page in the UI: calibrations and liquid-volumes.
 - Added a "partition by unit" option to the Export data page that will create a csv per Pioreactor in the export, instead of grouping them all together.
 - faster UI response times when starting jobs
 - Because we are now storing `liquid_volume` in the database, you can add charts in the UI that track the volume over time:
    1. Add the following yaml contents to `~/.pioreactor/plugins/contrib/charts/lqiuid_volume.yaml`: https://gist.github.com/CamDavidsonPilon/95eef30189101da69f706d02ef28d972
    2. In your config.ini, under `ui.overview.charts`, add the line `liquid_volume=1`.
 - New API endpoints for getting the current settings of a _running_ job:
    - Per pioreactor:
      - GET: `/unit_api/jobs/settings/job_name/<job_name>`
      - GET: `/unit_api/jobs/settings/job_name/<job_name>/setting/<setting>`
    - Across the cluster:
      - GET: `/api/jobs/settings/job_name/<job_name>/setting/<setting>`
      - GET: `/api/jobs/settings/job_name/<job_name>/experiments/<experiment>`
      - GET: `/api/jobs/settings/job_name/<job_name>/experiments/<experiment>/setting/<setting>`
      - GET: `/api/jobs/settings/workers/<unit>/job_name/<job_name>/experiments/<experiment>`
      - GET: `/api/jobs/settings/workers/<unit>/job_name/<job_name>/experiments/<experiment>/setting/<setting>`
   Ex: query the temperature of a Pioreactor: `curl http://pio01.local/unit_api/jobs/settings/job_name/temperature_automation/setting/temperature`



### 24.10.1
 - bug fix for "Manage all" that would start activities in all Pioreactors, whether they were in the experiment or not.
 - fix for bug when clicking a legend element it not hiding
 - fix
 - amount of data shown on charts is now a function of the OD sampling rate
 - allow for showing more than 16 workers in a chart.
 - bug fix for "color" error when many workers on a chart.
 - bug fix for leader starting when an experiment profile was started which referenced leader, even if the leader wasn't in the experiment.

### 24.9.25
 - Better experiment selection dropdown
 - replace momentjs with dayjs
 - reduce the list of supported browsers

### 24.9.20
 - fixes to the UI for new json version api

### 24.9.19
 - improvements to kill jobs

### 24.9.18
 - API changes for update routines (and lots more).

### 24.9.17
 - fixes for pumping dialogs

### 24.9.16
 - lots of backend changes to support new worker web APIs. Too numerous to list, so see our docs.
 - remove updating to development version. This was confusing and error prone for users. If a user wants development version, they can "pay the toll" of SSHing in to do it.
 - fixed Hours Elapsed not updating in Overview
 - New menu for inventory bulk actions


### 24.8.21
 - adding `inputs` to experiment profiles
 - breaking up logs in log tables
 - better empty state on Pioreactors
 - make deleting an experiment more clear
 - use new config `logging` `ui_log_file` location instead in the .env
 - return new leader-only config.


### 24.7.18 & 24.7.19
 - The Chips release! Lots of chips
 - Support the removal of "controller" code. This includes new background job contrib files that reference `*_automations` instead of controllers.


### 24.7.3
 - significant web backend API changes! See list of rules in docs.
 - A new live preview in the UI's experiment profile editor. This preview tool is useful for getting immediate feedback when writing a profile. We'll keep on adding to this to improve the edit-profile workflow - please send us feedback!
 - Better user interaction on the Pioreactors page when the assigned experiment and "viewing" experiment are different.
 - Select / Deselect all Pioreactors to assign to an experiment faster.
 - Fix UI code editor from being unresponsive when all the text was removed.
 - Experiment profiles won't be overwritten if providing the same filename as an existing profile.


### 24.6.11
- 24.6.10 was a bad release


### 24.6.10

 - more additions to the Pioreactor page
 - fix performing an "undo" when editing the config.ini and experiment profiles.
 - Changed the web backend API endpoints for time-series, logs, shutdown, reboot, and plugins to be more RESTful. See docs for updated rules in the docs.
 - better clean up when a worker is removed from a cluster.
 - Added a "retry failed tests" to the UI's self-test dialog.


### 24.5.31 && 24.5.32
 - New /pioreactor/`worker` page
 - New MQTT topic for logs

### 24.5.20 & 24.5.21
 - small updates

### 24.5.13
 - major upgrade of packages, including MUI, react, victory and more.
 - removed unused packages
 - UI's code sections use syntax-highlighting and other nicer features for editing yaml and ini files.
 - UI chart legend's will support more than 8 Pioreactors.
 - UI chart colors are consistent across charts in the Overview.
 - fix "Manage all" not sending the correct dosing command to workers.


### 24.4.30
 - Support for Pioreactor 20ml v1.1
 - Lots of small UI interactions:
   - better default states
   - better "loading" screens
   - a11y improvements


### 24.4.11
 - first update ui, before other things.

### 24.4.10
 - updates for the latest app release
 - some accessibility improvements
 - adding RPi model to inventory page
 - log when a pioreactor changes experiment or active status

### 24.4.4
 - Fix log table not showing entries
 - Fix button not showing up in UI

### 24.4.3
 - Bug fixes from 24.4.2

### 24.4.2
 - Major overhaul to experiments and inventory
 - new API backend (docs: https://docs.pioreactor.com/developer-guide/web-ui-api#all-endpoints)
 - Performance updates

### 24.3.9
 - performance improvements by using less backend calls

### 24.3.8
 - performance improvements by using less mqtt clients.

### 24.3.5
 - Fix experiment profile name not showing up.

### 24.3.4
 - Fixes for the library swap to MQTT.js
 - Performance improvements
 - Dynamically disable / enable "update" options

### 24.2.25
 - Change MQTT library to mqtt.js
 - Fix media card
 - fixed bug that was partially crashing the UI if some bad syntax was entered into a custom yaml file. Sorry!
 - fixed bug that was causing bad json from the server, causing empty / non-loading areas in the UI. Sorry!
 - fixed `datum` bug in the Overview that was crashing the UI. Sorry!
 - added Pioreactor specific software version to the UI: Page *Pioreactors -> Manage -> System -> Version*


### 24.2.9
 - fixed a bug that was causing colors between graphs to not be aligned
 - adding grouped buttons for changing chart settings

### 24.1.30
 - profiles in the UI are sorted by their last edit time.
 - fixed a bug in the chart of OD reading that was causing historical and realtime data to be different lines.
 - new profiles for next Pioreactor release

### 24.1.25
 - Update experiment profiles:
  - fix errors when there are no profiles
  - highlights
  - update to new profile schema
 - Updates for new OD topics in MQTT
 - Update chart schema to allow for lists in `mqtt_topic`

### 24.1.12
 - fix initial state of boolean switches

### 24.1.8
 - added MAC address to system tab
 - fixing export bug
 - adding `ir_led_intensities` to exports page

### 23.12.10
 - Ability to update via our release_archives (available on the github release page) via the UI. To turn this feature off (which is a recommended practice when you expose your UI publically), add an empty file called `DISALLOW_UI_UPLOADS` to the `~/.pioreactor` directory.

### 23.11.31
 - Fix for exporting data from the UI


### 23.11.30
 - The automation form in the UI for pid_morbidostat was missing `volume`, that's been added now.
 - UI tweaks

### 23.11.29
 - new `type` for fields of automations. Currently available: `numeric` and `string`
 - light validation for automation forms
 - Merged the turbidostat automations into one. You can either select target target nOD or target OD, but not both!


### 23.11.28
 - Include both Target nOD and Target OD.

### 23.11.27
 - The "Stop" button is always available now in the "Dosing" tab for "Manage all Pioreactors".
 - Fix for Ngrok remote access
 - When using "hours" for charts, this also changes the Log Table's "time" column

### 23.11.18
 - The "Label" step in the New Experiment flow is skipped if there is only 1 active Pioreactor in the cluster.
 - Simplify some UI elements.
 - Security improvements
 - Reduce the default LED intensity in `light_dark_cycle` from 50% to 5%. This is more appropriate for sparse cultures.

### 23.11.08
 - some updates for the 23.11.08 release of Pioreactor software.

### 23.10.20
 - Prepare for bookworm release
 - Adding ability to change x-axis to duration since experiment start, instead of clock time.
 - small UI improvements

### 23.10.10
 - Fix bug that wasn't allowing for manual dosing / LED updates.

### 23.10.4
 - Adding "install plugin by name" button to UI.

### 23.9.20
 - Fixing /updates bug

### 23.9.19
 - Adding a RPi shutdown button to the UI.

### 23.9.18
 - Fixed bug that ignored `.yml` files
 - Security improvements
 - Ability to create and edit Experiment Profiles in the UI
 - The dropdown for historical config files was dropping the latest entry. This has been fixed.

### 23.8.28
 - Pioreactor's IPv4 and hostname is now displayed under System in the UI.
 - added another self-test test to confirm that an aturbid liquid in vial will produce a near 0 signal.
 - general improvements to self-test

### 23.7.31
 - copy changes and improvements
 - fixed bug that had the wrong units and defaults for Light Dark Cycle automation

### 23.7.25
 - Mostly copy changes and improvements

### 23.6.26
 - Adding ability to upgrade to develop branches

### 23.6.6
 - Adding manual dosing adjustment form under Dosing tab
 - Adding support for experiment profiles

### 23.5.9
 - New PWM voltage in Systems card.
 - Improvements to changing LED values.

### 23.4.14
 - Added new "Past Experiments" page
 - Query params can be added to `/export-data` that will populate the datasets and experiment to export
 - New API routes for some endpoints: `/api/stop`, `/api/run`, `/api/unit_labels/`. See docs: https://docs.pioreactor.com/developer-guide/web-ui-api

### 23.4.3
 - Backend work to complete calibrations utilities:
   - Edits to the `calibrations` table in the database require a full drop and recreation.
   - New API endpoints on the webserver to store calibrations, get calibrations, set as current, etc.
   - add robots.txt that disallows crawlers

### 23.3.20
 - New route `/api/installed_plugins/<filename>` for getting back specific Python files in the plugins folder. Later, this will be generalized to getting entry_point plugins, too.
 - Python files in `plugins/` folder on leader are viewable on the /plugins page in the UI.
 - Python files in `plugins/` folder on leader are uninstallable (aka deleted) on the /plugins page in the UI.
 - Better workflow for starting a new experiment

### 23.3.15
 - Performance improvements
 - Better empty states

### 23.3.8
 - Adding `lookback` parameter to all charts.
 - Changes to make charts YAML options more flexible

### 23.3.6
 - Fix 'resume' / 'pause' text switching
 - huey.db now lives in /tmp/pioreactorui_cache

### 23.3.1
 - Better manual dosing page
 - Pioreactor hardware version and serial number are displayed in the `/pioreactor` page, under `Manage` -> `System`.

### 23.2.16
 - Fix chart issue where data from od_readings wasn't being displayed correctly if multiple non-REF sensors were used.

### 23.2.10
 - Better error handling when a yaml file is not correct format.
 - Improvements to Plugins page


### 23.2.6
 - Adding `pioreactor_unit_activity_data_rollup` to exportable datasets.

### 23.2.4
Lots of changes the the backend API, make note!

 - The API is more RESTful now.
 - Changing settings now have a button to update settings, along with hitting the `enter` key
 - Under all Pioreactor settings, boolean settings now show up correctly.
 - Fixed error where a large cache was not able to be written to disk due to permissions errors.
 - Time series charts are now able to be added the the UI. Put a yaml file under `~/.pioreactor/plugins/ui/contrib/charts`

### 23.1.1
 - Fix for `led_change_events` export.
 - Fixes for `fraction_of_volume_that_is_alternative_media` chart in the UI.
 - The UI will warn you if it's not able to connect to MQTT

### 23.1.0
 - add `/api/get_ui_version`

### 22.12.0
 - First changelog entry.
 - Fix caching bug that was preventing the UI from displaying newly added Pioreactors.
