#!/usr/bin/env node
// Watch ai-platform/api/openapi.yaml for changes and restart the Prism mock container
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const spec = path.join(repoRoot, "api", "openapi.yaml");
let lastMtime = 0;

function restartPrism() {
  console.log(new Date().toISOString(), "Restarting prism mock...");
  exec(
    "docker compose -f docker-compose.prism.yml up -d --build --force-recreate prism-mock",
    { cwd: repoRoot },
    (err, stdout, stderr) => {
      if (err) console.error("Prism restart error:", err);
      else console.log("Prism restart output:", stdout || stderr || "OK");
    },
  );
}

function check() {
  try {
    const s = fs.statSync(spec);
    if (s.mtimeMs > lastMtime) {
      lastMtime = s.mtimeMs;
      restartPrism();
    }
  } catch (e) {
    // file might not exist yet
  }
}

console.log(
  "Watching",
  spec,
  "for changes (polling every 2s). Press Ctrl+C to exit.",
);
if (fs.existsSync(spec)) lastMtime = fs.statSync(spec).mtimeMs;
check();
setInterval(check, 2000);
