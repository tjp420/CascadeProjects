const fs = require("fs");
try {
  const s = fs.readFileSync("ai-platform/package.json", "utf8");
  JSON.parse(s);
  console.log("JSON parse: OK");
} catch (e) {
  console.error("JSON parse error:", e.message);
  process.exit(2);
}
