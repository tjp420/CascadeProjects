const express = require("express");
const router = express.Router();
const { ShardReconciler } = require("../lib/storage/shard-reconciler.cjs");

// Lightweight in-memory reconciler instance for admin endpoints
const reconciler = new ShardReconciler({ pollIntervalMs: 60_000 });
reconciler.start();

// Middleware placeholder for tenant/auth checks
function tenantGuard(req, res, next) {
  // TODO: integrate real auth/tenant resolution
  if (!req.headers || !req.headers["x-tenant-id"])
    return res.status(403).json({ error: "tenant-required" });
  req.tenantId = req.headers["x-tenant-id"];
  next();
}

// POST /api/admin/shard/reconcile
router.post("/api/admin/shard/reconcile", tenantGuard, async (req, res) => {
  try {
    const { shardIds } = req.body || {};
    if (!Array.isArray(shardIds))
      return res.status(400).json({ error: "shardIds-array-required" });
    const result = await reconciler.triggerSync(shardIds, {
      tenantId: req.tenantId,
      requestedBy: req.user && req.user.id,
    });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

module.exports = function registerShardAdminRoutes(app) {
  app.use(router);
};
