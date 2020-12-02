const express = require('express');
const basicAuth = require('express-basic-auth')
const path = require('path');
const bodyParser = require('body-parser');
require('dotenv').config()
const url = require('url');
const { exec } = require("child_process");
const cp = require('child_process');
const sqlite3 = require('sqlite3').verbose()
const fs = require('fs')

const app = express()
app.use(bodyParser.json());
app.use('/public', express.static('public'));

var db = new sqlite3.Database(process.env.DB_LOCATION)

// this is not secure, and I know it. It's fine for now, as the app isn't exposed to the internet.
var staticUserAuth = basicAuth({
    users: {
        [process.env.BASIC_AUTH_USER]: process.env.BASIC_AUTH_PASS
    },
    challenge: true
})


app.get('/', function(req, res) {
    res.redirect(301, '/dashboard');
})

app.get('/dashboard', function(req, res) {
    app.use(express.static(path.join(__dirname, 'build')));
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
})

app.get('/download-data', function(req, res) {
    app.use(express.static(path.join(__dirname, 'build')));
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
})

app.get('/start-new-experiment', function(req, res) {
    app.use(express.static(path.join(__dirname, 'build')));
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
})

app.get('/edit-config', function(req, res) {
    app.use(express.static(path.join(__dirname, 'build')));
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
})



app.post('/query_datasets', function(req, res) {
    var child = cp.fork('./child_tasks/db_export');

    child.on('message', function(m) {
      if (m) {
          res.json({filename: m})
      }
      else{
        res.sendStatus(500)
      }
    });
    child.send(req.body);
})


app.get('/stop', function (req, res) {
    exec("pios kill python -y", (error, stdout, stderr) => {
        if (error) {
            console.log(error)
            res.send(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.log(stderr)
            res.send(`stderr: ${stderr}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
        res.sendStatus(200)
    });
})


app.get("/run/:job/:unit", function(req, res) {
    const queryObject = url.parse(req.url, true).query;
    // assume that all query params are optional args for the job
    unit = req.params.unit
    job = req.params.job
    options = Object.entries(queryObject).map(k_v => [`--${k_v[0].replace(/_/g, "-")} ${k_v[1]}`])
    command = (["pios", "run", job, "-y", "--units", `'${req.params.unit}'`].concat(options)).join(" ")
    console.log(command)
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.log(command)
            res.send(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.log(command)
            res.send(`stderr: ${stderr}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
        res.sendStatus(200)
    });
})


app.get('/get_experiments', function (req, res) {
  db.serialize(function () {
    db.all('SELECT experiment FROM experiments ORDER BY timestamp DESC;', function (err, rows) {
      res.send(rows)
    })
  })
})

app.get('/get_latest_experiment', function (req, res) {
  db.serialize(function () {
    db.all('SELECT * FROM experiments ORDER BY timestamp DESC LIMIT 1;', function (err, rows) {
      res.send(rows[0])
    })
  })
})


app.post("/create_experiment", function (req, res) {
    var insert = 'INSERT INTO experiments (timestamp, experiment, description) VALUES (?,?,?)'
    db.run(insert, [req.body.timestamp, req.body.experiment, req.body.description], function(err){
        if (err){
            console.log(err)
            res.sendStatus(500)
        } else {
        res.sendStatus(200)
        }
    })
})


app.get("/recent_media_rates/:experiment", function (req, res) {
  const experiment = req.params.experiment
  const hours = 12
  db.serialize(function () {
    db.all(`SELECT CASE WHEN event="add_media" THEN "mediaRate" ELSE "altMediaRate" END AS type, SUM(volume_change_ml)/${hours} as rate FROM io_events where datetime(timestamp) >= datetime('now', '-${hours} Hour') and event in ('add_alt_media', 'add_media') and experiment='${experiment}' and source_of_event == 'io_controlling' GROUP BY event;`, function (err, rows) {
      var jsonResult = {}
      for (const row of rows){
        jsonResult[row.type] = row.rate
      }
      res.json(jsonResult)
    })
  })
})


app.post("/update_experiment_desc", function (req, res) {
    var update = 'UPDATE experiments SET description = (?) WHERE experiment=(?)'
    db.run(update, [req.body.description, req.body.experiment], function(err){
        if (err){
            console.log(err)
            res.sendStatus(500)
        } else {
        res.sendStatus(200)
        }
    })
})


app.get("/get_config/:filename", function(req, res) {
  var configPath = path.join(process.env.CONFIG_INI_FOLDER, req.params.filename);
  res.send(fs.readFileSync(configPath))
})

app.post("/save_new_config", function(req, res) {
  // TODO handle failure
  var configPath = path.join(process.env.CONFIG_INI_FOLDER, req.body.filename);
  fs.writeFile(configPath, req.body.code, function (err) {
    if (err) {
      res.sendStatus(500)
    }
    else {
      command = (["pios", "sync-configs"]).join(" ")
      exec(command, (error, stdout, stderr) => {
          if (error) {
              console.log(error)
              res.sendStatus(500);
          }
          else if (stderr) {
              console.log(stderr)
              res.sendStatus(500);
          }
          else{
            console.log(`stdout: ${stdout}`);
            res.sendStatus(200)
          }
      });
    }
  })
})



const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`)
});
