/* eslint-env node */

"use strict";

const fs_ = require("fs");
const path = require("path");

const gulp = require("gulp");
const log = require("fancy-log");
const gulpNewer = require("gulp-newer");
const jison = require("jison-gho");
const Promise = require("bluebird");
const del = require("del");
const touch = require("touch");
const es = require("event-stream");
const { ArgumentParser } = require("argparse");
const eslint = require("gulp-eslint");
const versync = require("versync");
const { spawn, execFile } = require("child-process-promise");
const { execFileAndReport, newer } = require("./gulptasks/util");

const fs = Promise.promisifyAll(fs_);

//
// This script accepts configuration options from 3 places, in
// decreasing order of precedence:
//
// 1. command line,
// 2. configuration file,
// 3. internal default.
//

// Try to load local configuration options.
let localConfig = {};
try {
  // eslint-disable-next-line global-require, import/no-unresolved
  localConfig = require("./gulp.local");
}
catch (e) {
  if (e.code !== "MODULE_NOT_FOUND") {
    throw e;
  }
}

const parser = new ArgumentParser({ addHelp: true });

// We have this here so that the help message is more useful than
// without. At the same time, this positional argument is not
// *required*.
parser.addArgument(["target"], {
  help: "Target to execute.",
  nargs: "?",
  defaultValue: "default",
});

parser.addArgument(["--doc-private"], {
  help: "document private functions.",
  type: Boolean,
  action: "storeTrue",
  defaultValue: localConfig.doc_private,
});

parser.addArgument(["--no-doc-private"], {
  help: "do not document private functions.",
  type: Boolean,
  action: "storeFalse",
  dest: "doc_private",
  defaultValue: localConfig.doc_private,
});

parser.addArgument(["--mocha-grep"], {
  // We do not have a default for this one.
  help: "A pattern to pass to mocha to select tests.",
});

parser.addArgument(["--browsers"], {
  help: "The list of browsers to use for Karma.",
  nargs: "+",
});

const options = parser.parseArgs(process.argv.slice(2));

function runTsc(tsconfigPath, dest) {
  return execFileAndReport("./node_modules/.bin/tsc", ["-p", tsconfigPath,
                                                       "--outDir", dest]);
}

function runTslint(tsconfig, tslintConfig) {
  return execFileAndReport(
    "./node_modules/.bin/tslint",
    ["--format", "verbose", "--project", tsconfig, "-c", tslintConfig],
    { capture: ["stdout", "stderr"] });
}

function tsc() {
  return runTsc("tsconfig.json", "build/dist/lib");
}

function runEslint() {
  return gulp.src([
    "*.js",
    "bin/**/*.js",
    "gulptasks/**/*.js",
    "test/**/*.js",
    "!test/salve-convert/**/*.js",
    "misc/**/*.js",
    "!test/**/simplified-rng*.js",
  ])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
}

function tslint() {
  return runTslint("tsconfig.json", "tslint.json");
}

function copySrc() {
  const dest = "build/dist/";
  return gulp.src([
    "package.json",
    "README.md",
    "bin/*",
    "lib/**/*.d.ts",
    "lib/**/*.xsl",
  ], { base: "." })
    .pipe(gulpNewer(dest))
    .pipe(gulp.dest(dest));
}

function webpack(config) {
  const args = ["--mode", "production", "--progress", "--color"];
  if (config) {
    args.push("--config", config);
  }

  return spawn("./node_modules/.bin/webpack", args, { stdio: "inherit" });
}

function runKarma(localOptions) {
  // We cannot let it be set to ``null`` or ``undefined``.
  if (options.browsers) {
    localOptions = localOptions.concat("--browsers", options.browsers);
  }
  return spawn("./node_modules/.bin/karma", localOptions, { stdio: "inherit" });
}

function karma() {
  return runKarma(["start", "--single-run"]);
}

function mocha() {
  return spawn(
    "./node_modules/.bin/mocha",
    options.mocha_grep ? ["--grep", options.mocha_grep] :
      [],
    { stdio: "inherit" });
}

// === gulp tasks ===

gulp.task("lint", gulp.parallel(tslint, runEslint));

gulp.task("jison", () => {
  const dest = "build/dist/lib/salve/datatypes";
  return gulp.src("lib/salve/datatypes/regexp.jison")
    .pipe(gulpNewer(`${dest}/regexp.js`))
  // eslint-disable-next-line array-callback-return
    .pipe(es.map((data, callback) => {
      const generated = new jison.Generator(data.contents.toString(), {
        moduleType: "commonjs",
        // Override the default main created by Jison. This module cannot ever
        // be used as a main script. And the default that Jison uses does
        // `require("fs")` which causes problems.
        moduleMain: function main() {
          throw new Error("this module cannot be used as main");
        },
      }).generate();
      data.contents = Buffer.from(generated);
      data.path = data.path.replace(/.jison$/, ".js");
      callback(null, data);
    }))
    .pipe(gulp.dest(dest));
});

