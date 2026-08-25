const fs = require("fs");
const path = require("path");
const argv = require("minimist")(process.argv.slice(2));

const input = argv.input || argv.i;
const output = argv.output || argv.o;
if (!input || !output) {
  console.error(
    JSON.stringify({
      status: "error",
      message: "--input and --output required",
    }),
  );
  process.exit(1);
}
if (!fs.existsSync(input)) {
  console.error(
    JSON.stringify({ status: "error", message: "input not found", input }),
  );
  process.exit(1);
}

const raw = fs.readFileSync(input, "utf8");
const obj = JSON.parse(raw);
const entries =
  obj.entries || (obj.entries === undefined && obj.entries === undefined)
    ? obj.entries || {}
    : obj.entries;

const emailRe = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

function redactValue(v) {
  if (typeof v === "string") {
    return v.replace(emailRe, "[REDACTED_EMAIL]");
  }
  if (Array.isArray(v)) return v.map(redactValue);
  if (v && typeof v === "object") return redactObject(v);
  return v;
}

function redactObject(o) {
  const out = {};
  const structuralKeys = new Set([
    "id",
    "timestamp",
    "prevHash",
    "hash",
    "orgId",
    "entityId",
  ]);
  for (const k of Object.keys(o)) {
    // Never alter structural integrity fields
    if (structuralKeys.has(k)) {
      out[k] = o[k];
      continue;
    }
    // redact keys that commonly contain PII
    if (/email|addr|phone|ssn|secret|token/i.test(k)) {
      out[k] = typeof o[k] === "string" ? "[REDACTED]" : redactValue(o[k]);
      continue;
    }
    out[k] = redactValue(o[k]);
  }
  return out;
}

let redacted;
if (Array.isArray(obj.entries)) {
  // older shape
  redacted = obj.entries.map((e) => redactObject(e));
  fs.writeFileSync(
    output,
    JSON.stringify({ entries: redacted }, null, 2),
    "utf8",
  );
} else {
  // assume object map
  const map = {};
  for (const [id, entry] of Object.entries(obj.entries || {})) {
    const e = redactObject(entry);
    // ensure actorEmail is redacted
    if (e.actorEmail) e.actorEmail = "[REDACTED_EMAIL]";
    map[id] = e;
  }
  fs.writeFileSync(output, JSON.stringify({ entries: map }, null, 2), "utf8");
}

// write a small summary
const outSummary = output.replace(".json", "-summary.json");
const entriesCount = Array.isArray(obj.entries)
  ? obj.entries.length
  : Object.keys(obj.entries || {}).length;
fs.writeFileSync(
  outSummary,
  JSON.stringify(
    { input, output, entriesCount, redactedEntries: entriesCount },
    null,
    2,
  ),
  "utf8",
);
console.log(JSON.stringify({ status: "ok", output, summary: outSummary }));
