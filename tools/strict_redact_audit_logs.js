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

const ipv4 =
  /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g;
const ipv6 = /\b([0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}\b/g;

function redactValue(v) {
  if (typeof v === "string") {
    return v.replace(ipv4, "[REDACTED_IP]").replace(ipv6, "[REDACTED_IP]");
  }
  if (Array.isArray(v)) return v.map(redactValue);
  if (v && typeof v === "object") return redactObject(v);
  return v;
}

function redactObject(o) {
  const out = {};
  for (const k of Object.keys(o)) {
    const lower = k.toLowerCase();
    if (
      /^(name|firstname|lastname|fullname|displayname|username)$/.test(lower)
    ) {
      out[k] = "[REDACTED_NAME]";
      continue;
    }
    const v = o[k];
    out[k] = redactValue(v);
  }
  return out;
}

if (Array.isArray(obj.entries)) {
  const red = obj.entries.map((e) => redactObject(e));
  fs.writeFileSync(output, JSON.stringify({ entries: red }, null, 2), "utf8");
  console.log(JSON.stringify({ status: "ok", output, count: red.length }));
} else {
  const map = {};
  for (const [id, entry] of Object.entries(obj.entries || {})) {
    const e = redactObject(entry);
    // ensure actorEmail and actorId are masked
    if (e.actorEmail) e.actorEmail = "[REDACTED_EMAIL]";
    if (e.actorId) e.actorId = "[REDACTED]";
    map[id] = e;
  }
  fs.writeFileSync(output, JSON.stringify({ entries: map }, null, 2), "utf8");
  console.log(
    JSON.stringify({ status: "ok", output, count: Object.keys(map).length }),
  );
}
