"use strict";

/* global __dirname */

var webpack = require("webpack");

module.exports = {
  resolve: {
    modules: ["build/dist/lib", "node_modules"],
  },
  entry: {
    salve: "salve/validate.js",
    "salve.min": "salve/validate.js",
  },
  //
  // Some stats, as of April 2017,
  // in gulp with source-map 17s
  // in gulp with eval-source-map 12s
  // source-map 10s
  // cheap-module-source-map 8s
  // eval-source-map 5s
  //
  // Among the above, source-map and cheap-module-source-map are the only two
  // that are appropriate for production. cheap-module-source-map does not
  // provide enough of a speed benefit. So we use source-map.
  //
  // The figures above also explain why gulp spawns webpack rather than run it
  // inside the gulp process. ("in gulp" means having gulp load webpack as a
  // module and run it there. It effectively runs webpack as part of the gulp
  // process whereas spawning runs webpack in a different process.)
  //
  devtool: "source-map",
  output: {
    path: __dirname + "/build/dist", // eslint-disable-line no-path-concat
    filename: "[name].js",
    sourceMapFilename: "[name].map.js",
    library: "salve",
    libraryTarget: "umd",
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      sourceMap: true,
      include: /\.min\.js$/,
    }),
  ],
};
