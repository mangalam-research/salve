import gutil from "gulp-util";
import childProcess from "child_process";

/* eslint-disable import/prefer-default-export */
export function execFileAsync(command, args, options) {
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
