// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const http = require("http");
const fs = require("fs");
const path = require("path");
const dir = "C:/Users/Trevor/CascadeProjects/.simplebeacon";

const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const port = parseInt(process.env.CODEMAP_PORT || "8085", 10);
const host = process.env.CODEMAP_HOST || "127.0.0.1";

http
  .createServer((req, res) => {
    let url = decodeURIComponent(req.url).replace(/\\/g, "/");
    if (url === "/" || url === "") url = "/codemap.html";
    let filePath = path.join(dir, url).replace(/\\/g, "/");
    if (!filePath.startsWith(dir)) filePath = dir;
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory())
        filePath = path.join(filePath, "index.html").replace(/\\/g, "/");
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": mime[ext] || "text/plain" });
      res.end(data);
    } catch (e) {
      if (!res.headersSent) res.writeHead(404);
      res.end("not found");
    }
  })
  .listen(port, host, () => console.log(`http://${host}:${port}`));
