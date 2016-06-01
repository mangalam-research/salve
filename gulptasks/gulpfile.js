"use strict";

import "babel-polyfill";
import fs_ from "fs";
import path from "path";
import child_process_ from "child_process";

import gulp from "gulp";
import newer from "gulp-newer";
import rename from "gulp-rename";
import jison from 'gulp-jison';
import replace from 'gulp-replace';
import gulpFilter from 'gulp-filter';
import debug from "gulp-debug";
import tap from "gulp-tap";
import Promise from "bluebird";
import del from 'del';
import touch from "touch";
import reduce from 'stream-reduce';
import es from "event-stream";
import { ArgumentParser } from "argparse";

const touchAsync = Promise.promisify(touch);
const fs = Promise.promisifyAll(fs_);
const child_process = Promise.promisifyAll(child_process_);
const execFileAsync = child_process.execFileAsync;

//
// This script accepts configuration options from 3 places, in
// decreasing order of precedence:
//
// 1. command line,
// 2. configuration file,
// 3. internal default.
//

// Try to load local configuration options.
let local_config = {};
try {
    local_config = require('./gulp.local');
}
catch (e) {
    if (e.code !== "MODULE_NOT_FOUND")
        throw e;
}

const parser = new ArgumentParser({addHelp:true});

// We have this here so that the help message is more useful than
// without. At the same time, this positional argument is not
// *required*.
parser.addArgument(['target'], {
    help: "Target to execute.",
    nargs: "?",
    defaultValue: "default"
});

parser.addArgument(['--jsdoc'], {
    help: "Set which jsdoc executable to use.",
    defaultValue: local_config.jsdoc || "./node_modules/.bin/jsdoc"
});

parser.addArgument(["--jsdoc-private"], {
    help: "jsdoc will document private functions.",
    type: Boolean,
    action: 'storeTrue',
    defaultValue: local_config.jsdoc_private
});

parser.addArgument(["--no-jsdoc-private"], {
    help: "jsdoc will not document private functions.",
    type: Boolean,
    action: 'storeFalse',
    dest: 'jsdoc_private',
    defaultValue: local_config.jsdoc_private
});

parser.addArgument(["--jsdoc-required-version"], {
    help: "The version of jsdoc needed to generate the documentation.",
    defaultValue: local_config.jsdoc_required_version || "3.2.2"
});

parser.addArgument(["--mocha-grep"], {
    // We do not have a default for this one.
    help: "A pattern to pass to mocha to select tests."
});

parser.addArgument(["--rst2html"], {
    help: "The path of the rst2html executable.",
    defaultValue: local_config.rst2html || "rst2html"
});

const options = parser.parseArgs(process.argv.slice(2));

gulp.task('copy-src', () => {
    const dest = "build/dist/";
    return gulp.src(["package.json",
                     "bin/*",
                     "lib/**/*.js",
                     "lib/**/*.xsl"], { base: '.'})
        .pipe(newer(dest))
        .pipe(gulp.dest(dest));
});

gulp.task('copy-readme', () => {
    const dest = "build/dist/";
    return gulp.src("NPM_README.md")
        .pipe(rename("README.md"))
    // Yep, newer has to be after the rename. The rename is done in
    // memory and we want to have it done *before* the test so that
    // the test tests against the correct file in the filesystem.
        .pipe(newer(dest))
        .pipe(gulp.dest(dest));
});

