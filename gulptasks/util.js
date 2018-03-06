"use strict";

const gulp = require("gulp");
const log = require("fancy-log");
const gulpNewer = require("gulp-newer");
const { execFile } = require("child-process-promise");

exports.newer = function newer(src, dest, forceDestFile) {
  // We use gulp-newer to perform the test and convert it to a promise.
  const options = {
    dest,
  };

  if (forceDestFile) {
    options.map = function map() {
      return ".";
    };
  }

  return new Promise((resolve) => {
    const stream = gulp.src(src, { read: false })
            .pipe(gulpNewer(options));

    function end() {
      resolve(false);
    }

    stream.on("data", () => {
      stream.removeListener("end", end);
      stream.end();
      resolve(true);
    });

    stream.on("end", end);
  });
};

/**
 * Why use this over spawn with { stdio: "inherit" }? If you use this function,
 * the results will be shown in one shot, after the process exits, which may
 * make things tidier.
 *
 * However, not all processes are amenable to this. When running Karma, for
 * instance, it is desirable to see the progress "live" and so using spawn is
 * better.
 */
exports.execFileAndReport = function execFileAndReport(...args) {
  return execFile(...args)
    .then((result) => {
      if (result.stdout) {
        log(result.stdout);
      }
    }, (err) => {
      if (err.stdout) {
        log(err.stdout);
      }
      throw err;
    });
};
