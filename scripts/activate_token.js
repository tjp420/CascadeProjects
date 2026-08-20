const token = process.env.TOKEN || "";
if (!token) {
  console.error("TOKEN env required");
  process.exit(2);
}
const crypto = require("crypto");
const dbmod = require("../coming-soon/lib/db.cjs");
const db = dbmod.getDb();
const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
const chainId = "tc_manual_" + crypto.randomBytes(8).toString("hex");
const now = new Date().toISOString();
const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
try {
  db.prepare(
    "INSERT INTO token_nodes (chain_id, token_hash, token_type, status, email, tier, created_at, activated_at, clock_started_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
  ).run(
    chainId,
    tokenHash,
    "owner",
    "active",
    "trevor_punt@live.com",
    "pro",
    now,
    now,
    now,
    expires,
  );
  db.prepare(
    "INSERT OR REPLACE INTO customers (email, subscription_status, tier, created_at, updated_at) VALUES (?,?,?,datetime('now'),datetime('now'))",
  ).run("trevor_punt@live.com", "active", "pro");
  db.prepare(
    "INSERT INTO paid_subscriptions (customer_email, stripe_subscription_id, stripe_price_id, status, current_period_start, current_period_end) VALUES (?,?,?,?,?,?)",
  ).run("trevor_punt@live.com", "sub_demo_manual", "", "active", now, expires);
  console.log(
    "OK: token registered, customer activated, tokenHash=" + tokenHash,
  );
} catch (e) {
  console.error("ERR", e.message);
  process.exit(1);
}
