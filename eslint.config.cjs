// Minimal root ESLint config to satisfy ESLint v9+ runner in CI
module.exports = {
  root: true,
  overrides: [
    {
      files: ["**/*.{js,cjs,ts,tsx}"],
      excludedFiles: ["**/node_modules/**", "**/dist/**"],
      // Keep rules empty to avoid surprising changes; package/workspace-level configs remain in effect
      rules: {},
    },
  ],
};