gulp.task("copy", gulp.series(copySrc,
                              () => fs.writeFileAsync("build/dist/.npmignore",
                                                      "bin/parse.js")));
gulp.task("convert-schema",
          // We have to create the directory before converting.
          () => execFileAndReport("mkdir", ["-p",
                                            "build/dist/lib/salve/schemas/"])
          // We have to write an empty file so that salve-convert will at least
          // not crash due to the file being missing.
          .then(() => fs.writeFileAsync(
            "build/dist/lib/salve/schemas/relaxng.json", "{}"))
          // We use the previous version of salve to convert the
          // validation schema.
          .then(() => execFileAndReport(
            "./build/dist/bin/salve-convert",
            ["--validator=none", "lib/salve/schemas/relaxng.rng",
             "build/dist/lib/salve/schemas/relaxng.json"])));

gulp.task("default", gulp.series(gulp.parallel(tsc, "copy", "jison"),
                                 "convert-schema",
                                 () => webpack()));

gulp.task("karma", gulp.series("default", karma));

let packname;

gulp.task("pack", gulp.series(
  "default",
  () => execFile("npm", ["pack"], { cwd: "build/dist" })
    .then((result) => {
      const { stdout } = result;
      packname = stdout.trim();
      return fs.renameAsync(`build/dist/${packname}`, `build/${packname}`);
    })));

gulp.task("install_test", gulp.series(
  "pack",
  Promise.coroutine(function *install() {
    const testDir = "build/install_dir";
    yield del(testDir);
    yield fs.mkdirAsync(testDir);
    yield fs.mkdirAsync(path.join(testDir, "node_modules"));
    yield execFile("npm", ["install", `../${packname}`, "sax", "@types/sax"],
          { cwd: testDir });
    let module = yield fs.readFileAsync("lib/salve/parse.ts");
    module = module.toString();
    module = module.replace("./validate", "salve");
    yield fs.writeFileAsync(path.join(testDir, "parse.ts"), module);
    yield execFileAndReport("../../node_modules/.bin/tsc",
                            ["--lib", "es2015,dom", "--esModuleInterop",
                             "parse.ts"],
                            { cwd: testDir });
    yield del(testDir);
  })));

gulp.task("publish", gulp.series("install_test",
                                 () => execFile("npm", ["publish", packname],
                                                { cwd: "build" })));

// This task also needs to check the hash of the latest commit because typedoc
// generates links to source based on the latest commit in effect when it is
// run. So if a commit happened between the time the doc was generated last, and
// now, we need to regenerate the docs.
gulp.task("typedoc",
          gulp.series(
            tslint,
            Promise.coroutine(function *task() {
              const sources = ["lib/**/*.ts"];
              const stamp = "build/api.stamp";
              const hashPath = "./build/typedoc.hash.txt";

              const prelim = yield Promise.all(
                [fs.readFileAsync(hashPath).then(hash => hash.toString())
                 .catch(() => undefined),
                 execFile("git", ["rev-parse", "--short", "HEAD"])
                 .then(result => result.stdout),
                ]);

              const savedHash = prelim[0];
              const currentHash = prelim[1][0];

              if ((currentHash === savedHash) &&
                  !(yield newer(sources, stamp))) {
                log("No change, skipping typedoc.");
                return;
              }

              const { version } = JSON.parse(fs.readFileSync("package.json"));
              const tsoptions = [
                "--out", `./build/api/salve/${version}`,
                "--name", "salve",
                "--tsconfig", "./tsconfig.json",
                "--listInvalidSymbolLinks",
              ];

              if (!options.doc_private) {
                tsoptions.push("--excludePrivate");
              }

              yield spawn("./node_modules/.bin/typedoc", tsoptions,
                          { stdio: "inherit" });

              yield Promise.all([fs.writeFileAsync(hashPath, currentHash),
                                 touch(stamp)]);
            })));

gulp.task("doc", gulp.task("typedoc"));

gulp.task("gh-pages-build", gulp.series("typedoc", () => {
  const dest = "gh-pages-build";
  return gulp.src("**/*", { cwd: "build/api/" })
    .pipe(gulpNewer(dest))
    .pipe(gulp.dest(dest));
}));

gulp.task("versync", () => versync.run({
  onMessage: log,
}));

gulp.task("mocha", gulp.series("default", mocha));

gulp.task("test",
          gulp.series("default",
                      gulp.parallel("versync", mocha, karma, "lint")));

gulp.task("clean", () => del(["build", "gh-pages-build"]));
