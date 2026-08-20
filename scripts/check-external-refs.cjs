"use strict";
const fs = require("fs");
const path = require("path");

function walk(d) {
  return fs.readdirSync(d).flatMap((f) => {
    const fp = path.join(d, f);
    if (fs.statSync(fp).isDirectory()) return walk(fp);
    if (f.endsWith(".html")) return [fp];
    return [];
  });
}

const publicDir = path.resolve(__dirname, "..", "coming-soon", "public");
const files = walk(publicDir);

for (const file of files) {
  const c = fs.readFileSync(file, "utf8");
  const m = [];
  if (c.match(/src=["']\/?js-es2018\/auth\.js/)) m.push("auth");
  if (c.match(/src=["']site-config\.js/)) m.push("site-config");
  if (c.match(/src=["']app-links\.js/)) m.push("app-links");
  if (c.match(/href=["']css\/dashboard\.css/)) m.push("dashboard.css");
  if (m.length)
    console.log(path.relative(publicDir, file) + ": " + m.join(", "));
}
