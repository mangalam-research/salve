const gutil = require("gulp-util");
const childProcess = require("child_process");

/* eslint-disable import/prefer-default-export */
function execFileAsync(command, args, options) {
  return new Promise((resolve, reject) => {
    childProcess.execFile(command, args, options, (err, stdout, stderr) => {
      if (err) {
        gutil.log(stdout);
        gutil.log(stderr);
        reject(err);
      }
      resolve(stdout, stderr);
    });
  });
}

exports.execFileAsync = execFileAsync;
