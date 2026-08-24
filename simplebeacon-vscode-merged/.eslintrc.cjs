module.exports = {
  root: true,
  overrides: [
    {
      files: ["**/__tests__/**", "**/*.spec.ts", "**/*.test.ts"],
      rules: {
        // Tests are allowed to use `any` for quick mocks and adapters; keep production code strict
        "@typescript-eslint/no-explicit-any": "off",
        // Allow require() in tests and runtime adapters where dynamic loading is intentional
        "@typescript-eslint/no-require-imports": "off"
      }
    }
  ]
};