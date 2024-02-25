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
