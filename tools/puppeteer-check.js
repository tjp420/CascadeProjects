const puppeteer = require("puppeteer");
(async () => {
  const url =
    "https://checkout.stripe.com/g/pay/cs_test_placeholder#fidplaceholder";
  const out = { console: [], requests: [], responses: [] };
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  page.on("console", (msg) =>
    out.console.push({ type: msg.type(), text: msg.text() }),
  );
  page.on("requestfailed", (req) => {
    const failure = req.failure ? req.failure() : null;
    out.requests.push({
      url: req.url(),
      method: req.method(),
      status: "failed",
      error: failure ? failure.errorText : "unknown",
    });
  });
  page.on("request", (req) =>
    out.requests.push({
      url: req.url(),
      method: req.method(),
      status: "pending",
    }),
  );
  page.on("response", async (res) => {
    try {
      const status = res.status();
      const url = res.url();
      let bodySnippet = "";
      const ct = res.headers()["content-type"] || "";
      if (ct.includes("application/json")) {
        try {
          const text = await res.text();
          bodySnippet = text.slice(0, 200);
        } catch (e) {
          bodySnippet = "<read-failed>";
        }
      }
      out.responses.push({ url, status, headers: res.headers(), bodySnippet });
    } catch (e) {
      console.error("puppeteer-check.js error:", e);
    }
  });

  let navError = null;
  try {
    const resp = await page
      .goto(url, { waitUntil: "networkidle2", timeout: 30000 })
      .catch((e) => {
        navError = String(e);
        return null;
      });
    out.nav = {
      status: resp ? resp.status() : null,
      url: resp ? resp.url() : null,
      error: navError,
    };
  } catch (e) {
    out.nav = { error: String(e) };
  }

  await page.waitForTimeout(5000);
  try {
    await page.screenshot({
      path: "C:/Users/user/CascadeProjects.worktrees/sidebar-button-signin-screen-fix/tools/stripe-puppeteer-screenshot.png",
      fullPage: true,
    });
    out.screenshot = "stripe-puppeteer-screenshot.png";
  } catch (e) {
    out.screenshot = "screenshot-failed";
  }
  console.log("---PUPPETEER-RESULT-START---");
  console.log(JSON.stringify(out, null, 2));
  console.log("---PUPPETEER-RESULT-END---");
  await browser.close();
})();
