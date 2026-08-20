const fs = require("fs");
const path = "C:/Users/Trevor/CascadeProjects/trust_page.html";
const html = fs.readFileSync(path, "utf8");
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let m,
  i = 0,
  found = false;
while ((m = re.exec(html)) !== null) {
  i++;
  const attr = m[1] || "";
  const srcMatch = attr.match(/src\s*=\s*['"]([^'"]+)['"]/i);
  const src = srcMatch ? srcMatch[1] : "(inline)";
  const body = m[2] || "";
  const opens = (body.match(/{/g) || []).length;
  const closes = (body.match(/}/g) || []).length;
  const braceDiff = opens - closes;
  const tryCount = (body.match(/\btry\b/g) || []).length;
  const catchCount = (body.match(/\bcatch\b/g) || []).length;
  if (braceDiff !== 0 || tryCount !== catchCount) {
    found = true;
    // simplebeacon-ignore: console-log — diagnostic output for script analysis
    console.log(
      JSON.stringify({
        index: i,
        src,
        braceDiff,
        tryCount,
        catchCount,
        len: body.length,
      }),
    );
  }
}
// simplebeacon-ignore: console-log — diagnostic output for script analysis
if (!found) console.log("no issues found in inline scripts");
// simplebeacon-ignore: console-log — diagnostic output for script analysis
else console.log("done");
