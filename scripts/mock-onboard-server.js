#!/usr/bin/env node
const http = require("http");
const { URL } = require("url");

const PORT = process.env.PORT || 54800;

function jsonResponse(res, code, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk.toString()));
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  console.log(`${new Date().toISOString()} ${req.method} ${url.pathname}`);

  if (req.method === "GET" && url.pathname === "/") {
    return jsonResponse(res, 200, { status: "ok", service: "mock-onboard" });
  }

  if (req.method === "POST" && url.pathname === "/api/enterprise/onboard") {
    try {
      const body = await parseJsonBody(req);
      const resp = {
        orgId: "org-" + Math.random().toString(36).slice(2, 9),
        companyName: body.companyName || "Acme",
        adminEmail: body.adminEmail || "admin@example.com",
        apiKey: "api_" + Math.random().toString(36).slice(2, 16),
        seatsUsed: body.seatCount || 10,
        seatCount: body.seatCount || 10,
        adminLicenseToken: "lic_" + Math.random().toString(36).slice(2, 12),
        expiresAt: new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 365,
        ).toISOString(),
      };
      console.log("Onboarded", resp.orgId);
      return jsonResponse(res, 200, resp);
    } catch (err) {
      return jsonResponse(res, 400, {
        error: "invalid_json",
        message: err.message,
      });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/enterprise/trial") {
    try {
      const body = await parseJsonBody(req);
      const resp = {
        orgId: "trial-" + Math.random().toString(36).slice(2, 9),
        companyName: body.companyName || "Acme Trial",
        adminEmail: body.adminEmail || "trial-admin@example.com",
        apiKey: "trial_api_" + Math.random().toString(36).slice(2, 14),
        seatsUsed: body.seatCount || 10,
        seatCount: body.seatCount || 10,
        adminLicenseToken:
          "trial_lic_" + Math.random().toString(36).slice(2, 10),
        expiresAt: new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 30,
        ).toISOString(),
      };
      console.log("Trial onboarded", resp.orgId);
      return jsonResponse(res, 200, resp);
    } catch (err) {
      return jsonResponse(res, 400, {
        error: "invalid_json",
        message: err.message,
      });
    }
  }

  // Azure DevOps pipeline generation endpoint used by the script
  if (
    req.method === "POST" &&
    url.pathname.match(
      /^\/api\/enterprise\/organizations\/[^/]+\/azure-devops$/,
    )
  ) {
    try {
      const parts = url.pathname.split("/");
      const orgId = parts[4];
      const pipelineYaml = `# Azure pipeline for ${orgId}\ntrigger: none\npool: default\nsteps:\n  - script: echo \"Hello from mock\"`;
      const response = {
        pipelineYaml,
        instructions: [
          "Add pipeline to your Azure DevOps project",
          "Replace secrets as needed",
        ],
      };
      console.log("Azure DevOps template generated for", orgId);
      return jsonResponse(res, 200, response);
    } catch (err) {
      return jsonResponse(res, 500, { error: err.message });
    }
  }

  // Not found
  jsonResponse(res, 404, { error: "not_found", path: url.pathname });
});

server.listen(PORT, () => {
  console.log(`Mock onboard server listening on http://localhost:${PORT}`);
});

process.on("SIGINT", () => {
  console.log("Shutting down mock server");
  server.close(() => process.exit(0));
});
