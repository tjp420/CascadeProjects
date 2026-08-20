const fs = require("fs");
const path = require("path");

const file = path.resolve(__dirname, "..", "scan-output.json");
if (!fs.existsSync(file)) {
  console.error("scan-output.json not found at", file);
  process.exit(2);
}

let raw = fs.readFileSync(file, "utf8");
let data;
try {
  data = JSON.parse(raw);
} catch (err) {
  console.error("Failed to parse scan-output.json:", err.message);
  process.exit(3);
}

const now = new Date().toISOString();

if (!data.scanId) {
  if (data.scan_summary && data.scan_summary.scan_id)
    data.scanId = data.scan_summary.scan_id;
  else data.scanId = `scan-${now}`;
}

if (!data.project) {
  if (data.projectRoot) {
    const parts = data.projectRoot
      .replace(/\\/g, "/")
      .split("/")
      .filter(Boolean);
    const derived = parts.slice(-2).join("/");
    data.project = derived || "tjp420/CascadeProjects";
  } else {
    data.project = "tjp420/CascadeProjects";
  }
}

if (!data.timestamp) {
  data.timestamp =
    data.generatedAt ||
    (data.scan_summary && data.scan_summary.timestamp) ||
    now;
}

// Ensure synthetic TODO metrics exist to satisfy schema expectations
if (typeof data.syntheticTodoCount === "undefined") data.syntheticTodoCount = 0;
if (typeof data.syntheticTodoMarkers === "undefined")
  data.syntheticTodoMarkers = 0;
if (!Array.isArray(data.syntheticTodoFiles)) data.syntheticTodoFiles = [];

fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log("Injected metadata into", file);

// Build a schema-compliant wrapper and write to a separate file used for validation
const wrapper = {
  scanId: data.scanId,
  project: data.project,
  timestamp: data.timestamp,
  profile:
    (data.repositoryInventory && data.repositoryInventory.profile) ||
    data.profile ||
    "all",
  todoCount:
    typeof data.todoCount === "number"
      ? data.todoCount
      : typeof data.issueCount === "number"
        ? data.issueCount
        : 0,
  syntheticTodoCount: data.syntheticTodoCount,
  syntheticTodoMarkers: data.syntheticTodoMarkers,
  syntheticTodoFiles: data.syntheticTodoFiles,
  sourceCounts: data.sourceCounts || {},
  meta: { rawReport: data },
};

const outFile = path.resolve(__dirname, "..", "scan-output.schema.json");
fs.writeFileSync(outFile, JSON.stringify(wrapper, null, 2) + "\n", "utf8");
console.log("Wrote schema-wrapped output to", outFile);
