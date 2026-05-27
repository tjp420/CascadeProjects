const assessmentRouter = require('./index');
const controller = require('./AssessmentController');

/**
 * Register assessment routes on an Express app (simplebeacon-server bootstrap).
 */
function setupAssessmentRoutes(app) {
  app.use('/api/assessment', assessmentRouter);

  // Backward-compatible plural paths (lead-gen + existing clients)
  app.post('/api/assessments', (req, res) => controller.triggerScan(req, res));
  app.get('/api/assessments/:assessmentId', (req, res) => controller.getReport(req, res));
  app.get('/api/assessments/:assessmentId/download/:format', (req, res) => controller.downloadReport(req, res));
}

module.exports = { setupAssessmentRoutes, assessmentRouter };
