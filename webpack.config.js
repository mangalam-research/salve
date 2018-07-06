"use strict";

/* global __dirname */
const webpack = require("webpack");
const UglifyJsPlugin = require("uglifyjs-webpack-plugin");

const source = "build/dist";
module.exports = {
  resolve: {
    modules: [source, "node_modules"],
  },
  entry: {
    // With the move to Webpack 4 we essentially produce only a production
    // bundle, which is what we load in Karma.
    // salve: "lib/salve/validate.js",
    "salve.min": "lib/salve/validate.js",
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
    path: `${__dirname}/build/dist`,
    filename: "[name].js",
    sourceMapFilename: "[name].js.map",
    library: "salve",
    libraryTarget: "umd",
  },
  optimization: {
    minimize: true,
    minimizer: [new UglifyJsPlugin({
      uglifyOptions: {
        safari10: true,
      },
      sourceMap: true,
    })],
  },
  plugins: [
    // We drop from the bundle everything that is Node-dependent.
    new webpack.IgnorePlugin(/\/resource-loaders\/node$/),
    new webpack.IgnorePlugin(/\.\/xsl$/, /schema-simplifiers$/),
    new webpack.IgnorePlugin(/\.\/(?:jing|xmllint)$/, /schema-validators$/),
  ],
};
