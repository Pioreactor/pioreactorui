const express = require('express');
var https = require('https')

const path = require('path');
const bodyParser = require('body-parser');
const dotenv = require('dotenv').config()
const url = require('url');
const { execFile } = require("child_process");
const cp = require('child_process');
const SQLiteTagSpawned = require('sqlite-tag-spawned');
const fs = require('fs')
const expressStaticGzip = require("express-static-gzip");
const compression = require('compression');
const yaml = require('js-yaml');
const mqtt = require('mqtt')
const os = require("os");


const app = express()
app.use(bodyParser.json());
app.use(compression());


const {query} = SQLiteTagSpawned(process.env.DB_LOCATION);


// connect to MQTT for logging
var client  = mqtt.connect('mqtt://localhost:1883')
const LOG_TOPIC = `pioreactor/${os.hostname()}/$experiment/logs/ui`


///////////// UTILS ////////////////////
msgToJSON = (msg, level) => {
  return JSON.stringify({message: msg.trim(), task: "UI", level: level, timestamp: new Date().toISOString() })
}

publishToLog = (msg, level="DEBUG") => {
  console.log(msg)
  client.publish(LOG_TOPIC, msgToJSON(msg, level))
}

publishToErrorLog = (msg) => {
  console.log(msg)
  publishToLog(JSON.stringify(msg), "ERROR")
}

async function test() {
 const result = await query`SELECT * from experiments`;
 console.log("result = ", result);
}

test();


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

app.get('/pioreactors/:unit', function(req, res) {
    app.use("/", expressStaticGzip(path.join(__dirname, 'build')));
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
})

app.get('/updates', function(req, res) {
  app.use("/", expressStaticGzip(path.join(__dirname, 'build')));
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
})




//////////////// PIOREACTOR CONTROL ////////////////////

