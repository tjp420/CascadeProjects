const fs = require("fs");
const path = require("path");
const argv = require("minimist")(process.argv.slice(2));
const input =
  argv.input ||
  ".simplebeacon/filtered-org-compliance-attestation-strict-redacted.json";
const storePath = argv.store || "ai-platform/.simplebeacon/audit-log.json";
const output = argv.output || input.replace(".json", "-timestamps-fixed.json");

if (!fs.existsSync(input)) {
  console.error("input not found", input);
  process.exit(1);
}
if (!fs.existsSync(storePath)) {
  console.error("store not found", storePath);
  process.exit(1);
}

const filtered = JSON.parse(fs.readFileSync(input, "utf8"));
const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
const storeMap = {};
for (const [k, v] of Object.entries(store.entries || {})) {
  storeMap[v.id] = v;
}

let countFixed = 0;
if (Array.isArray(filtered.entries)) {
  for (let e of filtered.entries) {
    const s = storeMap[e.id];
    if (s && s.timestamp && e.timestamp !== s.timestamp) {
      e.timestamp = s.timestamp;
      countFixed++;
    }
  }
} else {
  for (const [k, e] of Object.entries(filtered.entries || {})) {
    const s = storeMap[e.id];
    if (s && s.timestamp && e.timestamp !== s.timestamp) {
      filtered.entries[k].timestamp = s.timestamp;
      countFixed++;
    }
  }
}
fs.writeFileSync(output, JSON.stringify(filtered, null, 2), "utf8");
console.log(
  JSON.stringify({ status: "ok", input, storePath, output, countFixed }),
);
