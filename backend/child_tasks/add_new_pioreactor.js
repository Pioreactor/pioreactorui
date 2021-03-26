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
            process.send({stderr: stderr});
        } else {
            process.send(0);
        }
        process.exit(0)
    });
});