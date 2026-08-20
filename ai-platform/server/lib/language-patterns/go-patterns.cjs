/**
 * Go-specific analysis patterns (Tier 2).
 */

const {
  getBaselinePatternsForFamily,
} = require("./universal-baseline-patterns.cjs");

const baseline = getBaselinePatternsForFamily("systems");

module.exports = {
  techDebt: [
    ...baseline.techDebt,
    {
      id: "go-todo-comment",
      pattern: /\/\/\s*TODO\b/gi,
      label: "Go TODO comment",
    },
    {
      id: "go-fixme-comment",
      pattern: /\/\/\s*FIXME\b/gi,
      label: "Go FIXME comment",
    },
  ],
  debug: [
    ...baseline.debug,
    {
      id: "go-log-print",
      pattern: /\blog\.Print(?:ln|f)?\s*\(/g,
      label: "Go log.Print* call",
    }, // simplebeacon-ignore redos — language pattern definition, not user input
  ],
  placeholders: [...baseline.placeholders],
  bestPractices: [
    { id: "go-panic", pattern: /\bpanic\s*\(/g, label: "Go panic call" },
  ],
  productionLeak: [
    {
      id: "go-test-helper",
      pattern: /\btesting\.T\b|\btesting\.B\b/g,
      label: "Go testing import usage",
    },
  ],
};
