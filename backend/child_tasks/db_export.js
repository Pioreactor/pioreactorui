const { execFile } = require("child_process");


process.on('message', function(options) {
    tables = Object.keys(options.datasetCheckbox)
    tables = tables.filter(t => options.datasetCheckbox[t])
    experiment = options.experimentSelection
    cmd_tables = tables.map(s => ["--tables", s]).flat()

    if (experiment === "<All experiments>"){
        experimentOption = []
        filename = `export_${Math.floor(Date.now() / 1000).toString()}.zip`
    }
    else{
        experimentOption = ["--experiment", experiment.replace(/ /g, '\ ')]
        filename = `export_${experiment.replace(/ /g, "_")}_${Math.floor(Date.now() / 1000).toString()}.zip`
    }

    execFile("pio",
            ["run", "export_experiment_data", "--output", filename].concat(cmd_tables).concat(experimentOption),
            {cwd: "/home/pi/pioreactorui/backend/build/static/exports/"},
            (error, stdout, stderr) => {
        console.log(stdout)
        console.log(stderr)
        if (error) {
            console.log(error)
            process.send(false);
        } else {
            process.send(filename);
        }
        process.exit(0)
    });
});