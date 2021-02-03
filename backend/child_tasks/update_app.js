const { exec } = require("child_process");


process.on('message', function(v) {
    // pio update restarts the webserver...
    command = "pio update --app && pios update"
    console.log(command)
    exec(command, (error, stdout, stderr) => {
        console.log(stdout)
        console.log(stderr)
        if (error) {
            console.log(error)
            process.send(false);
        } else {
            process.send(true);
        }

        // now that we have sent a confirmation, also update the UI...
        command = "pio update --ui"
        exec(command)
        process.exit(0)
    });
});