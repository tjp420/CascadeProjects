// Upload a minimal test report to /api/reports/upload using a server-issued license token
// Usage: set LICENSE_TOKEN=<token> & node tools/upload-test-report.cjs

const http = require("http");
const PORT = process.env.PORT || 58000;
const LICENSE_TOKEN = process.env.LICENSE_TOKEN;
if (!LICENSE_TOKEN) {
  console.error("Please set LICENSE_TOKEN env var");
  process.exit(2);
}

const payload = {
  reportJson: {
    generatedAt: new Date().toISOString(),
    projectName: "Test Billing Pipeline",
    scanProfile: "standard",
    gate: { pass: true },
  },
  licenseToken: LICENSE_TOKEN,
};

const body = JSON.stringify(payload);
const opts = {
  hostname: "127.0.0.1",
  port: PORT,
  path: "/api/reports/upload",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  },
};

const req = http.request(opts, (res) => {
  let data = "";
  res.on("data", (c) => (data += c.toString("utf8")));
  res.on("end", () => {
    console.log("Status:", res.statusCode);
    console.log("Body:", data);
  });
});
req.on("error", (err) => {
  console.error("Request error:", err);
  process.exit(2);
});
req.write(body);
req.end();
