const express = require('express');
const basicAuth = require('express-basic-auth')
const path = require('path');
require('dotenv').config()
var cp = require('child_process');

const app = express();
const { exec } = require("child_process");
const url = require('url');


var sqlite3 = require('sqlite3').verbose()
var db = new sqlite3.Database(process.env.DB_LOCATION)

// this is not secure, and I know it. It's fine for now, as the app isn't exposed to the internet.
var staticUserAuth = basicAuth({
    users: {
        [process.env.BASIC_AUTH_USER]: process.env.BASIC_AUTH_PASS
    },
    challenge: true
})


app.use(express.static(path.join(__dirname, 'build')));

app.get('/', staticUserAuth, function(req, res) {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
})

app.get('/stop', function (req, res) {
    exec("mba kill python -y", (error, stdout, stderr) => {
        if (error) {
            res.send(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            res.send(`stderr: ${stderr}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
    });
})

app.get('/add_media/:unit', function (req, res) {

    const queryObject = url.parse(req.url, true).query;
    options = ("mL" in queryObject) ? ["--ml", queryObject['mL']] : ["--duration", queryObject['duration']]
    command = (["mba", "run", "add_media", "-y", "--units", req.params.unit].concat(options)).join(" ")

    exec(command, (error, stdout, stderr) => {
        if (error) {
            res.send(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            res.send(`stderr: ${stderr}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
    });
})

app.get('/add_alt_media/:unit', function (req, res) {
    const queryObject = url.parse(req.url, true).query;
    options = ("mL" in queryObject) ? ["--ml", queryObject['mL']] : ["--duration", queryObject['duration']]
    command = (["mba", "run", "add_alt_media", "-y", "--units", req.params.unit].concat(options)).join(" ")
    exec(command, (error, stdout, stderr) => {
        if (error) {
            res.send(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            res.send(`stderr: ${stderr}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
    });
})


app.get('/remove_waste/:unit', function (req, res) {
    const queryObject = url.parse(req.url, true).query;
    options = ("mL" in queryObject) ? ["--ml", queryObject['mL']] : ["--duration", queryObject['duration']]
    command = (["mba", "run", "remove_waste", "-y", "--units", req.params.unit].concat(options)).join(" ")
    exec(command, (error, stdout, stderr) => {
        if (error) {
            res.send(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            res.send(`stderr: ${stderr}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
    });
})


app.get('/get_experiments/', function (req, res) {
  db.serialize(function () {
    db.all('SELECT experiment FROM experiments ORDER BY timestamp DESC;', function (err, rows) {
      res.send(rows)
    })
  })
})

app.get('/get_latest_experiment/', function (req, res) {
  db.serialize(function () {
    db.all('SELECT * FROM experiments ORDER BY timestamp DESC LIMIT 1;', function (err, rows) {
      res.send(rows)
    })
  })
})


app.get('/download_data/', function(req, res) {
    const queryObject = url.parse(req.url, true).query;
    tables = queryObject['table']
    console.log(tables)

    var child = cp.fork('./child_tasks/db_export');

    child.on('message', function(m) {
      // Receive results from child process
      console.log('received: ' + m);
    });

    child.send(tables);

    const file = `${__dirname}/build/robots.txt`;
    res.download(file);
})


app.get('*', staticUserAuth, function(req, res) {
    app.use(express.static(path.join(__dirname, 'build')));
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
})










const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`)
});
