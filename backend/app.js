const express = require('express');
var https = require('https')

const path = require('path');
const bodyParser = require('body-parser');
const dotenv = require('dotenv').config()
const url = require('url');
const { execFile } = require("child_process");
const cp = require('child_process');
const dblite = require('dblite')
const fs = require('fs')
const expressStaticGzip = require("express-static-gzip");
const compression = require('compression');
const yaml = require('js-yaml');
const mqtt = require('mqtt')
const os = require("os");


const app = express()
app.use(bodyParser.json());
app.use(compression());


var db = dblite(process.env.DB_LOCATION)


// connect to MQTT
var client  = mqtt.connect('mqtt://localhost:1883')
const LOG_TOPIC = `pioreactor/${os.hostname()}/$experiment/logs/ui`


///////////// UTILS ////////////////////
msgToJSON = (msg, task, level) => {
  return JSON.stringify({message: msg.trim(), task: task, source: 'ui', level: level, timestamp: new Date().toISOString() })
}

publishToLog = (msg, task, level="DEBUG") => {
  console.log(msg)
  client.publish(LOG_TOPIC, msgToJSON(msg, task, level))
}

publishToErrorLog = (msg, task) => {
  console.log(msg)
  publishToLog(JSON.stringify(msg), task, "ERROR")
}


db.on('error', function (err) {
  // log any DB errors.
  // TODO: I don't think this is working...
  publishToErrorLog(err.toString(), 'db');
});


///////////// ROUTES ///////////////////

app.get('/', function(req, res) {
    res.redirect(301, '/overview');
})

app.get('/overview', function(req, res) {
    app.use("/", expressStaticGzip(path.join(__dirname, 'build')));
    res.set({
        "Access-Control-Allow-Origin": "*",
    });
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
})

app.get('/export-data', function(req, res) {
    app.use("/", expressStaticGzip(path.join(__dirname, 'build')));
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
})

app.get('/start-new-experiment', function(req, res) {
    app.use("/", expressStaticGzip(path.join(__dirname, 'build')));
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
})

app.get('/plugins', function(req, res) {
    app.use("/", expressStaticGzip(path.join(__dirname, 'build')));
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
})

app.get('/analysis', function(req, res) {
    app.use("/", expressStaticGzip(path.join(__dirname, 'build')));
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
})

app.get('/feedback', function(req, res) {
    app.use("/", expressStaticGzip(path.join(__dirname, 'build')));
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
})

app.get('/config', function(req, res) {
    app.use("/", expressStaticGzip(path.join(__dirname, 'build')));
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
})

app.get('/pioreactors', function(req, res) {
    app.use("/", expressStaticGzip(path.join(__dirname, 'build')));
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
})

// not active
app.get('/pioreactors/:unit', function(req, res) {
    app.use("/", expressStaticGzip(path.join(__dirname, 'build')));
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
})

app.get('/updates', function(req, res) {
  app.use("/", expressStaticGzip(path.join(__dirname, 'build')));
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
})

app.get('/calibrations', function(req, res) {
  app.use("/", expressStaticGzip(path.join(__dirname, 'build')));
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
})




//////////////// PIOREACTOR CONTROL ////////////////////

app.post('/stop_all', function (req, res) {
  execFile("pios", ["kill"].concat(["--all-jobs"]).concat(["-y"]), (error, stdout, stderr) => {
    if (error) {
        publishToErrorLog(error, 'stop_all')

    }
    if (stderr) {
        publishToLog(stderr, 'stop_all')

    }
  })
  res.sendStatus(200)
});


app.post('/stop/:job/:unit', function (req, res) {

  job = req.params.job
  unit = req.params.unit

  // two options: kill over mqtt, or kill over ssh. It depends on the job.
  jobsToKillOverMQTT = ["add_media", "add_alt_media", "remove_waste"]

  if (jobsToKillOverMQTT.includes(job)){
    client.publish(`pioreactor/${unit}/$experiment/${job}/$state/set`, "disconnected", {qos: 2})
    res.sendStatus(200)
  }
  else {
    execFile("pios", ["kill", job, "-y", "--units", unit], (error, stdout, stderr) => {
      if (error) {
          publishToErrorLog(error, 'stop')

      }
      if (stderr) {
          publishToLog(stderr, 'stop')

      }
      publishToLog(stdout, 'stop')

    })
    res.sendStatus(200)
  }
 })

