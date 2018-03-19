module.exports = {
  extends: [
    "lddubeau-base"
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
