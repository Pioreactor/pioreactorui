### Upcoming
 - Fixed bug that ignored `.yml` files
 - Security improvements
 - Ability to create and edit Experiment Profiles in the UI

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