app.post("/run/:job/:unit", function(req, res) {
    // we start jobs over MQTT instead - this would saves some time on not having to invoke python / pios

    unit = req.params.unit
    job = req.params.job

    client.publish(`pioreactor/${unit}/$experiment/run/${job}`, JSON.stringify(req.body), {qos: 2})
    res.sendStatus(200)

    /*
    // TODO: is this a security risk?
    options = Object.entries(req.body).map(k_v => [`--${k_v[0].replace(/_/g, "-")} ${k_v[1]}`])

    execFile("pios", ["run", job, "-y", "--units", unit].concat(options), (error, stdout, stderr) => {
        if (error) {
            publishToErrorLog(error)

            res.sendStatus(500)
            return
        }
        if (stderr) {

            publishToLog(stderr)
            res.sendStatus(200)
            return
        }
        publishToLog(stdout)

        res.sendStatus(200)
    });
    */
})



app.post('/reboot/:unit', function (req, res) {

  unit = req.params.unit

  execFile("pios", ["reboot", "-y", "--units", unit], (error, stdout, stderr) => {
    if (error) {
        publishToErrorLog(error, 'reboot')

    }
    if (stderr) {
        publishToLog(stderr, 'reboot')

    }
    publishToLog(stdout, 'reboot')

  })
  res.sendStatus(200)
})

/////////// DATA FOR CARDS ON OVERVIEW ///////////////


app.get('/recent_logs', function (req, res) {
  // TODO: this query can get really slow when the log table starts to fill up.
  const queryObject = url.parse(req.url, true).query; // assume that all query params are optional args for the job
  const minLevel = queryObject['min_level'] || "INFO"

  if (minLevel == "DEBUG"){
    levelString = '(level == "ERROR" or level == "WARNING" or level == "NOTICE" or level == "INFO" or level == "DEBUG")'
  }
  else if (minLevel == "INFO") {
    levelString = '(level == "ERROR" or level == "NOTICE" or level == "INFO" or level == "WARNING")'
  }
  else if (minLevel == "WARNING") {
    levelString = '(level == "ERROR" or level == "WARNING")'
  }
  else if (minLevel == "ERROR") {
    levelString = '(level == "ERROR")'
  }
  else{
    levelString = '(level == "ERROR" or level == "NOTICE" or level == "INFO" or level == "WARNING")'
  }

  db.query(`SELECT l.timestamp, level=="ERROR" as is_error, level=="WARNING" as is_warning, level=="NOTICE" as is_notice, l.pioreactor_unit, message, task FROM logs AS l LEFT JOIN latest_experiment AS le ON (le.experiment = l.experiment OR l.experiment=:universalExperiment) WHERE ${levelString} and l.timestamp >= MAX(strftime('%Y-%m-%dT%H:%M:%S', datetime('now', '-24 hours')), le.created_at) ORDER BY l.timestamp DESC LIMIT 50;`,
    {universalExperiment: "$experiment",  levelString: levelString},
    {timestamp: String, is_error: Boolean, is_warning: Boolean, is_notice: Boolean, pioreactor_unit: String, message: String, task: String},
    function (err, rows) {
      if (err){
        publishToErrorLog(err, 'recent_logs')

        res.sendStatus(500)
      } else {
        res.send(rows)
      }
    })
})


app.get('/time_series/growth_rates/:experiment', function (req, res) {
  const experiment = req.params.experiment
  const queryObject = url.parse(req.url, true).query; // assume that all query params are optional args for the job
  const filterModN = queryObject['filter_mod_N'] || 100

  db.query(
    "SELECT json_object('series', json_group_array(unit), 'data', json_group_array(json(data))) FROM (SELECT pioreactor_unit as unit, json_group_array(json_object('x', timestamp, 'y', round(rate, 5))) as data FROM growth_rates WHERE experiment=:experiment AND ((ROWID * 0.61803398875) - cast(ROWID * 0.61803398875 as int) < 1.0/:filterModN) GROUP BY 1);",
    {experiment: experiment, filterModN: filterModN},
    {results: String},
    function (err, rows) {
      if (err){
        publishToErrorLog(err, 'growth_rates')

        res.sendStatus(500)
      } else {
        res.send(rows[0]['results'])
      }
    })
})


