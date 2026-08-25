// SPDX-License-Identifier: MIT
/**
 * Assessment route registration for simplebeacon-server bootstrap.
 *
 * @license MIT
 */

const helmet = require("helmet");
const assessmentRouter = require("./index.cjs");
const controller = require("./AssessmentController.cjs");

/**
 * Register assessment routes on an Express app (simplebeacon-server bootstrap).
 * @param {import('express').Application} app - Express application instance.
 */
function setupAssessmentRoutes(app) {
  app.use("/api/assessment", helmet(), assessmentRouter);
}

module.exports = { setupAssessmentRoutes };
