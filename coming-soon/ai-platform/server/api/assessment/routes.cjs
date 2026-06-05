const assessmentRouter = require('./index.cjs');
const controller = require('./AssessmentController.cjs');

/**
 * Register assessment routes on an Express app (simplebeacon-server bootstrap).
 */
function setupAssessmentRoutes(app) {
  app.use('/api/assessment', assessmentRouter);
}

module.exports = { setupAssessmentRoutes };