app.get('/time_series/temperature_readings/:experiment', function (req, res) {
  const experiment = req.params.experiment
  const queryObject = url.parse(req.url, true).query; // assume that all query params are optional args for the job
  const filterModN = queryObject['filter_mod_N'] || 100

  db.query(
    "SELECT json_object('series', json_group_array(unit), 'data', json_group_array(json(data))) FROM (SELECT pioreactor_unit as unit, json_group_array(json_object('x', timestamp, 'y', round(temperature_c, 2))) as data FROM temperature_readings WHERE experiment=:experiment AND ((ROWID * 0.61803398875) - cast(ROWID * 0.61803398875 as int) < 1.0/:filterModN) GROUP BY 1);",
    {experiment: experiment, filterModN: filterModN},
    {results: String},
    function (err, rows) {
      if (err){
        publishToErrorLog(err, 'temperature_readings')

        res.sendStatus(500)
      } else {
        res.send(rows[0]['results'])
      }
    })
})



app.get('/time_series/od_readings_filtered/:experiment', function (req, res) {
  const experiment = req.params.experiment
  const queryObject = url.parse(req.url, true).query; // assume that all query params are optional args for the job
  const filterModN = queryObject['filter_mod_N'] || 100
  const lookback = queryObject['lookback'] || 4

  db.query(
    "SELECT json_object('series', json_group_array(unit), 'data', json_group_array(json(data))) FROM (SELECT pioreactor_unit as unit, json_group_array(json_object('x', timestamp, 'y', round(normalized_od_reading, 7))) as data FROM od_readings_filtered WHERE experiment=:experiment AND ((ROWID * 0.61803398875) - cast(ROWID * 0.61803398875 as int) < 1.0/:filterModN) AND timestamp > strftime('%Y-%m-%dT%H:%M:%S', datetime('now', :lookback)) GROUP BY 1);",
    {experiment: experiment, filterModN: filterModN, lookback: `-${lookback} hours`},
    {results: String},
    function (err, rows) {
      if (err){
        publishToErrorLog(err, 'od_readings_filtered')

        res.sendStatus(500)
      } else {
        res.send(rows[0]['results'])
      }
    })
})


app.get('/time_series/od_readings/:experiment', function (req, res) {
  const experiment = req.params.experiment
  const queryObject = url.parse(req.url, true).query; // assume that all query params are optional args for the job
  const filterModN = queryObject['filter_mod_N'] || 100
  const lookback = queryObject['lookback'] || 4

  db.query(
    "SELECT json_object('series', json_group_array(unit), 'data', json_group_array(json(data))) FROM (SELECT pioreactor_unit || '-' || channel as unit, json_group_array(json_object('x', timestamp, 'y', round(od_reading, 7))) as data FROM od_readings WHERE experiment=:experiment AND ((ROWID * 0.61803398875) - cast(ROWID * 0.61803398875 as int) < 1.0/:filterModN) and timestamp > strftime('%Y-%m-%dT%H:%M:%S', datetime('now', :lookback)) GROUP BY 1);",
    {experiment: experiment, filterModN: filterModN, lookback: `-${lookback} hours`},
    {results: String},
    function (err, rows) {
      if (err){
        publishToErrorLog(err, 'od_readings')

        res.sendStatus(500)
      } else {
        res.send(rows[0]['results'])
      }
    })
})

app.get('/time_series/alt_media_fraction/:experiment', function (req, res) {
  const experiment = req.params.experiment
  const queryObject = url.parse(req.url, true).query; // assume that all query params are optional args for the job

  db.query(
    "SELECT json_object('series', json_group_array(unit), 'data', json_group_array(json(data))) FROM (SELECT pioreactor_unit as unit, json_group_array(json_object('x', timestamp, 'y', round(alt_media_fraction, 7))) as data FROM alt_media_fractions WHERE experiment=:experiment GROUP BY 1);",
    {experiment: experiment},
    {results: String},
    function (err, rows) {
      if (err){
        publishToErrorLog(err, 'alt_media_fraction')

        res.sendStatus(500)
      } else {
        res.send(rows[0]['results'])
      }
    })
})


