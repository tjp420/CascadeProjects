const audit = require("../ai-platform/server/lib/audit-logger.cjs");
const argv = require("minimist")(process.argv.slice(2));

const date = argv.date || argv.d;
const orgId = argv.orgId || "org-compliance-attestation";

if (!date) {
  console.error(
    "Usage: node tools/correlate_compliance_calls.js --date=YYYY-MM-DD [--orgId=org]",
  );
  process.exit(1);
}

function addSeconds(iso, secs) {
  return new Date(new Date(iso).getTime() + secs * 1000).toISOString();
}

(async function main() {
  try {
    const input = argv.input || argv.i;
    const windowSeconds = parseInt(argv.window || argv.w || "60", 10);
    let entries = [];
    if (input) {
      const fs = require("fs");
      const raw = fs.readFileSync(input, "utf8");
      const parsed = JSON.parse(raw);
      entries = parsed.entries || parsed;
      // if object map, convert to array
      if (!Array.isArray(entries) && typeof entries === "object")
        entries = Object.values(entries);
      entries = entries.filter(
        (en) =>
          en.action === "compliance_report_generated" &&
          en.timestamp &&
          en.timestamp.startsWith(date),
      );
    } else {
      const start = `${date}T00:00:00.000Z`;
      const end = `${date}T23:59:59.999Z`;
      const gen = audit.query({
        orgId,
        action: "compliance_report_generated",
        startDate: start,
        endDate: end,
        limit: 1000,
      });
      entries = gen.entries || [];
    }
    if (entries.length === 0) {
      console.log("No compliance_report_generated entries found for", date);
      return;
    }
    for (const e of entries) {
      const t0 = addSeconds(e.timestamp, -windowSeconds);
      const t1 = addSeconds(e.timestamp, windowSeconds);
      const nearbyRes = audit.query({
        orgId,
        startDate: t0,
        endDate: t1,
        limit: 200,
      });
      const nearby =
        nearbyRes && nearbyRes.entries
          ? nearbyRes.entries
          : Array.isArray(nearbyRes)
            ? nearbyRes
            : [];
      console.log("---");
      console.log(`Generated: ${e.entityId} @ ${e.timestamp} (id=${e.id})`);
      console.log(`Nearby entries (±${windowSeconds}s):`);
      if (nearby.length === 0) {
        console.log("  (none)");
      }
      for (const n of nearby) {
        if (n.id === e.id) continue;
        const meta = [];
        if (n.orgId) meta.push(`org:${n.orgId}`);
        if (n.actorId) meta.push(`actor:${n.actorId}`);
        const ip = n.ip || (n.metadata && n.metadata.ip) || "";
        const ua = n.ua || (n.metadata && n.metadata.ua) || "";
        if (ip) meta.push(`ip:${ip}`);
        if (ua) meta.push(`ua:${ua}`);
        console.log(
          `  ${n.timestamp}  ${n.action}  id=${n.id}${meta.length ? "  - " + meta.join(" | ") : ""}`,
        );
      }
    }
  } catch (err) {
    console.error("Failed to correlate:", err && err.message);
    process.exit(2);
  }
})();
