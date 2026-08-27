#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

// Read the original worker
const workerPath = path.join(__dirname, "..", "js-es2018", "workers", "scan-worker.js");
let workerCode = fs.readFileSync(workerPath, "utf8");

// Replace import paths: strip query params and fix relative paths for src/workers/ location
workerCode = workerCode.replace(
  /from\s+["']\.\/scan-wasm-bridge\.js\?[^"']+["']/g,
  'from "../../js-es2018/workers/scan-wasm-bridge.js"'
);
workerCode = workerCode.replace(
  /from\s+["']\.\.\/utils-lib\/simplebeaconignore\.browser\.js\?[^"']+["']/g,
  'from "../../js-es2018/utils-lib/simplebeaconignore.browser.js"'
);

const outPath = path.join(__dirname, "..", "src", "workers", "scan-worker-bundled.js");
fs.writeFileSync(outPath, workerCode);
console.log("Wrote", outPath, "(", workerCode.length, "chars )");
console.log("First 15 lines:");
console.log(workerCode.split("\n").slice(0, 15).join("\n"));