app.get("/recent_media_rates", function (req, res) {
  const hours = 3
  function fetch(){
    db.query(`SELECT d.pioreactor_unit, SUM(CASE WHEN event="add_media" THEN volume_change_ml ELSE 0 END) / :hours AS mediaRate, SUM(CASE WHEN event="add_alt_media" THEN volume_change_ml ELSE 0 END) / :hours AS altMediaRate FROM dosing_events AS d JOIN latest_experiment USING (experiment) WHERE datetime(d.timestamp) >= datetime('now', '-:hours Hour') AND event IN ('add_alt_media', 'add_media') AND source_of_event LIKE 'dosing_automation%' GROUP BY d.pioreactor_unit;`,
      {hours: hours},
      {pioreactor_unit: String, mediaRate: Number, altMediaRate: Number},
      function(err, rows) {
        if (err){
          publishToErrorLog(err, 'recent_media_rates')

          return setTimeout(fetch, 250)
        }
        var jsonResult = {}
        var aggregate = {altMediaRate: 0, mediaRate: 0}
        for (const row of rows){
          jsonResult[row.pioreactor_unit] = {altMediaRate: row.altMediaRate, mediaRate: row.mediaRate}
          aggregate.mediaRate = aggregate.mediaRate + row.mediaRate
          aggregate.altMediaRate = aggregate.altMediaRate + row.altMediaRate
        }
        jsonResult["all"] = aggregate
        res.json(jsonResult)
    })
  }
  fetch()
})


//////////////// calibrations //////////////



app.get('/calibrations/:unit/:type', function (req, res) {
  type = req.params.type
  pioreactor_unit = req.params.unit

  db.query(
    "SELECT * FROM calibrations WHERE type=:type AND pioreactor_unit=:pioreactor_unit;",
    {type: type, pioreactor_unit: pioreactor_unit},
    {results: String},
    function (err, rows) {
      if (err){
        publishToErrorLog(err, 'calibrations')

        res.sendStatus(500)
      } else {
        if (rows.length > 0) {
          res.send(rows[0]['results'])
        }
        else {
          res.send({})
        }
      }
    })
})




//////////////// plugins //////////////////


app.get('/get_installed_plugins', function(req, res) {

  execFile("pio", ["list-plugins", "--json"], (error, stdout, stderr) => {
      if (error) {
        publishToErrorLog(error, 'get_installed_plugins')
        res.send([])
      }
      else if (stderr) {
        publishToLog(stderr, 'get_installed_plugins')
        res.send([]) // does this belong here?
      }
      else{
        res.send(stdout)
      }
  })
})

app.post('/install_plugin', function(req, res) {

  execFile("pios", ["install-plugin", req.body.plugin_name], (error, stdout, stderr) => {
      if (error) {
        publishToErrorLog(error, 'install_plugin')
        res.sendStatus(500)
      }
      else if (stderr) {
        publishToLog(stderr, 'install_plugin')
        res.sendStatus(200)
      }
      else {
        res.sendStatus(200)
    }
  })
})


app.post('/uninstall_plugin', function(req, res) {

  execFile("pios", ["uninstall-plugin", req.body.plugin_name], (error, stdout, stderr) => {
      if (error) {
        publishToErrorLog(error, 'uninstall_plugin')
        res.sendStatus(500)
      }
      else if (stderr) {
        publishToLog(stderr, 'uninstall_plugin')
        res.sendStatus(200)
      }
      else {
        res.sendStatus(200)
    }
  })
})







////////////// MISC ///////////////////


app.get("/contrib/automations/:type", function(req, res) {
  try {
    const automationPath = path.join(process.env.CONTRIB_FOLDER, "automations", req.params.type)
    var files = fs.readdirSync(automationPath).filter(fn => (fn.endsWith('.yml') || fn.endsWith('.yaml')));
    var jsonDesc = files.map(file => yaml.load(fs.readFileSync(path.join(automationPath, file))))
    res.json(jsonDesc)
  } catch (e) {
    publishToErrorLog(e, 'contrib_automation')

    res.sendStatus(500)
  }
})


app.get("/contrib/jobs", function(req, res) {
  try {
    const automationPath = path.join(process.env.CONTRIB_FOLDER, "jobs")
    var files = fs.readdirSync(automationPath).filter(fn => (fn.endsWith('.yml') || fn.endsWith('.yaml')));
    var jsonDesc = files.map(file => yaml.load(fs.readFileSync(path.join(automationPath, file))))
    res.json(jsonDesc)
  } catch (e) {
    publishToErrorLog(e, 'contrib_jobs')

    res.sendStatus(500)
  }
})



app.post("/update_app", function (req, res) {
    var child = cp.fork('./child_tasks/update_app');
    child.on('message', function(result) {
      if (result.result) {
          res.sendStatus(200)
      }
      else{
        publishToErrorLog(result.msg, 'update_app')

        res.sendStatus(500)
      }
    });
    child.send(1);
})

