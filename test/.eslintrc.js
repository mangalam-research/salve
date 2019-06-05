module.exports = {
  extends: "lddubeau-base",
  parserOptions: {
    ecmaVersion: 8,
    sourceType: "script"
  },
  env: {
    node: true,
  },
  rules: {
    "import/no-extraneous-dependencies": "off",
    // expect().to.be.true gives a false positive...
    "no-unused-expressions": "off",
    "import/no-unresolved": [
      "error",
      // This does not exist until compilation is done.
      { ignore: ["/build/dist/"] }
    ],
  },
};
