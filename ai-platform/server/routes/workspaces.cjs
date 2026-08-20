/**
 * Workspace Routes — Multi-tenant workspace CRUD with RLS transaction guardrails.
 * Every route runs inside a PostgreSQL transaction scoped to the user's workspace.
 */

const express = require("express");
const {
  setWorkspaceRlsContext,
  requirePermission,
} = require("../lib/rbac.cjs");
const logger = require("../lib/app-logger.cjs");
const {
  validateParam,
  VALIDATION_PATTERNS,
} = require("../middleware/validate-params.cjs");
const { sendError } = require("../lib/response-helpers.cjs");

const router = express.Router();

/**
 * Build workspace routes with RLS guardrails.
 * @param {any} db - DatabaseAdapter instance.
 * @returns {express.Router}
 */
function setupWorkspaceRoutes(db) {
  // Inject db into request for downstream RLS middleware
  router.use((req, res, next) => {
    req.db = db;
    next();
  });

  // Apply RLS transaction scoping to all workspace routes
  router.use(setWorkspaceRlsContext);

  /**
   * GET /api/workspaces
   * List workspaces visible to the current user within their RLS scope.
   */
  router.get("/", async (req, res) => {
    try {
      const client = req.scopedClient || db;
      const { rows } = await client.query(
        "SELECT id, name, slug, organization_id, created_at, updated_at FROM workspaces ORDER BY name LIMIT 50",
      );
      res.json({ workspaces: rows });
    } catch (error) {
      logger.error("[Workspaces] GET / failed:", error.message);
      sendError(res, 500, "Failed to list workspaces");
    }
  });

  /**
   * GET /api/workspaces/:id
   * Get a single workspace by ID (RLS-enforced — only returns if in scoped workspace).
   */
  router.get(
    "/:id",
    validateParam("id", VALIDATION_PATTERNS.uuid),
    async (req, res) => {
      try {
        const client = req.scopedClient || db;
        const { rows } = await client.query(
          "SELECT id, name, slug, organization_id, settings, created_at, updated_at FROM workspaces WHERE id = $1",
          [req.params.id],
        );
        if (rows.length === 0) {
          return sendError(res, 404, "Workspace not found");
        }
        res.json({ workspace: rows[0] });
      } catch (error) {
        logger.error("[Workspaces] GET /:id failed:", error.message);
        sendError(res, 500, "Failed to fetch workspace");
      }
    },
  );

  /**
   * POST /api/workspaces
   * Create a new workspace (requires write permission).
   */
  router.post("/", requirePermission("write:own"), async (req, res) => {
    try {
      const { name, slug, settings } = req.body;
      if (!name || typeof name !== "string") {
        return sendError(res, 400, "Workspace name is required");
      }
      const client = req.scopedClient || db;
      const { rows } = await client.query(
        `INSERT INTO workspaces (name, slug, organization_id, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id, name, slug, organization_id, settings, created_at, updated_at`,
        [
          name,
          slug || null,
          req.user?.organizationId || null,
          settings ? JSON.stringify(settings) : "{}",
        ],
      );
      res.status(201).json({ workspace: rows[0] });
    } catch (error) {
      logger.error("[Workspaces] POST / failed:", error.message);
      sendError(res, 500, "Failed to create workspace");
    }
  });

  /**
   * PATCH /api/workspaces/:id
   * Update workspace (requires write permission).
   */
  router.patch(
    "/:id",
    validateParam("id", VALIDATION_PATTERNS.uuid),
    requirePermission("write:own"),
    async (req, res) => {
      try {
        const { name, slug, settings } = req.body;
        const client = req.scopedClient || db;
        const { rows } = await client.query(
          `UPDATE workspaces
         SET name = COALESCE($1, name),
             slug = COALESCE($2, slug),
             settings = COALESCE($3, settings),
             updated_at = NOW()
         WHERE id = $4
         RETURNING id, name, slug, organization_id, settings, created_at, updated_at`,
          [
            name || null,
            slug || null,
            settings ? JSON.stringify(settings) : null,
            req.params.id,
          ],
        );
        if (rows.length === 0) {
          return sendError(res, 404, "Workspace not found");
        }
        res.json({ workspace: rows[0] });
      } catch (error) {
        logger.error("[Workspaces] PATCH /:id failed:", error.message);
        sendError(res, 500, "Failed to update workspace");
      }
    },
  );

  /**
   * DELETE /api/workspaces/:id
   * Delete workspace (requires admin permission).
   */
  router.delete(
    "/:id",
    validateParam("id", VALIDATION_PATTERNS.uuid),
    requirePermission("admin:all"),
    async (req, res) => {
      try {
        const client = req.scopedClient || db;
        const { rowCount } = await client.query(
          "DELETE FROM workspaces WHERE id = $1",
          [req.params.id],
        );
        if (rowCount === 0) {
          return sendError(res, 404, "Workspace not found");
        }
        res.status(204).send();
      } catch (error) {
        logger.error("[Workspaces] DELETE /:id failed:", error.message);
        sendError(res, 500, "Failed to delete workspace");
      }
    },
  );

  return router;
}

module.exports = { setupWorkspaceRoutes };