app.get('/get_app_version', function(req, res) {

  execFile("python", ["-c", 'import pioreactor; print(pioreactor.__version__)'], (error, stdout, stderr) => {
      if (error) {
        console.log(error)
      }
      if (stderr) {
        console.log(stderr)
      }
      res.send(stdout.trim())
  })

  //// this is too slow:
  //execFile("pio", ["version"], (error, stdout, stderr) => {
  //    if (error) {

  //    }
  //    if (stderr) {

  //    }
  //    res.send(stdout.trim())
  //})
})

app.post('/export_datasets', function(req, res) {
    var child = cp.fork('./child_tasks/db_export');

    child.on('message', function(result) {
      if (result.result) {
        publishToLog(result.msg, 'export_datasets')
        res.json({filename: result.filename})
      }
      else{
        publishToErrorLog(result.msg, 'export_datasets')

        res.sendStatus(500)
      }
    });
    child.send(req.body);
})


app.get('/get_experiments', function (req, res) {
  db.query(
    'SELECT experiment, created_at, description FROM experiments ORDER BY created_at DESC;',
    ["experiment", "created_at", "description"],
    function (err, rows) {
      if (err){
        publishToErrorLog(err, 'get_experiments')

        res.sendStatus(500)
      } else {
        res.send(rows)
     }
    })
})

app.get('/get_latest_experiment', function (req, res) {
  function fetch() {
    db.query(
      'SELECT experiment, created_at, description, media_used, organism_used, delta_hours FROM latest_experiment',
      {experiment: String, created_at: String, description: String, media_used: String, organism_used: String, delta_hours: Number},
      function (err, rows) {
        if (err) {
          publishToErrorLog(err, 'get_latest_experiment')

          return setTimeout(fetch, 150)
        }
        res.send(rows[0])
    })
  }
  fetch()
})


app.get('/get_current_unit_labels', function (req, res) {
  function fetch() {
    db.query(
      'SELECT r.pioreactor_unit, r.label FROM pioreactor_unit_labels AS r JOIN latest_experiment USING (experiment);',
      {pioreactor_unit: String, label: String},
      function (err, rows) {
        if (err) {
          publishToErrorLog(err, 'get_current_unit_labels')

          return setTimeout(fetch, 500)
        }

        var byUnit = rows.reduce(function(map, obj) {
            map[obj.pioreactor_unit] = obj.label;
            return map;
        }, {});

        res.send(byUnit)
    })
  }
  fetch()
})

app.post("/update_current_unit_labels", function (req, res, next) {
    const unit = req.body.unit
    const label = req.body.label
    db.query("SELECT experiment FROM latest_experiment", function(err, rows) {
      const latest_experiment = rows[0][0]
      var upsert = 'INSERT OR REPLACE INTO pioreactor_unit_labels (label, experiment, pioreactor_unit, created_at) VALUES ((?), (?), (?), strftime("%Y-%m-%dT%H:%M:%S", datetime("now")) ) ON CONFLICT(experiment, pioreactor_unit) DO UPDATE SET label=excluded.label, created_at=strftime("%Y-%m-%dT%H:%M:%S", datetime("now"))'
      db.ignoreErrors = true; // this is a hack to avoid dblite from freezing when we get a db is locked.
      db.query(upsert, [label, latest_experiment, unit], function(err, _){
          if (err){
            res.sendStatus(500)
          } else {
            res.sendStatus(200)
            client.publish(`pioreactor/${unit}/${latest_experiment}/unit_label`, label, {retain: true})
          }
      })
    })
})


app.get('/get_historical_organisms_used', function (req, res) {
  function fetch() {
    db.query(
      'SELECT DISTINCT organism_used as key FROM experiments WHERE NOT (organism_used IS NULL OR organism_used == "") ORDER BY created_at DESC;',
      {key: String},
      function (err, rows) {
        if (err) {
          publishToErrorLog(err, 'get_historical_organisms_used')

          res.send([])
        }
        res.send(rows)
    })
  }
  fetch()
})


app.get('/get_historical_media_used', function (req, res) {
  function fetch() {
    db.query(
      'SELECT DISTINCT media_used as key FROM experiments WHERE NOT (media_used IS NULL OR media_used == "") ORDER BY created_at DESC;',
      {key: String},
      function (err, rows) {
        if (err) {
          publishToErrorLog(err, 'get_historical_media_used')
          res.send([])
        }
        res.send(rows)
    })
  }
  fetch()
})


