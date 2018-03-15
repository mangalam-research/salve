/* eslint-env node */

"use strict";

const fs_ = require("fs");
const childProcess = require("child_process");
const path = require("path");

const gulp = require("gulp");
const log = require("fancy-log");
const gulpNewer = require("gulp-newer");
const rename = require("gulp-rename");
const jison = require("jison-gho");
const Promise = require("bluebird");
const del = require("del");
const touch = require("touch");
const es = require("event-stream");
const { ArgumentParser } = require("argparse");
const eslint = require("gulp-eslint");
const versync = require("versync");
const { spawn, execFile } = require("child-process-promise");
const { execFileAndReport, newer } = require("./util");

const touchAsync = Promise.promisify(touch);
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

parser.addArgument(["--rst2html"], {
  help: "The path of the rst2html executable.",
  defaultValue: localConfig.rst2html || "rst2html",
});

const options = parser.parseArgs(process.argv.slice(2));

gulp.task("lint", ["tslint", "eslint"]);

gulp.task("eslint",
          // The TypeScript code must have been compiled, otherwise we get
          // reference errors.
          ["tsc"],
          () =>
          gulp.src([
            "*.js",
            "bin/**/*.js",
            "lib/**/*.js",
            "gulptasks/**/*.js",
            "test/**/*.js",
            "!test/salve-convert/**/*.js",
            "misc/**/*.js",
            "!test/**/simplified-rng*.js",
          ])
          .pipe(eslint())
          .pipe(eslint.format())
          .pipe(eslint.failAfterError()));

function dumpBufferedContent(obj) {
  const stdout = obj.stdout.toString().trim();
  if (stdout !== "") {
    log(`\n${stdout}`);
  }

  const stderr = obj.stderr.toString().trim();
  if (stderr !== "") {
    log(`\n${stderr}`);
  }
}

function runTslint(tsconfig, tslintConfig) {
  return spawn(
    "./node_modules/.bin/tslint",
    ["--format", "verbose", "--project", tsconfig, "-c", tslintConfig],
    { capture: ["stdout", "stderr"] }).then(dumpBufferedContent)
    .catch((err) => {
      dumpBufferedContent(err);
      throw err;
    });
}

gulp.task("tslint", () => runTslint("tsconfig.json", "tslint.json"));

gulp.task("copy-src", () => {
  const dest = "build/dist/";
  return gulp.src([
    "package.json",
    "bin/*",
    "lib/**/*.d.ts",
    "lib/**/*.xsl",
  ], { base: "." })
    .pipe(gulpNewer(dest))
    .pipe(gulp.dest(dest));
});

gulp.task("copy-readme", () => {
  const dest = "build/dist/";
  return gulp.src("NPM_README.md")
    .pipe(rename("README.md"))
  // Yep, gulpNewer has to be after the rename. The rename is done in memory and
  // we want to have it done *before* the test so that the test tests against
  // the correct file in the filesystem.
    .pipe(gulpNewer(dest))
    .pipe(gulp.dest(dest));
});

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

gulp.task("default", ["webpack"]);

gulp.task("copy", ["copy-src", "copy-readme"],
          () => fs.writeFileAsync("build/dist/.npmignore", "bin/parse.js"));

function tsc(tsconfigPath, dest) {
  return execFileAndReport("./node_modules/.bin/tsc", ["-p", tsconfigPath,
                                                       "--outDir", dest]);
}

gulp.task("tsc", () => tsc("tsconfig.json", "build/dist/lib"));

gulp.task("convert-schema", ["tsc", "copy-src"], () =>
          // We use the previous version of salve to convert the validation
          // schema.
          execFileAndReport("./node_modules/.bin/salve-convert",
                            ["lib/salve/schemas/relaxng.rng",
                             "build/dist/lib/salve/schemas/relaxng.json"]));

gulp.task("webpack", ["tsc", "copy", "jison", "convert-schema"], () =>
          execFile("./node_modules/.bin/webpack", ["--color"])
          .then((result) => {
            log(result.stdout);
          }));

let packname;

gulp.task("pack", ["default"],
          () => execFile("npm", ["pack"], { cwd: "build/dist" })
          .then((result) => {
            const { stdout } = result;
            packname = stdout.trim();
            return fs.renameAsync(`build/dist/${packname}`,
                                  `build/${packname}`);
          }));

gulp.task("install_test", ["pack"], Promise.coroutine(function *install() {
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
  yield execFileAndReport("../../node_modules/.bin/tsc", ["parse.ts"],
                          { cwd: testDir });
  yield del(testDir);
}));

gulp.task("publish", ["install_test"],
          () => execFile("npm", ["publish", packname], { cwd: "build" }));

// This task also needs to check the hash of the latest commit because typedoc
// generates links to source based on the latest commit in effect when it is
// run. So if a commit happened between the time the doc was generated last, and
// now, we need to regenerate the docs.
gulp.task("typedoc", ["tslint"], Promise.coroutine(function *task() {
  const sources = ["lib/**/*.ts"];
  const stamp = "build/api.stamp";
  const hashPath = "./build/typedoc.hash.txt";

  const prelim = yield Promise.all(
    [fs.readFileAsync(hashPath)
     .then(hash => hash.toString())
     .catch(() => undefined),
     execFile("git", ["rev-parse", "--short", "HEAD"])
     .then(result => result.stdout),
    ]);

  const savedHash = prelim[0];
  const currentHash = prelim[1][0];

  if ((currentHash === savedHash) && !(yield newer(sources, stamp))) {
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

  yield spawn("./node_modules/.bin/typedoc", tsoptions, { stdio: "inherit" });

  yield Promise.all([fs.writeFileAsync(hashPath, currentHash),
                     touchAsync(stamp)]);
}));

gulp.task("readme", () => {
  // The following code works fine only with one source and one
  // destination. We're pretty much using gulp in a non-gulp way but this avoids
  // having to code the logic of gulpNewer() ourselves. YMMV as to whether this
  // is better.
  const dest = "README.html";
  const src = "README.rst";
  return gulp.src(src, { read: false })
    .pipe(gulpNewer(dest))
    .pipe(es.map((file, callback) =>
                 childProcess.execFile(options.rst2html, [src, dest],
                                       () => callback())));
});

gulp.task("doc", ["typedoc", "readme"]);

gulp.task("gh-pages-build", ["typedoc"], () => {
  const dest = "gh-pages-build";
  return gulp.src("**/*", { cwd: "build/api/" })
    .pipe(gulpNewer(dest))
    .pipe(gulp.dest(dest));
});

gulp.task("versync", () => versync.run({
  verify: true,
  onMessage: log,
}));

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

gulp.task("mocha", ["default"],
          () => spawn(
            "./node_modules/.bin/mocha",
            options.mocha_grep ? ["--grep", options.mocha_grep] : [],
            { stdio: "inherit" }));

gulp.task("test", ["default", "lint", "versync", "mocha"]);

gulp.task("clean", () => del(["build", "gh-pages-build"]));
