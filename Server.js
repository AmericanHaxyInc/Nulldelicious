var childProcess = require('child_process');
var readline = require('readline');

function runScript(scriptPath, callback) {

    // keep track of whether callback has been invoked to prevent multiple invocations
    var invoked = false;

    var process = childProcess.fork(scriptPath);

    // listen for errors as they may prevent the exit event from firing
    process.on('error', function (err) {
        if (invoked) return;
        invoked = true;
        callback(err);
    });

    // execute the callback once the process has finished running
    process.on('exit', function (code) {
        if (invoked) return;
        invoked = true;
        var err = code === 0 ? null : new Error('exit code ' + code);
        callback(err);
    });
    //returns process handle
    return process;
}

//spawn a child process for our server 
var server = runScript('./Index.js', function (err) {
    if (err) throw err;
    console.log(err);
});
//spawn a child process for our admin
var admin = runScript('./Admin/Content/Index.js', function (err) {
    if (err) throw err;
    console.log(err);
});

process.on('exit', function () {
    console.log('Process exiting. Killing server and admin \n');
    server.kill();
    admin.kill();
});