app.post("/create_experiment", function (req, res) {
    // I was hitting this bug https://github.com/WebReflection/dblite/issues/23 in the previous code that tried
    // to rawdog an insert. I now manually check... sigh.
    body = req.body
    db.query("SELECT experiment FROM experiments WHERE experiment=:experiment", {experiment: body.experiment}, function(err, rows){
        if (rows.length > 0){
          res.sendStatus(422)
          return
        }
        else{
          db.ignoreErrors = true; // this is a hack to avoid dblite from freezing when we get a db is locked.
          var insert = 'INSERT INTO experiments (created_at, experiment, description, media_used, organism_used) VALUES (?,?,?,?,?)'
          db.query(insert, [body.created_at, body.experiment, body.description, body.mediaUsed, body.organismUsed], function(err, rows){
            if (err){
              publishToErrorLog(err, 'create_experiment')
              next(err)
              res.sendStatus(500)
            } else {
              res.sendStatus(200)
              // success, so publish to MQTT too.
              client.publish("pioreactor/latest_experiment", body.experiment, {qos: 2, retain: true})

            }
            return
          })
      }
  })
})

app.post("/update_experiment_desc", function (req, res, next) {
    var update = 'UPDATE experiments SET description = (?) WHERE experiment=(?)'
    db.ignoreErrors = true; // this is a hack to avoid dblite from freezing when we get a db is locked.
    db.query(update, [req.body.description, req.body.experiment], function(err, _){
        if (err){
          // publishToErrorLog(err) probably a database is locked error, ignore.

          res.sendStatus(500)
        } else {
          res.sendStatus(200)
        }
    })
})

app.post("/add_new_pioreactor", function (req, res) {
    // req.body contains fields newPioreactorName, ipAddress
    var child = cp.fork('./child_tasks/add_new_pioreactor');
    child.on('message', function(result) {
      if (result.result) {
        publishToLog("Pioreactor added.", 'add_new_pioreactor')
        res.sendStatus(200)
      }
      else{
        publishToErrorLog(result.msg, 'add_new_pioreactor')

        res.status(500).json(result)
      }
    });
    child.send(req.body);
})



/////////// CONFIG CONTROL ////////////////

app.get("/get_config/:filename", function(req, res) {
  // get a specific config.ini files in the .pioreactor folder
  var configPath = path.join(process.env.CONFIG_INI_FOLDER, req.params.filename);
  res.send(fs.readFileSync(configPath))
})

app.get("/get_configs", function(req, res) {
  // get a list of all config.ini files in the .pioreactor folder
  var configPath = process.env.CONFIG_INI_FOLDER;
  fs.readdir(configPath, (err, files) => {
    files = files.filter(fn => fn.endsWith('.ini')).filter(fn => fn !== "unit_config.ini");
    res.json(files)
  });
})



app.post("/delete_config", function(req, res) {
  // TODO: make this http DELETE
  const configPath = path.join(process.env.CONFIG_INI_FOLDER, req.body.filename);

  execFile("rm", [configPath], (error, stdout, stderr) => {
      if (error) {
          publishToErrorLog(error, 'delete_config')

          res.sendStatus(500)
      }
      if (stderr) {
          publishToLog(stderr, 'delete_config')

      }

      res.sendStatus(200)
  })
});


app.post("/save_new_config", function(req, res) {
  // if the config file is unit specific, we only need to run sync-config on that unit.
  const regex = /config_?(.*)?\.ini/
  const filename = req.body.filename
  if (filename.match(regex)[1]){
    var units = filename.match(regex)[1]
    var flags = ["--specific"]
  }
  else{
    var units = "$broadcast"
    var flags = ["--shared"]
  }

  var configPath = path.join(process.env.CONFIG_INI_FOLDER, req.body.filename);
  fs.writeFile(configPath, req.body.code, function (error) {
    // it's important we write to disk first, so `pio` picks up any new configs
    if (error) {
      publishToErrorLog(error, 'save_new_config')
      res.sendStatus(500)
    }
    else {
      execFile("pios", ["sync-configs", "--units", units].concat(flags), (error, stdout, stderr) => {
          if (error) {
            publishToErrorLog(error, 'save_new_config')

            res.sendStatus(500);
          }
          else if (stderr) {
            publishToLog(stderr, 'save_new_config')

            res.sendStatus(200);
          }
          else{

            res.sendStatus(200)
          }
      });
    }
  })
})




///////////  START SERVER ////////////////

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  publishToLog(`Listening on port ${PORT}`, 'app')

});
