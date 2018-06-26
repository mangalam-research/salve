"use strict";

// Minimal localConfig if there is not one locally.
let localConfig = {
  browserStack: {},
};
try {
  // eslint-disable-next-line import/no-unresolved, global-require
  localConfig = require("./localConfig");
}
catch (ex) {} // eslint-disable-line no-empty

module.exports = function configure(config) {
  const options = {
    basePath: "",
    frameworks: ["mocha", "chai", "source-map-support"],
    files: [
      "build/dist/salve.min.js",
      "browser-test/**/*.js",
      { pattern: "build/dist/**/*.map", included: false },
      { pattern: "lib/salve/schemas/relaxng.rng", included: false },
      { pattern: "test/salve-convert/basename.rng", included: false },
      { pattern: "test/salve-convert/subdir/sub.rng", included: false },
    ],
    exclude: [],
    preprocessors: {},
    reporters: ["mocha"],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: false,
    browsers: ["ChromeHeadless", "FirefoxHeadless"],
    browserStack: {
      project: "salve",
    },
    customLaunchers: {
      ChromeWin: {
        base: "BrowserStack",
        browser: "Chrome",
        os: "Windows",
        os_version: "10",
      },
      FirefoxWin: {
        base: "BrowserStack",
        browser: "Firefox",
        os: "Windows",
        os_version: "10",
      },
      Edge: {
        base: "BrowserStack",
        browser: "Edge",
        os: "Windows",
        os_version: "10",
      },
      Opera: {
        base: "BrowserStack",
        browser: "Opera",
        os: "Windows",
        os_version: "10",
      },
      SafariHighSierra: {
        base: "BrowserStack",
        browser: "Safari",
        os: "OS X",
        os_version: "High Sierra",
      },
      SafariSierra: {
        base: "BrowserStack",
        browser: "Safari",
        os: "OS X",
        os_version: "Sierra",
      },
    },
    singleRun: false,
    concurrency: Infinity,
  };

  // Get the options from the localConfig file.
  Object.assign(options.browserStack, localConfig.browserStack);

  const { browsers } = config;
  if (browsers.length === 1 && browsers[0] === "all") {
    const newList = options.browsers.concat(Object.keys(options.customLaunchers));

    // We must modify this array in place.
    browsers.splice(...[0, browsers.length].concat(newList));
  }

  config.set(options);
};
