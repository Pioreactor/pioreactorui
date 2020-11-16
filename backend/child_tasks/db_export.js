const { exec } = require("child_process");


process.on('message', function(options) {
    tables = Object.keys(options.datasetCheckbox)
    tables = tables.filter(t => options.datasetCheckbox[t])
    cmd_tables = tables.map(s => "--tables " + s).join(" ")
    filename = "export" + Math.floor(Date.now() / 1000) + ".zip"
    command = ["mb", "download_experiment_data", "--experiment", options.experimentSelection, "--output", "/home/pi/morbidostatui/backend/public/" + filename, cmd_tables].join(" ")
    exec(command, (error, stdout, stderr) => {
        if ((error) || (stderr)) {
            process.send(false);
        } else {
            process.send(filename);
        }
    });
});