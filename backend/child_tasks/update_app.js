const { execFile } = require("child_process");


process.on('message', function(v) {
    execFile("pio", ["update", "--app"], (error, stdout, stderr) => {
        console.log(stdout)
        console.log(stderr)
        if (error) {
            console.log(error)
            process.send(false);
        } else {
            execFile("pios", ["update"], (error, stdout, stderr) => {
                console.log(stdout)
                console.log(stderr)
                if (error) {
                    console.log(error)
                    process.send(false);
                } else {
                    process.send(true);
                }
            })
        }
        // now that we have sent a confirmation, also update the UI...
        // pio update ui restarts the webserver...
        command = "pio update --ui"
        execFile("pio", ['update', "--ui"])
        process.exit(0)
    });
});