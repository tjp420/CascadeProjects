const express = require("express");
const constants = require("../config/constants.cjs");

const router = express.Router();

// VS Code Extension heartbeat bridge
const vscodeExtensionStatus = { active: false, lastPing: 0, version: "" };
const VSCODE_HEARTBEAT_TIMEOUT_MS = 30000;

router.post("/vscode-heartbeat", express.json({ limit: "1kb" }), (req, res) => {
  const { version } = req.body || {};
  vscodeExtensionStatus.active = true;
  vscodeExtensionStatus.lastPing = Date.now();
  vscodeExtensionStatus.version = version || "unknown";
  res.json({ success: true, received: true });
});

router.get("/vscode-status", (_req, res) => {
  const now = Date.now();
  const isActive =
    vscodeExtensionStatus.active &&
    now - vscodeExtensionStatus.lastPing < VSCODE_HEARTBEAT_TIMEOUT_MS;
  res.json({
    active: isActive,
    lastPing: vscodeExtensionStatus.lastPing,
    version: vscodeExtensionStatus.version,
    enhancedScanAvailable: isActive,
  });
});

router.get("/status", (req, res) => {
  res.json({
    platform: "Simplebeacon",
    status: "operational",
    features: {
      ai_scan: "ready",
      web_interface: "active",
      api_endpoints: "available",
      tools: "integrated",
    },
    statistics: {
      files_processed: constants.FILES_PROCESSED_STAT,
      consolidation_complete: true,
      reduction_rate: constants.REDUCTION_RATE_STAT,
    },
  });
});

router.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    platform: "Simplebeacon",
    version: "1.0.0",
  });
});

module.exports = router;
