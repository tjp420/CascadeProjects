const fs = require("fs");
const argv = require("minimist")(process.argv.slice(2));
const csv =
  argv.csv ||
  ".simplebeacon/filtered-audit-compliance-attestation-2026-08-15_to_2026-08-22-fixed-daily-action-counts.csv";
const thresholdMultiplier = Number(argv.mult || 2);
if (!fs.existsSync(csv)) {
  console.error("csv not found", csv);
  process.exit(1);
}
const lines = fs.readFileSync(csv, "utf8").trim().split("\n").slice(1);
const data = lines.map((l) => {
  const [date, action, count] = l.split(",");
  return { date, action: action.replace(/^"|"$/g, ""), count: Number(count) };
});
// compute overall avg
const total = data.reduce((s, r) => s + r.count, 0);
const avg = total / data.length;
const spikes = data.filter((r) => r.count > avg * thresholdMultiplier);
console.log(JSON.stringify({ csv, avg, thresholdMultiplier, spikes }));
