/**
 * Rust-specific analysis patterns (Tier 2).
 */

const {
  getBaselinePatternsForFamily,
} = require("./universal-baseline-patterns.cjs");

const baseline = getBaselinePatternsForFamily("systems");

module.exports = {
  techDebt: [
    ...baseline.techDebt,
    {
      id: "rust-todo-macro",
      pattern: /\btodo!\s*\(/g,
      label: "Rust todo! macro",
    },
    {
      id: "rust-fixme-comment",
      pattern: /\/\/\s*FIXME\b/gi,
      label: "Rust FIXME comment",
    },
  ],
  debug: [...baseline.debug],
  placeholders: [...baseline.placeholders],
  bestPractices: [
    ...baseline.bestPractices,
    {
      id: "rust-expect",
      pattern: /\.expect\s*\(\s*["']/g,
      label: "Rust expect() — prefer explicit error handling",
    },
    { id: "rust-panic", pattern: /\bpanic!\s*\(/g, label: "Rust panic! call" },
  ],
  productionLeak: [
    {
      id: "rust-test-module",
      pattern: /#\[(?:test|cfg\s*\(\s*test\s*\))\]/g,
      label: "Rust test attribute in production path",
    },
  ],
};
