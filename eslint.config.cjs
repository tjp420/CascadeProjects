/* Minimal ESLint config to satisfy ESLint v9+ in CI
   This file intentionally keeps rules minimal and defers to package-level .eslintrc.* files
   for per-package rule sets.
*/

module.exports = {
  root: true,
  overrides: [
    {
      files: ["**/*"],
      languageOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
      },
      rules: {},
    },
  ],
};
