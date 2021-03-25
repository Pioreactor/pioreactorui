const { execFile } = require("child_process");


process.on('message', function(newPioreactorName) {
    console.log(`pio add-pioreactor ${newPioreactorName}`)
    execFile("pio", ["add-pioreactor", newPioreactorName],
        { shell: "/bin/bash" },
        (error, stdout, stderr) => {
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