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
  devtool: "eval-source-map",
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
