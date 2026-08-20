/**
 * End-to-end test for JWT Token Rotation & Blocklisting
 */

const http = require("http");

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "localhost",
      port: 3002,
      path,
      method,
      headers: { "Content-Type": "application/json", ...headers },
    };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log("\n=== JWT Token Rotation & Blocklist Tests ===\n");

  // Test 1: Refresh with missing token
  console.log("Test 1: POST /api/v2/auth/refresh (missing body)");
  const r1 = await request("POST", "/api/v2/auth/refresh", {}, {});
  console.log(`  Status: ${r1.status} — ${r1.body.error || "OK"}`);
  console.assert(r1.status === 400, "Expected 400 for missing refreshToken");

  // Test 2: Refresh with invalid token
  console.log("Test 2: POST /api/v2/auth/refresh (invalid token)");
  const r2 = await request(
    "POST",
    "/api/v2/auth/refresh",
    {},
    { refreshToken: "fake-token-123" },
  ); // simplebeacon-ignore credential-pattern — test fixture, fake token
  console.log(`  Status: ${r2.status} — ${r2.body.error || "OK"}`);
  console.assert(r2.status === 401, "Expected 401 for invalid refresh token");

  // Test 3: Logout with valid access token (dev bypass)
  console.log("Test 3: POST /api/v2/auth/logout (with Bearer token)");
  const r3 = await request(
    "POST",
    "/api/v2/auth/logout",
    { Authorization: "Bearer dev-bypass" },
    {},
  );
  console.log(`  Status: ${r3.status} — ${r3.body.message || r3.body.error}`);
  console.assert(r3.status === 200, "Expected 200 for logout");

  // Test 4: Audit endpoint pagination still works
  console.log("Test 4: GET /api/v2/audit?limit=1 (authenticated)");
  const r4 = await request("GET", "/api/v2/audit?limit=1", {
    Authorization: "Bearer dev-bypass",
  });
  console.log(`  Status: ${r4.status} — total=${r4.body.pagination?.total}`);
  console.assert(r4.status === 200, "Expected 200 for audit endpoint");
  console.assert(r4.body.pagination?.limit === 1, "Expected limit=1");

  // Test 5: Health check
  console.log("Test 5: GET /api/health");
  const r5 = await request("GET", "/api/health");
  console.log(`  Status: ${r5.status}`);
  console.assert(r5.status === 200, "Expected 200 for health");

  console.log("\n=== All tests completed ===\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err.message);
  process.exit(1);
});
