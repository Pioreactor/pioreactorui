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
