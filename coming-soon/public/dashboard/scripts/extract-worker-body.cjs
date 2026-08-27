#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const workerPath = path.join(__dirname, "..", "js-es2018", "workers", "scan-worker.js");
let code = fs.readFileSync(workerPath, "utf8");

// Strip ES module import statements
code = code.replace(/import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+(?:\s*,\s*\{[^}]*\})?)\s+from\s+["'][^"']+["'];?\s*/g, "");

// Strip export statements (classic workers can't use them)
code = code.replace(/^\s*export\s+/gm, "");

const outPath = path.join(__dirname, "..", "src", "workers", "scan-worker-body.js");
fs.writeFileSync(outPath, code);
console.log("Wrote", outPath, "(", code.length, "chars )");
