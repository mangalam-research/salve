module.exports = {
  extends: "lddubeau-base/es5",
  parserOptions: {
    sourceType: "script"
  },
  rules: {
    "import/no-extraneous-dependencies": "off",
    // expect().to.be.true gives a false positive...
    "no-unused-expressions": "off",
  },
};
