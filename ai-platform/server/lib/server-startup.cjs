// simplebeacon-ignore test-coverage
/**
 * Server startup manager — handles port binding, EADDRINUSE retry, and startup logging.
 */
function createStartupManager({ app, logger, logSystemEvent, constants }) {
  /**
   * Log server startup.
   * @param {number} port
   */
  function logServerStartup(port) {
    logger.info(`Simplebeacon server running on port ${port}`);
    logger.info(
      `Dashboard listening on port ${port} (set PUBLIC_BASE_URL for absolute links)`,
    );
    logger.info(`API Health: /api/health`);
    logger.info(`Status: /api/status`);
    logger.info("Security: Enhanced security features enabled");
    logger.info("Audit: Comprehensive audit logging active");
    logSystemEvent("server_start", {
      port,
      environment: process.env.NODE_ENV || "development",
      security: {
        rateLimiting: true,
        authentication: true,
        auditLogging: true,
      },
    });
  }

  /**
   * Handle server error.
   * @param {import('http').Server} server
   * @param {Error} err
   * @param {number} attemptPort
   * @param {number} maxRetries
   * @param {Function} start
   */
  function handleServerError(server, err, attemptPort, maxRetries, start) {
    if (err.code === "EADDRINUSE" && maxRetries > 0) {
      logger.warn(`Port ${attemptPort} in use — trying ${attemptPort + 1}`);
      server.close();
      start(attemptPort + 1, maxRetries - 1);
    } else {
      logger.error(`Server failed to start: ${err.message}`);
      process.exit(1);
    }
  }

  /**
   * Start server with enhanced logging — auto-increment port on EADDRINUSE.
   * @param {number} attemptPort
   * @param {number} maxRetries
   * @param {Function} onListen
   */
  function startServer(
    attemptPort,
    maxRetries = constants.MAX_RETRIES,
    onListen,
  ) {
    const server = app.listen(attemptPort, () => {
      if (typeof onListen === "function") onListen(attemptPort);
      logServerStartup(attemptPort);
    });
    server.on("error", (err) =>
      handleServerError(server, err, attemptPort, maxRetries, (p, r) =>
        startServer(p, r, onListen),
      ),
    );
  }

  return { startServer };
}

module.exports = { createStartupManager };
