"use strict";
/**
 * Inlines the FULL site-config.js into certificate-upload.html (which needs
 * products/analysisTypes/tierProfiles data that the trimmed version omits).
 */
const fs = require("fs");
const path = require("path");

const publicDir = path.resolve(__dirname, "..", "coming-soon", "public");
const fullConfig = fs.readFileSync(
  path.join(publicDir, "site-config.js"),
  "utf8",
);
const target = path.join(publicDir, "certificate-upload.html");

let content = fs.readFileSync(target, "utf8");
const pattern =
  /<script\s+src=["']site-config\.js(\?[^"']*)?["'][^>]*>\s*<\/script>/gi;

if (pattern.test(content)) {
  content = content.replace(pattern, "<script>\n" + fullConfig + "\n</script>");
  fs.writeFileSync(target, content, "utf8");
  console.log("Inlined full site-config.js -> certificate-upload.html");
} else {
  console.log("No site-config.js reference found in certificate-upload.html");
}
