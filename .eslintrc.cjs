/* eslint-env node */
module.exports = {
  root: true,
  env: { es2022: true, node: true },
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module"
  },
  ignorePatterns: ["dist/**", "node_modules/**"],
  overrides: [
    {
      files: ["**/*.ts"],
      rules: {
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/explicit-function-return-type": "off"
      }
    }
  ]
};

