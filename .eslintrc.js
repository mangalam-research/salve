module.exports = {
  extends: [
    "lddubeau-base/es5"
  ],
  env: {
    commonjs: true,
  },
  rules: {
    "import/no-extraneous-dependencies": [
      "error",
      { devDependencies: ["!webpack.config.js"] }
    ],
  }
};
