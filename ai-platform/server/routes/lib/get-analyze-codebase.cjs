"use strict";

function getAnalyzeCodebase() {
  const modulePath = require.resolve("../lib/codebase-analyzer.cjs");
  const keysToDelete = Object.keys(require.cache).filter(
    (key) =>
      key.includes("server/lib/codebase-analyzer") ||
      key.includes("server/lib/scan-content-patterns") ||
      key.includes("server/lib/universal-language-config"),
  );
  for (const key of keysToDelete) {
    delete require.cache[key];
  }
  delete require.cache[modulePath];
  const analyzer = require("../lib/codebase-analyzer.cjs");
  if (!analyzer || typeof analyzer.analyzeCodebase !== "function") {
    throw new Error(
      "codebase-analyzer module did not export a valid analyzeCodebase function",
    );
  }
  return analyzer.analyzeCodebase;
}

module.exports = { getAnalyzeCodebase };
