"use strict";

const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const hsmMetrics = require("../lib/hsm-adapter/hsm-metrics.cjs");
const { authenticate } = require("../middleware/auth.cjs");

const router = express.Router();

// Request tracing middleware: extract or generate `x-track112-trace-id` per incoming request
function getOrCreateTraceId(req) {
  const hdr = req.get && req.get("x-track112-trace-id");
  if (hdr) return hdr;
  if (req.query && req.query.traceId) return req.query.traceId;
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function nowMs() {
  if (process.hrtime && process.hrtime.bigint) {
    return Number(process.hrtime.bigint()) / 1e6;
  }
  return Date.now();
}

router.use((req, res, next) => {
  try {
    const tid = getOrCreateTraceId(req);
    req.track112TraceId = tid;
    req.track112Start = nowMs();
    res.setHeader("x-track112-trace-id", tid);
    // Log request completion with trace ID for ingress → processing correlation
    res.on("finish", () => {
      const dur = req.track112Start
        ? (nowMs() - req.track112Start).toFixed(1)
        : "?";
      console.log(
        `[track112] ${req.method} ${req.path} ${res.statusCode} ${dur}ms traceId=${tid}`,
      );
    });
  } catch (e) {
    // non-fatal, continue without tracking
  }
  next();
});

// Disk-backed upload manager for multipart sessions
const UploadManager = require("../lib/storage/upload-manager.cjs");
const uploadBase = path.join(__dirname, "..", "..", ".data", "track112");
const uploadManager = new UploadManager({
  baseDir: uploadBase,
  defaultTenant: "dev",
});

function observeUploadLatency(req) {
  if (req.track112Start) {
    hsmMetrics.observeHistogram(
      "hsm_track112_upload_duration_ms",
      nowMs() - req.track112Start,
    );
  }
}

router.post("/uploads", authenticate, express.json(), (req, res) => {
  const { tenant, maxBytes } = req.body || {};
  try {
    const id = uploadManager.createSession({
      tenant,
      maxBytes,
      traceId: req.track112TraceId,
    });
    hsmMetrics.incrementCounter("hsm_track112_upload_create_total");
    observeUploadLatency(req);
    res.status(201).json({ sessionId: id, traceId: req.track112TraceId });
  } catch (e) {
    observeUploadLatency(req);
    res.status(500).json({ error: "create_failed", message: e.message });
  }
});

// Write incoming chunk data directly to a file named by its offset
router.post("/uploads/:id/chunk", authenticate, async (req, res) => {
  const id = req.params.id;
  const q = req.query || {};
  const offset = Number(q.offset || 0);
  try {
    await uploadManager.writeChunkFromStream(id, offset, req);
    hsmMetrics.incrementCounter("hsm_track112_upload_chunk_total");
    res.setHeader("x-track112-trace-id", req.track112TraceId);
    observeUploadLatency(req);
    res.status(204).end();
  } catch (e) {
    hsmMetrics.incrementCounter("hsm_track112_upload_chunk_failed_total");
    observeUploadLatency(req);
    res.status(500).json({ error: "write_failed", message: e.message });
  }
});

// Commit: compute root over persisted chunk files, verify Ed25519 signature, then remove session data
router.post("/uploads/:id/commit", authenticate, express.json(), (req, res) => {
  const id = req.params.id;
  const { publicKeyPem, signature } = req.body || {};
  if (!publicKeyPem || !signature) {
    hsmMetrics.incrementCounter("hsm_track112_upload_commit_failed_total");
    observeUploadLatency(req);
    return res.status(400).json({ error: "missing_publicKey_or_signature" });
  }
  try {
    const result = uploadManager.verifyAndCommitSession(
      id,
      publicKeyPem,
      signature,
    );
    if (!result.ok) {
      hsmMetrics.incrementCounter("hsm_track112_upload_commit_failed_total");
      if (result.reason === "invalid_signature") {
        hsmMetrics.incrementCounter(
          "hsm_track112_upload_commit_failed_invalid_signature_total",
        );
      }
      observeUploadLatency(req);
      return res
        .status(401)
        .json({ error: result.reason, message: result.message });
    }
    hsmMetrics.incrementCounter("hsm_track112_upload_commit_total");
    observeUploadLatency(req);
    return res.json({
      status: "committed",
      root: result.root,
      traceId: req.track112TraceId,
    });
  } catch (e) {
    hsmMetrics.incrementCounter("hsm_track112_upload_commit_failed_total");
    hsmMetrics.incrementCounter(
      "hsm_track112_upload_commit_failed_session_not_found_total",
    );
    observeUploadLatency(req);
    return res.status(404).json({ error: "session_not_found" });
  }
});

module.exports = router;
