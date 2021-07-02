const { execFile } = require("child_process");


process.on('message', function(newPioreactorName) {
    console.log(`pio add-pioreactor ${newPioreactorName}`)
    execFile("pio", ["add-pioreactor", newPioreactorName],
        { shell: "/bin/bash" },
        (error, stdout, stderr) => {
        if (error) {
            console.log(error)
            process.send({result: false, msg: stderr});
        } else {
            process.send({result: true, msg: ""});
        }
        process.exit(0)
    });
});