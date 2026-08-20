// Inspect crypto-policy-engine.cjs structure
const fs = require("fs");
const path = require("path");

const cpePath = path.join(
  __dirname,
  "ai-platform",
  "server",
  "lib",
  "hsm-adapter",
  "crypto-policy-engine.cjs",
);
const content = fs.readFileSync(cpePath, "utf8");
const lines = content.split("\n");

console.log("Total lines:", lines.length);
console.log("File size:", content.length, "bytes");
console.log();

// Find class declarations
const classes = [];
lines.forEach((l, i) => {
  const cm = l.match(/^class\s+(\w+)/);
  if (cm) classes.push({ line: i + 1, name: cm[1] });
});
console.log("Classes:", classes.length);
for (const c of classes) console.log("  L" + c.line + ": class " + c.name);

// Find function declarations
const funcs = [];
lines.forEach((l, i) => {
  const fm = l.match(/^(?:async\s+)?function\s+(\w+)/);
  if (fm) funcs.push({ line: i + 1, name: fm[1] });
});
console.log("\nFunctions:", funcs.length);
for (const f of funcs) console.log("  L" + f.line + ": " + f.name);

// Find module.exports
const exportLines = [];
lines.forEach((l, i) => {
  if (l.match(/^module\.exports/) || l.match(/^exports\./)) {
    exportLines.push({ line: i + 1, text: l.trim().slice(0, 120) });
  }
});
console.log("\nExport lines:", exportLines.length);
for (const e of exportLines) console.log("  L" + e.line + ": " + e.text);

// Find method definitions inside classes (indent-based)
const methods = [];
lines.forEach((l, i) => {
  const mm = l.match(/^  (?:async\s+)?(\w+)\s*\(/);
  if (
    mm &&
    !mm[1].match(
      /^(if|for|while|switch|return|throw|const|let|var|case|default)/,
    )
  ) {
    methods.push({ line: i + 1, name: mm[1] });
  }
});
console.log("\nClass methods (approximate):", methods.length);
for (const m of methods.slice(0, 50))
  console.log("  L" + m.line + ": " + m.name);
if (methods.length > 50)
  console.log("  ... and " + (methods.length - 50) + " more");

// Show the module.exports block
const exportIdx = content.lastIndexOf("module.exports");
if (exportIdx >= 0) {
  const exportBlock = content.slice(exportIdx, exportIdx + 2000);
  console.log("\n=== module.exports block ===");
  console.log(exportBlock);
}
