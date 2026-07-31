'use strict';

/**
 * Tool Schema Validation API — Management endpoints for JSON schema enforcement
 *
 * Endpoints:
 *   GET    /api/tool-schemas/stats              — Schema validation stats
 *   GET    /api/tool-schemas                    — List all schemas (builtin + custom)
 *   GET    /api/tool-schemas/:toolId             — Get schema for a tool
 *   POST   /api/tool-schemas/:toolId             — Register/update schema
 *   PUT    /api/tool-schemas/:toolId             — Update schema
 *   DELETE /api/tool-schemas/:toolId             — Delete custom schema
 *   POST   /api/tool-schemas/:toolId/validate    — Validate a payload against schema
 *   POST   /api/tool-schemas/infer               — Infer schema from sample payload
 *   GET    /api/tool-schemas/violations           — List violations
 *   POST   /api/tool-schemas/violations/clear     — Clear violations
 *   GET    /api/tool-schemas/config               — Get config
 *   PUT    /api/tool-schemas/config               — Update config
 *
 * @module tool-schema-validation-routes
 */

const express = require('express');
const logger = require('../lib/app-logger.cjs');
const schemaStore = require('../lib/tool-schema-validation-store.cjs');
const { authorize } = require('../middleware/authorize.cjs');
const { sendError } = require('../lib/response-helpers.cjs');

const router = express.Router();

router.get('/stats', function (req, res) {
  try { res.json({ success: true, stats: schemaStore.getStats() }); }
  catch (err) { sendError(res, 500, 'schema_stats_failed', { message: err.message }); }
});

router.get('/', function (req, res) {
  try {
    var orgId = req.orgId || req.query.orgId || 'default';
    res.json({ success: true, schemas: schemaStore.getAllSchemas(orgId) });
  } catch (err) { sendError(res, 500, 'schemas_list_failed', { message: err.message }); }
});

router.get('/:toolId', function (req, res) {
  try {
    var orgId = req.orgId || req.query.orgId || 'default';
    var schema = schemaStore.getSchema(req.params.toolId, orgId);
    if (!schema) return sendError(res, 404, 'schema_not_found');
    res.json({ success: true, schema: schema });
  } catch (err) { sendError(res, 500, 'schema_get_failed', { message: err.message }); }
});

router.post('/:toolId', authorize('admin:all'), function (req, res) {
  try {
    var orgId = req.orgId || req.body.orgId || 'default';
    var result = schemaStore.registerSchema(req.params.toolId, req.body, orgId);
    logger.info('[ToolSchemaValidation] Schema registered for tool: ' + req.params.toolId + ' by ' + (req.user && req.user.email || 'admin'));
    res.json(result);
  } catch (err) { sendError(res, 400, 'schema_register_failed', { message: err.message }); }
});

router.put('/:toolId', authorize('admin:all'), function (req, res) {
  try {
    var orgId = req.orgId || req.body.orgId || 'default';
    var result = schemaStore.updateSchema(req.params.toolId, req.body, orgId);
    if (!result.success) return sendError(res, 404, 'schema_not_found');
    res.json(result);
  } catch (err) { sendError(res, 400, 'schema_update_failed', { message: err.message }); }
});

router.delete('/:toolId', authorize('admin:all'), function (req, res) {
  try {
    var orgId = req.orgId || req.query.orgId || 'default';
    var result = schemaStore.deleteSchema(req.params.toolId, orgId);
    if (!result.success) return sendError(res, 404, 'schema_not_found');
    res.json(result);
  } catch (err) { sendError(res, 500, 'schema_delete_failed', { message: err.message }); }
});

router.post('/:toolId/validate', function (req, res) {
  try {
    var orgId = req.orgId || req.body.orgId || 'default';
    var payload = req.body.payload;
    var direction = req.body.direction || 'response';
    if (payload === undefined) return sendError(res, 400, 'payload_required');
    var result;
    if (direction === 'request') {
      result = schemaStore.validateRequest(req.params.toolId, payload, orgId);
    } else {
      result = schemaStore.validateResponse(req.params.toolId, payload, orgId);
    }
    res.json({ success: true, result: result });
  } catch (err) { sendError(res, 500, 'validate_failed', { message: err.message }); }
});

router.post('/infer', function (req, res) {
  try {
    var payload = req.body.payload;
    if (payload === undefined) return sendError(res, 400, 'payload_required');
    var inferred = schemaStore.inferSchema(payload);
    res.json({ success: true, schema: inferred });
  } catch (err) { sendError(res, 500, 'infer_failed', { message: err.message }); }
});

router.get('/violations/list', function (req, res) {
  try {
    var limit = parseInt(req.query.limit, 10) || 50;
    res.json({ success: true, violations: schemaStore.getViolations(limit) });
  } catch (err) { sendError(res, 500, 'violations_list_failed', { message: err.message }); }
});

router.post('/violations/clear', authorize('admin:all'), function (req, res) {
  try {
    var result = schemaStore.clearViolations();
    logger.info('[ToolSchemaValidation] Violations cleared by ' + (req.user && req.user.email || 'admin'));
    res.json(result);
  } catch (err) { sendError(res, 500, 'violations_clear_failed', { message: err.message }); }
});

router.get('/config', function (req, res) {
  try { res.json({ success: true, config: schemaStore.getConfig() }); }
  catch (err) { sendError(res, 500, 'config_get_failed', { message: err.message }); }
});

router.put('/config', authorize('admin:all'), function (req, res) {
  try {
    var result = schemaStore.updateConfig(req.body || {});
    logger.info('[ToolSchemaValidation] Config updated by ' + (req.user && req.user.email || 'admin'));
    res.json(result);
  } catch (err) { sendError(res, 400, 'config_update_failed', { message: err.message }); }
});

module.exports = router;
