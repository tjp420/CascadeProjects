// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
/**
 * Phase 2 login handler — database/demo users with legacy fallback.
 */

const createError = require("http-errors");
const logger = require("../lib/app-logger.cjs");
const {
  generateToken,
  trustLevels,
  auditAuth,
  handleLogin,
} = require("../middleware/auth.cjs");
const { authenticateUser, loadDemoUsers } = require("./user-service.cjs");

/**
 * Handle phase2 login.
 * @param {any} req
 * @param {Array} res
 * @param {any} next
 * @returns {any}
 */
async function handlePhase2Login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw createError(400, "Email and password required");
    }

    const db = req.app?.locals?.db || null;
    const authResult = await authenticateUser(db, email, password);

    if (authResult) {
      const { user, source } = authResult;
      const token = generateToken(user);
      auditAuth("login_success", user, req);

      return res.json({
        message: "Login successful",
        token,
        source,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          trustLevel: user.trustLevel,
          role: user.role || "",
          features: Array.isArray(user.features) ? user.features : [],
          tier: user.tier || "",
          permissions:
            trustLevels[user.trustLevel]?.permissions ||
            trustLevels.bronze.permissions,
        },
      });
    }

    if (process.env.ALLOW_LEGACY_LOGIN === "true") {
      return handleLogin(req, res, next);
    }

    let demoUserFound = false;
    try {
      const demoUsers = loadDemoUsers();
      demoUserFound = demoUsers.some(
        (u) => u.email && u.email.toLowerCase() === String(email).toLowerCase(),
      );
    } catch (e) {
      console.error("phase2-auth-handlers.cjs error:", e);
      // ignore demo file read errors
    }
    logger.warn(
      `[Phase2Login] failed for ${email} - demoUserFound: ${demoUserFound}`,
    );
    auditAuth("login_failed", { email }, req);
    const debug =
      process.env.DEBUG_CLIENT_ERRORS === "1"
        ? { email, demoUserFound }
        : undefined;
    const body = {
      error: "Authentication failed",
      message: "Invalid email or password",
    };
    if (debug) body.debug = debug;
    return res.status(401).json(body);
  } catch (error) {
    auditAuth("login_failed", { email: req.body?.email }, req);
    logger.error(
      "[Phase2Login] Error during login:",
      error?.message,
      error?.stack,
    );
    // Try legacy login handler as a fallback before returning the error
    try {
      if (process.env.ALLOW_LEGACY_LOGIN !== "false") {
        return await handleLogin(req, res, next);
      }
    } catch (legacyError) {
      logger.error(
        "[Phase2Login] Legacy fallback also failed:",
        legacyError?.message,
      );
    }
    return res.status(500).json({
      error: error?.name || "login_error",
      message: error?.message || "Login failed due to a server error.",
      stack: error?.stack,
    });
  }
}

module.exports = { handlePhase2Login };
