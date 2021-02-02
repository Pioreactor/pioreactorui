const { exec } = require("child_process");


process.on('message', function(v) {
    command = "pio update && pios sync"
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
        process.exit(0)
    });
});