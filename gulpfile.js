"use strict";

var gulp = require('gulp');
var newer = require('gulp-newer');
var rename = require('gulp-rename');
var jison = require('gulp-jison');
var replace = require('gulp-replace');
var gulpFilter = require('gulp-filter');
var debug = require("gulp-debug");
var tap = require("gulp-tap");
var mocha = require("gulp-mocha");
var Promise = require("bluebird");
var del = require('del');
var touchAsync = Promise.promisify(require("touch"));
var reduce = require('stream-reduce');
var fs = Promise.promisifyAll(require("fs"));
var path = require("path");
var child_process = Promise.promisifyAll(require("child_process"));
var es = require("event-stream");
var execAsync = child_process.execAsync;
var execFileAsync = child_process.execFileAsync;
var ArgumentParser = require("argparse").ArgumentParser;

//
// This script accepts configuration options from 3 places, in
// decreasing order of precedence:
//
// 1. command line,
// 2. configuration file,
// 3. internal default.
//

// Try to load local configuration options.
var local_config = {};
try {
    local_config = require('./gulp.local');
}
catch (e) {
    if (e.code !== "MODULE_NOT_FOUND")
        throw e;
}

var parser = new ArgumentParser({addHelp:true});

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
    defaultValue: local_config.jsdoc || "jsdoc"
});

parser.addArgument(["--jsdoc-private"], {
    help: "Whether or not jsdoc will document private functions.",
    type: Boolean,
    defaultValue: local_config.jsdoc_private
});

parser.addArgument(["--jsdoc-required-version"], {
    help: "The version of jsdoc needed to generate the documentation.",
    defaultValue: local_config.jsdoc_required_version || "3.2.2"
});

parser.addArgument(["--jsdoc-template-dir"], {
    help: "The path to jsdoc's default template.",
    defaultValue: local_config.jsdoc_template_dir
});

parser.addArgument(["--mocha-grep"], {
    // We do not have a default for this one.
    help: "A pattern to pass to mocha to select tests."
});

parser.addArgument(["--rst2html"], {
    help: "The path of the rst2html executable.",
    defaultValue: local_config.rst2html || "rst2html"
});

var options = parser.parseArgs(process.argv.slice(2));

gulp.task('copy-src', function () {
    var dest = "build/dist/";
    return gulp.src(["package.json",
                     "bin/*",
                     "lib/**/*.js",
                     "lib/**/*.xsl"], { base: '.'})
        .pipe(newer(dest))
        .pipe(gulp.dest(dest));
});

gulp.task('copy-readme', function () {
    var dest = "build/dist/";
    return gulp.src("NPM_README.md")
        .pipe(rename("README.md"))
    // Yep, newer has to be after the rename. The rename is done in
    // memory and we want to have it done *before* the test so that
    // the test tests against the correct file in the filesystem.
        .pipe(newer(dest))
        .pipe(gulp.dest(dest));
});

