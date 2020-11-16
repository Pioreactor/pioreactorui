const { exec } = require("child_process");


process.on('message', function(options) {
    tables = Object.keys(options.datasetCheckbox)
    tables = tables.filter(t => options.datasetCheckbox[t])
    cmd_tables = tables.map(s => "--tables " + s).join(" ")
    command = ["mb", "download_experiment_data", "--experiment", options.experimentSelection, "--output", "/home/pi/morbidostatui/backend/build/static/exports/", cmd_tables].join(" ")
    exec(command, (error, stdout, stderr) => {
        if (error) {
            process.send(false);
        }
        if (stderr) {
            process.send(false);
        }
        process.send(true);
    });
});