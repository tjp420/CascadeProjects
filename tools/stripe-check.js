const { chromium } = require("playwright");
(async () => {
  const url =
    "https://checkout.stripe.com/g/pay/cs_test_placeholder#fidplaceholder";
  const out = { console: [], requests: [], responses: [] };
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  page.on("console", (msg) => {
    try {
      out.console.push({ type: msg.type(), text: msg.text() });
    } catch (e) {
      console.error("stripe-check.js error:", e);
    }
  });
  page.on("requestfailed", (req) => {
    const f = req.failure ? req.failure() : null;
    out.requests.push({
      url: req.url(),
      method: req.method(),
      status: "failed",
      error: f ? f.errorText : "unknown",
    });
  });
  page.on("request", (req) => {
    out.requests.push({
      url: req.url(),
      method: req.method(),
      status: "pending",
    });
  });
  page.on("response", async (res) => {
    try {
      const headers = res.headers();
      const ct = headers["content-type"] || headers["Content-Type"] || "";
      const status = res.status();
      let body = "";
      try {
        if (ct && ct.indexOf("application/json") >= 0) {
          body = await res.text();
          if (body && body.length > 10000) body = body.slice(0, 10000) + "...";
        }
      } catch (e) {
        body = "<body-read-failed>";
      }
      out.responses.push({
        url: res.url(),
        status,
        headers,
        bodySnippet: typeof body === "string" ? body.slice(0, 200) : "",
      });
    } catch (e) {
      console.error("stripe-check.js error:", e);
    }
  });

  // Navigate and wait for network to be idle or 30s timeout
  let navError = null;
  try {
    const response = await page
      .goto(url, { waitUntil: "networkidle", timeout: 30000 })
      .catch((e) => {
        navError = String(e);
        return null;
      });
    if (navError) out.nav = { error: navError };
    else
      out.nav = {
        status: response ? response.status() : null,
        url: response ? response.url() : null,
      };
  } catch (e) {
    out.nav = { error: String(e) };
  }

  // wait an extra 5 seconds to capture late requests
  await page.waitForTimeout(5000);

  // Save a screenshot
  try {
    await page.screenshot({
      path: "C:/Users/user/CascadeProjects.worktrees/sidebar-button-signin-screen-fix/tools/stripe-check-screenshot.png",
      fullPage: true,
    });
    out.screenshot = "stripe-check-screenshot.png";
  } catch (e) {
    out.screenshot = "screenshot-failed";
  }

  console.log("---PLAYWRIGHT-RESULT-START---");
  console.log(JSON.stringify(out, null, 2));
  console.log("---PLAYWRIGHT-RESULT-END---");
  await browser.close();
})();
