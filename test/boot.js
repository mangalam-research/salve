/* eslint-env node */

"use strict";

const Mocha = require("mocha");

const oldRun = Mocha.prototype.run;
Mocha.prototype.run = function run() {
  this.reporter(process.env.CONTINUOUS_INTEGRATION === undefined ?
                "dot" : "spec");
  // eslint-disable-next-line prefer-rest-params
  return oldRun.apply(this, arguments);
};
