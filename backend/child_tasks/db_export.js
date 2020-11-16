const { exec } = require("child_process");


process.on('message', function(options) {
    tables = Object.keys(options.datasetCheckbox)
    tables = tables.filter(t => options.datasetCheckbox[t])
    cmd_tables = tables.map(s => "--tables " + s).join(" ")
    command = ["mba", "download_experment_data", "--experiment", options.experimentSelection, "--output", "/home/pi/morbidostatui/backend/build/static/exports/", cmd_tables].join(" ")
    console.log(command)
    exec(command, (error, stdout, stderr) => {
        if (error) {
            process.send(false);
        }
        if (stderr) {
            process.send(false);
        }
    });

  process.send(true);
});