/* eslint-env node */
"use strict";
const Mocha = require("mocha");

const oldRun = Mocha.prototype.run;
Mocha.prototype.run = function run(...args) {
  this.reporter(process.env.CONTINUOUS_INTEGRATION === undefined ?
                "dot" : "spec");
  return oldRun.apply(this, ...args);
};
