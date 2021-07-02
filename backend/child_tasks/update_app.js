const { execFile } = require("child_process");


process.on('message', function(v) {
    execFile("pio", ["update", "--app"], (error, stdout, stderr) => {
        // why do I run pio update --app first?
        if (error) {
            process.send({result: false, msg: error});
        } else {
            execFile("pios", ["update"], (error, stdout, stderr) => {
                if (error) {
                    process.send({result: false, msg: error});
                } else {
                    process.send({result: true, msg: stdout});
                }
            })
        }
        // now that we have sent a confirmation, also update the UI...
        // pio update ui restarts the webserver...
        execFile("pio", ['update', "--ui"])
        process.exit(0)
    });
});