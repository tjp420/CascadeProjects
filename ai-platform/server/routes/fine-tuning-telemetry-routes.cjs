"use strict";

/**
 * Fine-Tuning Telemetry API
 *
 * Exports endpoints for collecting, labeling, and exporting conversation
 * telemetry as small-model training datasets.
 *
 * @module fine-tuning-telemetry-routes
 */

const express = require("express");
const telemetry = require("../lib/fine-tuning-telemetry-store.cjs");
const { authorize } = require("../middleware/authorize.cjs");
const { sendError } = require("../lib/response-helpers.cjs");

const router = express.Router();

function resolveOrgId(req) {
  return req.orgId || req.query.orgId || req.body.orgId || "default";
}

function normalizeFilters(query) {
  const filters = {};
  if (query.minRating !== undefined)
    filters.minRating = Number(query.minRating);
  if (query.minTurns !== undefined) filters.minTurns = Number(query.minTurns);
  if (query.label) filters.label = query.label;
  if (query.operation) filters.operation = query.operation;
  if (query.startDate) filters.startDate = query.startDate;
  if (query.endDate) filters.endDate = query.endDate;
  if (query.q) filters.q = String(query.q);
  if (query.page !== undefined) filters.page = Number(query.page);
  if (query.limit !== undefined) filters.limit = Number(query.limit);
  return filters;
}

// GET /api/telemetry/collect?orgId=...&minTurns=...
router.get("/collect", authorize("admin:all"), function (req, res) {
  try {
    const orgId = resolveOrgId(req);
    const filters = normalizeFilters(req.query);
    const result = telemetry.listEntries(orgId, filters);
    if (Array.isArray(result)) {
      res.json({ success: true, orgId, count: result.length, entries: result });
    } else {
      res.json({
        success: true,
        orgId,
        ...result,
        count: result.entries.length,
      });
    }
  } catch (err) {
    sendError(res, 500, "collect_failed", { message: err.message });
  }
});

// POST /api/telemetry/export
router.post("/export", authorize("admin:all"), function (req, res) {
  try {
    const orgId = resolveOrgId(req);
    const format = (req.body && req.body.format) || "jsonl";
    if (!["jsonl", "alpaca", "chatml"].includes(format)) {
      return sendError(res, 400, "invalid_format");
    }
    const filters = normalizeFilters(
      req.body && req.body.filters ? req.body.filters : {},
    );
    const result = telemetry.exportDataset(orgId, format, filters);
    if (!result.success) return sendError(res, 500, "export_failed");
    res.json({ success: true, ...result });
  } catch (err) {
    sendError(res, 500, "export_failed", { message: err.message });
  }
});

// POST /api/telemetry/label
router.post("/label", authorize("admin:all"), function (req, res) {
  try {
    const eventId = (req.body && req.body.eventId) || null;
    const label = (req.body && req.body.label) || null;
    if (!eventId || !label)
      return sendError(res, 400, "missing_event_or_label");
    const result = telemetry.labelEntry(eventId, label);
    if (!result.success) return sendError(res, 404, result.error);
    res.json(result);
  } catch (err) {
    sendError(res, 500, "label_failed", { message: err.message });
  }
});

// GET /api/telemetry/datasets?orgId=...
router.get("/datasets", authorize("admin:all"), function (req, res) {
  try {
    const orgId = resolveOrgId(req);
    const datasets = telemetry.listDatasets(orgId);
    res.json({ success: true, orgId, datasets });
  } catch (err) {
    sendError(res, 500, "datasets_failed", { message: err.message });
  }
});

module.exports = router;
