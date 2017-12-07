module.exports = {
  extends: "lddubeau-base",
  parserOptions: {
    ecmaVersion: 6,
    sourceType: "script"
  },
  env: {
    node: true,
  },
  rules: {
    "import/no-extraneous-dependencies": "off",
    // expect().to.be.true gives a false positive...
    "no-unused-expressions": "off",
  }
};
