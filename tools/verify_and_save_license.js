#!/usr/bin/env node
require("dotenv").config({ path: "ai-platform/.env" });
const Stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  validateLicenseToken,
} = require("../packages/simplebeacon-cli/src/lib/license-token.js");

(async function main() {
  try {
    const ev = await Stripe.events.list({ limit: 30 });
    const checkoutEv = ev.data
      .filter((e) => e.type === "checkout.session.completed")
      .sort((a, b) => b.created - a.created)[0];
    if (!checkoutEv) {
      console.error("NO_CHECKOUT_EVENT");
      process.exit(1);
    }
    const sid = checkoutEv.data.object.id;
    console.log("LATEST_SESSION_ID", sid);

    const session = await Stripe.checkout.sessions.retrieve(sid);
    console.log(
      "STRIPE_SESSION_MODE",
      session.mode,
      "PAYMENT_STATUS",
      session.payment_status,
    );

    const localSession = await new Promise((resolve, reject) => {
      const opts = {
        hostname: "127.0.0.1",
        port: 54359,
        path:
          "/api/simplebeacon/billing/session?session_id=" +
          encodeURIComponent(sid),
        method: "GET",
      };
      const req = http.get(opts, (res) => {
        let b = "";
        res.on("data", (d) => (b += d));
        res.on("end", () => {
          try {
            resolve(JSON.parse(b));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on("error", (e) => reject(e));
    });

    const token = localSession.licenseToken || localSession.token || null;
    if (!token) {
      console.error("NO_TOKEN_IN_LOCAL_SESSION");
      console.log("LOCAL_SESSION_RAW", JSON.stringify(localSession));
      process.exit(2);
    }

    const outPath = path.join(process.cwd(), "latest_license.jwt");
    fs.writeFileSync(outPath, token, "utf8");
    console.log("TOKEN_SAVED", outPath);

    const secret =
      process.env.SIMPLEBEACON_LICENSE_SECRET ||
      process.env.SIMPLEBEACON_LICENSE_SECRET;
    if (!secret) {
      console.warn("NO_LICENSE_SECRET_IN_ENV — cannot validate signature");
      process.exit(0);
    }
    const validation = validateLicenseToken(token, secret);
    console.log("VALIDATION_RESULT", JSON.stringify(validation));
  } catch (err) {
    console.error("ERR", err && err.message);
    process.exit(3);
  }
})();