gulp.task('jison', function () {
    var dest = "build/dist/lib/salve/datatypes";
    return gulp.src("lib/salve/datatypes/regexp.jison")
        .pipe(newer(dest + "/regexp.js"))
        .pipe(jison({moduleType: 'amd'}))
        .pipe(replace(/^\s*define\(\[\], function\s*\(\s*\)\s*\{/m,
                      'define(function (require) {'))
        .pipe(gulp.dest(dest));
});

gulp.task('default', ["copy-src", "copy-readme", "jison"], function () {
    return fs.writeFileAsync("build/dist/.npmignore", "bin/parse.js");
});

var packname;

gulp.task('install_test', ["default"], function () {
    var test_dir = "build/install_dir";
    return del(test_dir).then(function () {
        return execFileAsync("npm", ["pack", "dist"], { cwd: "build" });
    }).then(function (_packname) {
        packname = _packname[0].trim();
        return fs.mkdirAsync(test_dir).then(function () {
            return execFileAsync("npm", ["install", "../" + packname],
                                 { cwd: test_dir});
        });
    }).then(function () {
        return del(test_dir);
    });
});

gulp.task('publish', ['install_test'], function () {
    return execFileAsync("npm", ["publish", packname], { cwd: "build" } );
});

gulp.task("jsdoc-template-exists", function () {
    if (!options.jsdoc_template_dir ||
        !fs.existsSync(path.join(options.jsdoc_template_dir, "publish.js"))) {
        throw new Error("JSDoc default template directory " +
                        "invalid or not provided.");
    }
});

var jsdoc_template_exclude_files = [];

gulp.task("copy-jsdoc-custom-template-files", function () {
    var dest = "build/jsdoc_template/";
    // Set the files that will overwrite or supplement files in the
    // jsdoc template.
    return gulp.src("**/*", { cwd: "misc/jsdoc_template"})
        .pipe(tap(function (file) {
            jsdoc_template_exclude_files.push(
                "!" + path.relative(file.base, file.path));
        }))
    // Yes, newer goes *after* we get the tap...
        .pipe(newer(dest))
        .pipe(gulp.dest(dest));
});

gulp.task("copy-jsdoc-template",
          ["jsdoc-template-exists", "copy-jsdoc-custom-template-files"],
          function () {
    var dest = "build/jsdoc_template/";
    // The concat excludes those files that are to be overwritten by
    // our custom template.
    return gulp.src(["**/*"].concat(jsdoc_template_exclude_files),
                    { cwd: options.jsdoc_template_dir})
        .pipe(newer(dest))
        .pipe(gulp.dest(dest));
});

gulp.task("check-jsdoc-version", function (callback) {
    // Check that the local version of JSDoc is the same or better
    // than the version deemed required for proper output.
    // This is a callback used by the grunt-shell task.
    child_process.execFile(
        options.jsdoc, ["-v"], function (err, stdout, stderr) {
        if (err)
            throw err;

        var version_re = /(\d+)(?:\.(\d+)(?:\.(\d+))?)?/;
        var required_re = new RegExp("^" + version_re.source + "$");

        var req_version_match =
            options.jsdoc_required_version.match(required_re);
        if (!req_version_match)
            throw new Error('Incorrect version specification: "' +
                            options.required_jsdoc_version + '".');

        var version_match_list = version_re.exec(stdout);
        if (!version_match_list)
            throw new Error("Could not determine local JSDoc version.");

        for (var i = 1; i < req_version_match.length; ++i) {
            var req = Number(req_version_match[i]);
            var actual = Number(version_match_list[i]);
            if (req > actual)
                throw new Error("Local JSDoc version is too old: " +
                                version_match_list[0] + " < " +
                                req_version_match[0] + ".");
            else if (actual > req)
                break;
        }
        callback();
    });
});

gulp.task("jsdoc", ["check-jsdoc-version", "copy-jsdoc-template"],
          function (callback) {
    var src = ["lib/**/*.js", "doc/api_intro.md", "package.json"];
    var template_src = ["build/jsdoc_template/**"];

    var dest = "build/api";
    var filter = gulpFilter(src);
    var stamp = "build/api.stamp";
    gulp.src(src.concat(template_src), { read: false, base: '.' })
        .pipe(newer(stamp))
        .pipe(filter)
        .pipe(reduce(function (acc, data) {
            acc.push(data);
            return acc;
        }, [])).on("data", function (files) {
            var args = ["-c", "jsdoc.conf.json"];
            if (options.jsdoc_private) {
                args.push("-p");
            }
            args = args.concat(files.map(function (x) { return x.path; }));
            args.push("-d", dest);
            child_process.execFileAsync(options.jsdoc, args).then(function () {
                return touchAsync(stamp);
            }).then(function () {
                callback();
            });
        });
});

gulp.task("readme", function () {
    // The following code works fine only with one source and one
    // destination. We're pretty much using gulp in a non-gulp way but
    // this avoids having to code the logic of newer() ourselves. YMMV
    // as to whether this is better.
    var dest = "README.html";
    var src = "README.rst";
    return gulp.src(src, { read: false })
        .pipe(newer(dest))
        .pipe(es.map(function (file, callback) {
            child_process.execFile(options.rst2html, [src, dest], function () {
                callback();
            });
        }));
});

gulp.task("doc", ["jsdoc", "readme"]);

gulp.task("gh-pages-build", ["jsdoc"], function () {
    var dest = "gh-pages-build";
    return gulp.src("**/*", {  cwd: "build/api/"})
        .pipe(newer(dest))
        .pipe(gulp.dest(dest));
});

gulp.task("semver", function () {
    return execFileAsync("./node_modules/semver-sync/bin/semver-sync", ["-v"]);
});

gulp.task("mocha", function () {
    return gulp.src("test/*.js", { read: false })
        .pipe(mocha({
            reporter: "dot",
            grep: options.mocha_grep
        }));
});

gulp.task("test", ["default", "semver", "mocha"]);

gulp.task("clean", function () {
    return del(["build", "gh-pages-build"]);
});