app.post('/stop_all', function (req, res) {
  execFile("pios", ["kill"].concat(["--all-jobs"]).concat(["-y"]), (error, stdout, stderr) => {
    if (error) {
        publishToErrorLog(error)

    }
    if (stderr) {
        publishToLog(stderr)

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
    client.publish(`pioreactor/${unit}/$experiment/${job}/$state/set`, "disconnected")
    res.sendStatus(200)
  }
  else {
    execFile("pios", ["kill", job, "-y", "--units", req.params.unit], (error, stdout, stderr) => {
      if (error) {
          publishToErrorLog(error)

      }
      if (stderr) {
          publishToLog(stderr)

      }
      publishToLog(stdout)

    })
    res.sendStatus(200)
  }
 })

app.post("/run/:job/:unit", function(req, res) {
    // we start jobs over MQTT instead - this would saves some time on not having to invoke python / pios

    unit = req.params.unit
    job = req.params.job

    client.publish(`pioreactor/${unit}/$experiment/run/${job}`, JSON.stringify(req.body))
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




/////////// DATA FOR CARDS ON OVERVIEW ///////////////


app.get('/recent_logs/:experiment', function (req, res) {
  const experiment = req.params.experiment
  const queryObject = url.parse(req.url, true).query; // assume that all query params are optional args for the job
  const minLevel = queryObject['min_level'] || "INFO"

  if (minLevel == "DEBUG"){
    levelString = '(level == "ERROR" or level == "WARNING" or level == "INFO" or level == "DEBUG")'
  }
  else if (minLevel == "INFO") {
    levelString = '(level == "ERROR" or level == "INFO" or level == "WARNING")'
  }
  else if (minLevel == "WARNING") {
    levelString = '(level == "ERROR" or level == "WARNING")'
  }
  else if (minLevel == "ERROR") {
    levelString = '(level == "ERROR")'
  }
  else{
    levelString = '(level == "ERROR" or level == "INFO" or level == "WARNING")'
  }

  query(`SELECT timestamp, level=="ERROR" as is_error, level=="WARNING" as is_warning, pioreactor_unit, message, task FROM logs WHERE ${levelString} and (experiment=:experiment OR experiment=:universalExperiment) and timestamp >= MAX(strftime('%Y-%m-%dT%H:%M:%S', datetime('now', '-24 hours')), (SELECT timestamp FROM experiments WHERE experiment=:experiment)) ORDER BY timestamp DESC LIMIT 50;`,
    {experiment: experiment, universalExperiment: "$experiment",  levelString: levelString},
    {timestamp: String, is_error: Boolean, is_warning: Boolean, pioreactor_unit: String, message: String, task: String},
    function (err, rows) {
      if (err){
        publishToErrorLog(err)

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

  query(
    "SELECT json_object('series', json_group_array(unit), 'data', json_group_array(data)) FROM (SELECT pioreactor_unit as unit, json_group_array(json_object('x', timestamp, 'y', round(rate, 5))) as data FROM growth_rates WHERE experiment=:experiment AND ((ROWID * 0.61803398875) - cast(ROWID * 0.61803398875 as int) < 1.0/:filterModN) GROUP BY 1);",
    {experiment: experiment, filterModN: filterModN},
    {results: String},
    function (err, rows) {
      if (err){
        publishToErrorLog(err)

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

  query(
    "SELECT json_object('series', json_group_array(unit), 'data', json_group_array(data)) FROM (SELECT pioreactor_unit as unit, json_group_array(json_object('x', timestamp, 'y', round(temperature_c, 2))) as data FROM temperature_readings WHERE experiment=:experiment AND ((ROWID * 0.61803398875) - cast(ROWID * 0.61803398875 as int) < 1.0/:filterModN) GROUP BY 1);",
    {experiment: experiment, filterModN: filterModN},
    {results: String},
    function (err, rows) {
      if (err){
        publishToErrorLog(err)

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

  query(
    "SELECT json_object('series', json_group_array(unit), 'data', json_group_array(data)) FROM (SELECT pioreactor_unit as unit, json_group_array(json_object('x', timestamp, 'y', round(normalized_od_reading, 7))) as data FROM od_readings_filtered WHERE experiment=:experiment AND ((ROWID * 0.61803398875) - cast(ROWID * 0.61803398875 as int) < 1.0/:filterModN) AND timestamp > strftime('%Y-%m-%dT%H:%M:%S', datetime('now', :lookback)) GROUP BY 1);",
    {experiment: experiment, filterModN: filterModN, lookback: `-${lookback} hours`},
    {results: String},
    function (err, rows) {
      if (err){
        publishToErrorLog(err)

        res.sendStatus(500)
      } else {
        res.send(rows[0]['results'])
      }
    })
})


app.get('/time_series/od_readings_raw/:experiment', function (req, res) {
  const experiment = req.params.experiment
  const queryObject = url.parse(req.url, true).query; // assume that all query params are optional args for the job
  const filterModN = queryObject['filter_mod_N'] || 100
  const lookback = queryObject['lookback'] || 4

  query(
    "SELECT json_object('series', json_group_array(unit), 'data', json_group_array(data)) FROM (SELECT pioreactor_unit || '-' || channel as unit, json_group_array(json_object('x', timestamp, 'y', round(od_reading_v, 7))) as data FROM od_readings_raw WHERE experiment=:experiment AND ((ROWID * 0.61803398875) - cast(ROWID * 0.61803398875 as int) < 1.0/:filterModN) and timestamp > strftime('%Y-%m-%dT%H:%M:%S', datetime('now', :lookback)) GROUP BY 1);",
    {experiment: experiment, filterModN: filterModN, lookback: `-${lookback} hours`},
    {results: String},
    function (err, rows) {
      if (err){
        publishToErrorLog(err)

        res.sendStatus(500)
      } else {
        res.send(rows[0]['results'])
      }
    })
})

app.get('/time_series/alt_media_fraction/:experiment', function (req, res) {
  const experiment = req.params.experiment
  const queryObject = url.parse(req.url, true).query; // assume that all query params are optional args for the job

  query(
    "SELECT json_object('series', json_group_array(unit), 'data', json_group_array(data)) FROM (SELECT pioreactor_unit as unit, json_group_array(json_object('x', timestamp, 'y', round(alt_media_fraction, 7))) as data FROM alt_media_fractions WHERE experiment=:experiment GROUP BY 1);",
    {experiment: experiment},
    {results: String},
    function (err, rows) {
      if (err){
        publishToErrorLog(err)

        res.sendStatus(500)
      } else {
        res.send(rows[0]['results'])
      }
    })
})


app.get("/recent_media_rates", function (req, res) {
  const hours = 3
  function fetch(){
    query(`SELECT d.pioreactor_unit, SUM(CASE WHEN event="add_media" THEN volume_change_ml ELSE 0 END) / :hours AS mediaRate, SUM(CASE WHEN event="add_alt_media" THEN volume_change_ml ELSE 0 END) / :hours AS altMediaRate FROM dosing_events AS d JOIN latest_experiment USING (experiment) WHERE datetime(d.timestamp) >= datetime('now', '-:hours Hour') AND event IN ('add_alt_media', 'add_media') AND source_of_event LIKE 'dosing_automation%' GROUP BY d.pioreactor_unit;`,
      {hours: hours},
      {pioreactor_unit: String, mediaRate: Number, altMediaRate: Number},
      function(err, rows) {
        if (err){
          publishToErrorLog(err)

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


//////////////// plugins //////////////////


app.get('/get_installed_plugins', function(req, res) {

  execFile("pio", ["list-plugins", "--json"], (error, stdout, stderr) => {
      if (error) {
        publishToErrorLog(error)

      }
      if (stderr) {
        publishToLog(stderr)

      }
      res.send(stdout)
  })
})

app.post('/install_plugin', function(req, res) {

  execFile("pios", ["install-plugin", req.body.plugin_name], (error, stdout, stderr) => {
      if (error) {
        publishToErrorLog(error)

      }
      if (stderr) {
        publishToLog(stderr)

      }
      res.sendStatus(200)
  })
})


app.post('/uninstall_plugin', function(req, res) {

  execFile("pios", ["uninstall-plugin", req.body.plugin_name], (error, stdout, stderr) => {
      if (error) {
        publishToErrorLog(error)

      }
      if (stderr) {
        publishToLog(stderr)

      }
      res.sendStatus(200)
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
    publishToErrorLog(e)

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
    publishToErrorLog(e)

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
        publishToErrorLog(result.msg)

        res.sendStatus(500)
      }
    });
    child.send(1);
})

app.get('/get_app_version', function(req, res) {
  // this is too slow:
  execFile("pio", ["version"], (error, stdout, stderr) => {
      if (error) {

      }
      if (stderr) {

      }
      res.send(stdout.trim())
  })
})

app.post('/export_datasets', function(req, res) {
    var child = cp.fork('./child_tasks/db_export');

    child.on('message', function(result) {
      if (result.result) {
        publishToLog(result.msg)
        res.json({filename: result.filename})
      }
      else{
        publishToErrorLog(result.msg)

        res.sendStatus(500)
      }
    });
    child.send(req.body);
})


app.get('/get_experiments', function (req, res) {
  query(
    'SELECT * FROM experiments ORDER BY timestamp DESC;',
    ["experiment", "timestamp", "description"],
    function (err, rows) {
      if (err){
        publishToErrorLog(err)

        res.sendStatus(500)
      } else {
        res.send(rows)
     }
    })
})

app.get('/get_latest_experiment', function (req, res) {
  function fetch() {
    query(
      'SELECT experiment, timestamp, description, media_used, organism_used, delta_hours FROM latest_experiment',
      {experiment: String, timestamp: String, description: String, media_used: String, organism_used: String, delta_hours: Number},
      function (err, rows) {
        if (err) {
          publishToErrorLog(err)

          return setTimeout(fetch, 500)
        }
        res.send(rows[0])
    })
  }
  fetch()
})


app.get('/get_unit_renames', function (req, res) {
  function fetch() {
    query(
      'SELECT r.pioreactor_unit, r.renamed_to FROM pioreactor_unit_renames AS` r JOIN latest_experiment USING (experiment);',
      {pioreactor_unit: String, renamed_to: String},
      function (err, rows) {
        if (err) {
          publishToErrorLog(err)

          return setTimeout(fetch, 500)
        }
        res.send(rows)
    })
  }
  fetch()
})




app.get('/get_historical_organisms_used', function (req, res) {
  function fetch() {
    query(
      'SELECT DISTINCT organism_used as key FROM experiments WHERE NOT (organism_used IS NULL OR organism_used == "") ORDER BY timestamp DESC;',
      {key: String},
      function (err, rows) {
        if (err) {
          publishToErrorLog(err)

          res.send([])
        }
        res.send(rows)
    })
  }
  fetch()
})


app.get('/get_historical_media_used', function (req, res) {
  function fetch() {
    query(
      'SELECT DISTINCT media_used as key FROM experiments WHERE NOT (media_used IS NULL OR media_used == "") ORDER BY timestamp DESC;',
      {key: String},
      function (err, rows) {
        if (err) {
          publishToErrorLog(err)
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
    query("SELECT experiment FROM experiments WHERE experiment=:experiment", {experiment: req.body.experiment}, function(err, rows){
        if (rows.length > 0){
          res.sendStatus(422)
          return
        }
        else{
          db.ignoreErrors = true; // this is a hack to avoid dblite from freezing when we get a db is locked.
          body = req.body
          var insert = 'INSERT INTO experiments (timestamp, experiment, description, media_used, organism_used) VALUES (?,?,?,?,?)'
          query(insert, [body.timestamp, body.experiment, body.description, body.mediaUsed, body.organismUsed], function(err, rows){
            if (err){
              publishToErrorLog(err)

              next(err)
              res.sendStatus(500)
            } else {
              res.sendStatus(200)
            }
            return
          })
      }
  })
})

app.post("/update_experiment_desc", function (req, res, next) {
    var update = 'UPDATE experiments SET description = (?) WHERE experiment=(?)'
    db.ignoreErrors = true; // this is a hack to avoid dblite from freezing when we get a db is locked.
    query(update, [req.body.description, req.body.experiment], function(err, _){
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
        publishToLog("Pioreactor added.")
        res.sendStatus(200)
      }
      else{
        publishToErrorLog(result.msg)

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
          publishToErrorLog(error)

          res.sendStatus(500)
      }
      if (stderr) {
          publishToLog(stderr)

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
      publishToErrorLog(error)
      res.sendStatus(500)
    }
    else {
      execFile("pios", ["sync-configs", "--units", units].concat(flags), (error, stdout, stderr) => {
          if (error) {
            publishToErrorLog(error)

            res.sendStatus(500);
          }
          else if (stderr) {
            publishToLog(stderr)

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
  publishToLog(`Listening on port ${PORT}`)

});
