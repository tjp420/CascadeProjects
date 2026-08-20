const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const HOST = process.env.HOST || "127.0.0.1";
const PORT =
  Number(process.env.PORT || process.env.LOCAL_DASHBOARD_PORT) || 64771;
const API_PROXY_TARGET =
  process.env.API_PROXY_TARGET || "http://127.0.0.1:54358";
const DASH_DIR = path.join(
  __dirname,
  "simplebeacon-vscode-merged",
  "dashboard-web",
);
const FALLBACK_REPORT = path.join(
  process.env.HOME || process.env.USERPROFILE || __dirname,
  ".vscode-insiders",
  "extensions",
  "simplebeacon.simplebeacon-vscode-3.0.464",
  "downloads",
  "1784861166180-simplebeacon-report-2026-07-24.json",
);

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "600");
}

function serveJson(res, obj) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj, null, 2));
}

function proxyApiRequest(req, res, targetUrl) {
  const target = new URL(targetUrl);
  const opts = {
    hostname: target.hostname,
    port: target.port,
    path: target.pathname + target.search,
    method: req.method,
    headers: { ...req.headers, host: target.host },
  };
  const proxyReq = http.request(opts, (proxyRes) => {
    const headers = { ...proxyRes.headers };
    headers["Access-Control-Allow-Origin"] = "*";
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] =
      "Content-Type, Authorization, X-Requested-With";
    headers["Access-Control-Allow-Credentials"] = "true";
    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res);
  });
  proxyReq.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "proxy error", message: err.message }));
  });
  req.pipe(proxyReq);
}

function serveFile(res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const m = {
      ".html": "text/html",
      ".htm": "text/html",
      ".js": "text/javascript",
      ".mjs": "text/javascript",
      ".cjs": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".map": "application/json",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".wasm": "application/wasm",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
      ".ttf": "font/ttf",
      ".otf": "font/otf",
      ".ico": "image/x-icon",
      ".webp": "image/webp",
      ".mjs.map": "application/json",
    };
    const headers = { "Content-Type": m[ext] || "application/octet-stream" };
    if (
      ext === ".html" ||
      ext === ".js" ||
      ext === ".mjs" ||
      ext === ".cjs" ||
      ext === ".css"
    ) {
      headers["Cache-Control"] =
        "no-store, no-cache, must-revalidate, max-age=0";
      headers["Pragma"] = "no-cache";
      headers["Expires"] = "0";
    }
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const parsed = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsed.pathname;

  // Serve common favicon paths from the dashboard static directory or return a tiny inline SVG fallback
  if (
    pathname === "/favicon.svg" ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon-16x16.png"
  ) {
    const candidates = [
      path.join(DASH_DIR, "favicon.svg"),
      path.join(DASH_DIR, "assets", "favicon.svg"),
      path.join(DASH_DIR, "dist", "assets", "favicon.svg"),
      path.join(DASH_DIR, "favicon.ico"),
      path.join(DASH_DIR, "assets", "favicon.ico"),
      path.join(DASH_DIR, "dist", "assets", "favicon.ico"),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        serveFile(res, c);
        return;
      }
    }
    // Fallback tiny SVG
    const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0f172a"/><text x="50%" y="54%" font-family="Arial,Helvetica,sans-serif" font-size="14" fill="#60A5FA" text-anchor="middle" alignment-baseline="middle">SB</text></svg>`;
    res.writeHead(200, {
      "Content-Type": pathname.endsWith(".png") ? "image/png" : "image/svg+xml",
    });
    res.end(svg);
    return;
  }

  if (pathname === "/api/simplebeacon/report" || pathname === "/api/report") {
    let p = FALLBACK_REPORT;
    if (fs.existsSync(p)) {
      try {
        const txt = fs.readFileSync(p, "utf8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(txt);
        return;
      } catch (e) {
        /* fallthrough */
      }
    }
    serveJson(res, { success: true, message: "no report available" });
    return;
  }

  if (pathname === "/api/trust/verification") {
    const p = path.join(DASH_DIR, "trust-verification.json");
    if (fs.existsSync(p)) {
      try {
        const txt = fs.readFileSync(p, "utf8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(txt);
        return;
      } catch (e) {
        /* fallthrough */
      }
    }
    serveJson(res, {
      success: true,
      live: null,
      staticHost: true,
      message: "no trust verification available",
    });
    return;
  }

  if (pathname === "/api/theme") {
    serveJson(res, { theme: "dark" });
    return;
  }

  if (pathname.startsWith("/dashboard/")) {
    const rel = pathname.slice("/dashboard/".length) || "index.html";
    const relClean = rel.split("?")[0];
    const filePath = path.join(DASH_DIR, relClean);
    const vanillaIdx = path.join(DASH_DIR, "index.vanilla.html");
    if (relClean === "index.html" && fs.existsSync(vanillaIdx)) {
      serveFile(res, vanillaIdx);
    } else if (fs.existsSync(filePath)) {
      serveFile(res, filePath);
    } else if (fs.existsSync(vanillaIdx)) {
      serveFile(res, vanillaIdx);
    } else {
      const idx = path.join(DASH_DIR, "index.html");
      if (fs.existsSync(idx)) serveFile(res, idx);
      else {
        res.writeHead(404);
        res.end("dashboard not built");
      }
    }
    return;
  }

  // root redirect to dashboard
  if (pathname === "/") {
    res.writeHead(302, { Location: "/dashboard/index.html" });
    res.end();
    return;
  }

  if (pathname.startsWith("/api/")) {
    proxyApiRequest(req, res, `${API_PROXY_TARGET}${req.url}`);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, HOST, () => {
  process.stdout.write(
    `local dashboard server listening http://${HOST}:${PORT}\n`,
  );
});
