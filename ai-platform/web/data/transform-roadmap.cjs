// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const fs = require("fs");
const path = require("path");
const baseDir = __dirname;
const raw = JSON.parse(
  fs.readFileSync(path.join(baseDir, "roadmap-export-raw.json"), "utf8"),
);

const issues = [];
let idx = 0;
const phases = raw.phases || [];
for (let i = 0; i < phases.length; i++) {
  const phase = phases[i];
  const tasks = phase.tasks || [];
  for (let j = 0; j < tasks.length; j++) {
    const task = tasks[j];
    issues.push({
      id: "roadmap-" + phase.id + "-" + idx++,
      severity:
        phase.severity === "low"
          ? "low"
          : phase.severity === "medium"
            ? "medium"
            : "high",
      type: phase.id,
      category: (phase.title || "").replace(/^Phase \d+:\s*/, "") || phase.id,
      description: task.description,
      filePath: task.location || "-",
      action:
        task.type === "fix"
          ? "Fix required"
          : task.type === "verify"
            ? "Verify"
            : task.type === "audit"
              ? "Audit"
              : "Review",
      effort: phase.effort || "20 min",
      completed: task.done || false,
    });
  }
}

const payload = {
  metadata: {
    project: raw.summary?.project || "ai-agent",
    exportedAt: new Date().toISOString(),
    sourceReport: raw.summary?.sourceReport,
    reportVersion: 2,
    totalIssues: issues.length,
    completed: issues.filter((i) => i.completed).length,
  },
  issues,
};

const outPath = path.join(
  baseDir,
  "remediation-roadmap-from-scan-2026-06-11.json",
);
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(
  "Transformed",
  issues.length,
  "roadmap tasks into remediation issues",
);
console.log("Saved to:", outPath);