gulp.task('jison', () => {
    const dest = "build/dist/lib/salve/datatypes";
    return gulp.src("lib/salve/datatypes/regexp.jison")
        .pipe(newer(dest + "/regexp.js"))
        .pipe(jison({moduleType: 'amd'}))
        .pipe(replace(/^\s*define\(\[\], function\s*\(\s*\)\s*\{/m,
                      'define(function (require) {'))
        .pipe(gulp.dest(dest));
});

gulp.task('default', ["copy-src", "copy-readme", "jison"],
          () =>
          fs.writeFileAsync("build/dist/.npmignore", "bin/parse.js"));

let packname;

gulp.task('install_test', ["default"], Promise.coroutine(function *() {
    const test_dir = "build/install_dir";
    yield del(test_dir);
    const _packname = yield execFileAsync("npm", ["pack", "dist"],
                                          { cwd: "build" });
    packname = _packname.trim();
    yield fs.mkdirAsync(test_dir);
    yield execFileAsync("npm", ["install", `../${packname}`],
                        { cwd: test_dir});
    yield del(test_dir);
}));

gulp.task('publish', ['install_test'],
          () => execFileAsync("npm", ["publish", packname], { cwd: "build" } ));

gulp.task("check-jsdoc-version", (callback) => {
    // Check that the local version of JSDoc is the same or better
    // than the version deemed required for proper output.
    child_process.execFile(
        options.jsdoc, ["-v"], (err, stdout, stderr) => {
        if (err)
            throw err;

        const version_re = /(\d+)(?:\.(\d+)(?:\.(\d+))?)?/;
        const required_re = new RegExp(`^${version_re.source}$`);

        const req_version_match =
            options.jsdoc_required_version.match(required_re);
        if (!req_version_match)
            throw new Error(
                "Incorrect version specification: "+
                `"${options.required_jsdoc_version}".`);

        const version_match_list = version_re.exec(stdout);
        if (!version_match_list)
            throw new Error("Could not determine local JSDoc version.");

        for (let i = 1; i < req_version_match.length; ++i) {
            const req = Number(req_version_match[i]);
            const actual = Number(version_match_list[i]);
            if (req > actual)
                throw new Error(
                    "Local JSDoc version is too old: " +
                        `${version_match_list[0]} < ${req_version_match[0]}.`);
            else if (actual > req)
                break;
        }
        callback();
    });
});

gulp.task("jsdoc", ["check-jsdoc-version"], (callback) => {
    const src = ["lib/**/*.js", "doc/api_intro.md", "package.json"];

    const dest = "build/api";
    const stamp = "build/api.stamp";
    gulp.src(src, { read: false, base: '.' })
        .pipe(newer(stamp))
        .pipe(reduce( (acc, data) => {
            acc.push(data);
            return acc;
        }, [])).on("data", (files) => {
            let args = ["-c", "jsdoc.conf.json"];
            if (options.jsdoc_private) {
                args.push("-p");
            }
            args = args.concat(files.map(x => x.path));
            args.push("-d", dest);
            child_process.execFileAsync(options.jsdoc, args)
                .then(() => touchAsync(stamp))
                .then(() => callback());
        });
});

gulp.task("readme", () => {
    // The following code works fine only with one source and one
    // destination. We're pretty much using gulp in a non-gulp way but
    // this avoids having to code the logic of newer() ourselves. YMMV
    // as to whether this is better.
    const dest = "README.html";
    const src = "README.rst";
    return gulp.src(src, { read: false })
        .pipe(newer(dest))
        .pipe(es.map((file, callback) =>
                     child_process.execFile(options.rst2html, [src, dest],
                                            () => callback())));
});

gulp.task("doc", ["jsdoc", "readme"]);

gulp.task("gh-pages-build", ["jsdoc"], () => {
    const dest = "gh-pages-build";
    return gulp.src("**/*", {  cwd: "build/api/"})
        .pipe(newer(dest))
        .pipe(gulp.dest(dest));
});

gulp.task("semver",
          () => execFileAsync("./node_modules/semver-sync/bin/semver-sync",
                              ["-v"]));
//
// Ideally we'd be using gulp-mocha but there are issues with running
// Mocha as part of the same process which runs gulp. So we don't.
//
// import mocha from "gulp-mocha";
//
// gulp.task("mocha", () => gulp.src("test/*.js", { read: false })
//           .pipe(mocha({
//               reporter: "dot",
//               grep: options.mocha_grep
//           })));

gulp.task("mocha", ["default"], (callback) => {
    const child = child_process.spawn(
        "./node_modules/.bin/mocha",
        options.mocha_grep ? ["--grep", options.mocha_grep]: [],
        { stdio: 'inherit'});

    child.on('exit', (code, signal) => {

        if (code) {
            callback(new Error("child terminated with code: " + code));
            return;
        }

        if (signal) {
            callback(new Error("child terminated with signal: " + signal));
            return;
        }

        callback();
    });
});

gulp.task("test", ["default", "semver", "mocha"]);

gulp.task("clean", () => del(["build", "gh-pages-build"]));
