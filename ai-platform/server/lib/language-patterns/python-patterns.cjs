// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
/**
 * Python-specific analysis patterns (Tier 2).
 */

const {
  getBaselinePatternsForFamily,
} = require("./universal-baseline-patterns.cjs");

const baseline = getBaselinePatternsForFamily("data");

module.exports = {
  techDebt: [
    ...baseline.techDebt,
    {
      id: "python-todo-comment",
      pattern: /#\s*TODO\b/gi,
      label: "Python TODO comment",
    },
    {
      id: "python-fixme-comment",
      pattern: /#\s*FIXME\b/gi,
      label: "Python FIXME comment",
    },
    {
      id: "python-type-ignore",
      pattern: /#\s*type:\s*ignore\b/gi,
      label: "Python type: ignore suppression",
    },
  ],
  debug: [
    ...baseline.debug,
    {
      id: "python-breakpoint",
      pattern: /\bbreakpoint\s*\(/g,
      label: "Python breakpoint() call",
    },
    {
      id: "python-ipdb",
      pattern: /\bipdb\.set_trace\s*\(/g,
      label: "ipdb debugger",
    },
  ],
  placeholders: [...baseline.placeholders],
  bestPractices: [
    ...baseline.bestPractices,
    {
      id: "python-empty-pass",
      pattern: /^\s*pass\s*$/gm,
      label: "Empty pass statement",
    },
    {
      id: "python-not-implemented",
      pattern: /\braise\s+NotImplementedError\b/g,
      label: "NotImplementedError stub",
    },
  ],
  productionLeak: [
    {
      id: "python-unittest-mock",
      pattern:
        /\b(unittest\.mock|from\s+unittest\s+import\s+mock|from\s+unittest\.mock\b)/g,
      label: "unittest.mock in production path",
    },
    {
      id: "python-magic-mock",
      pattern: /\b(MagicMock\s*\(|@patch\s*\(|@mock\.patch\b)/g,
      label: "Mock/patch usage",
    },
    {
      id: "python-mock-module-call",
      pattern: /\bmock\.(patch|MagicMock|Mock)\b/g,
      label: "mock.patch/MagicMock usage",
    },
    {
      id: "python-pytest-import",
      pattern: /^\s*import\s+pytest\b|^\s*from\s+pytest\b/gm,
      label: "pytest import in production path",
    },
  ],
};
