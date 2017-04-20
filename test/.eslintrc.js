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
  }
};
