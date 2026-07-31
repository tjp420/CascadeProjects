'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.cjs');
const { authorize } = require('../middleware/authorize.cjs');
const reportStore = require('../lib/compliance-report-store.cjs');
const { generateReport, FRAMEWORKS } = require('../lib/compliance-report-generator.cjs');
const auditLogger = require('../lib/audit-logger.cjs');
const { sendError } = require('../lib/response-helpers.cjs');

const router = express.Router();

function getOrgId(req) {
  return req.user?.id || req.user?.email || 'default';
}

router.use(authenticate);

// GET /api/compliance/frameworks
router.get('/frameworks', (req, res) => {
  res.json({ success: true, frameworks: Object.values(FRAMEWORKS) });
});

// POST /api/compliance/generate
router.post('/generate', authorize('read:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { frameworks, format, title } = req.body || {};

    const fwList = Array.isArray(frameworks) && frameworks.length > 0
      ? frameworks
      : ['eu_ai_act', 'soc2', 'owasp'];

    for (const fw of fwList) {
      if (!reportStore.REPORT_FRAMEWORKS.includes(fw)) {
        return sendError(res, 400, `Invalid framework: ${fw}. Valid: ${reportStore.REPORT_FRAMEWORKS.join(', ')}`);
      }
    }

    const fmt = reportStore.REPORT_FORMATS.includes(format) ? format : 'html';
    const report = generateReport(orgId, {
      frameworks: fwList,
      format: fmt,
      title,
      generatedBy: req.user?.email || 'system',
    });

    reportStore.saveReport(report);

    auditLogger.log({
      orgId,
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: 'CREATE',
      entity: 'compliance_report',
      entityId: report.id,
      newValue: { id: report.id, title: report.title, frameworks: report.frameworks, overallScore: report.overallScore },
      metadata: { route: req.originalUrl },
    });

    res.status(201).json({
      success: true,
      reportId: report.id,
      title: report.title,
      overallScore: report.overallScore,
      frameworks: report.frameworks,
      format: report.format,
      generatedAt: report.generatedAt,
      summary: report.summary,
      assessments: report.assessments,
    });
  } catch (err) {
    sendError(res, 500, 'report_generation_failed', { message: err.message });
  }
});

// GET /api/compliance/reports
router.get('/reports', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const reports = reportStore.getAllReports(orgId).map(r => ({
      id: r.id,
      title: r.title,
      frameworks: r.frameworks,
      format: r.format,
      overallScore: r.overallScore,
      status: r.status,
      generatedAt: r.generatedAt,
      generatedBy: r.generatedBy,
      summary: r.summary,
    }));
    res.json({ success: true, reports });
  } catch (err) {
    sendError(res, 500, 'reports_fetch_failed', { message: err.message });
  }
});

// GET /api/compliance/reports/:id
router.get('/reports/:id', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const report = reportStore.getReport(req.params.id, orgId);
    if (!report) return sendError(res, 404, 'report_not_found');
    res.json({ success: true, report });
  } catch (err) {
    sendError(res, 500, 'report_fetch_failed', { message: err.message });
  }
});

// GET /api/compliance/reports/:id/download
router.get('/reports/:id/download', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const report = reportStore.getReport(req.params.id, orgId);
    if (!report) return sendError(res, 404, 'report_not_found');

    if (report.format === 'html') {
      res.type('text/html');
      res.setHeader('Content-Disposition', `attachment; filename="${report.id}.html"`);
      res.send(report.content);
    } else {
      res.type('application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${report.id}.json"`);
      res.send(report.content);
    }
  } catch (err) {
    sendError(res, 500, 'report_download_failed', { message: err.message });
  }
});

// DELETE /api/compliance/reports/:id
router.delete('/reports/:id', authorize('delete:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const oldReport = reportStore.getReport(req.params.id, orgId);
    if (!oldReport) return sendError(res, 404, 'report_not_found');
    reportStore.deleteReport(req.params.id, orgId);
    auditLogger.log({
      orgId,
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: 'DELETE',
      entity: 'compliance_report',
      entityId: req.params.id,
      oldValue: { id: oldReport.id, title: oldReport.title },
      metadata: { route: req.originalUrl },
    });
    res.json({ success: true, deleted: req.params.id });
  } catch (err) {
    sendError(res, 500, 'report_delete_failed', { message: err.message });
  }
});

// GET /api/compliance/stats
router.get('/stats', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const stats = reportStore.getStats(orgId);
    res.json({ success: true, stats });
  } catch (err) {
    sendError(res, 500, 'compliance_stats_failed', { message: err.message });
  }
});

module.exports = router;
