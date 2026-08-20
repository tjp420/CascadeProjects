/**
 * SimpleBeacon Enterprise Workspace Routes
 * CRUD + member invitation flow.
 */

const express = require("express");
const crypto = require("crypto");
const db = require("../lib/db.cjs");
const { requireAuth } = require("../lib/auth.js");
const {
  requirePermission,
  requireWorkspaceMembership,
  setWorkspaceRlsContext,
} = require("../lib/rbac.js");

const router = express.Router();

// Authentication is applied per route below; the invitation-accept route is token-based.

// ── Workspace CRUD ─────────────────────────────────────────────────────────

/**
 * GET /api/v2/workspaces
 * List workspaces the current user is a member of.
 */
router.get("/api/v2/workspaces", requireAuth, async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT w.id, w.name, w.slug, w.description, w.subscription_tier, w.max_members,
                    w.gate_policy, w.ignore_patterns, w.scan_schedule_cron, w.last_scan_at,
                    w.created_at, w.updated_at,
                    r.name AS my_role, wm.invitation_accepted
             FROM workspaces w
             JOIN workspace_members wm ON wm.workspace_id = w.id
             JOIN roles r ON r.id = wm.role_id
             WHERE wm.user_id = $1 AND w.is_active = true AND w.deleted_at IS NULL
             ORDER BY w.created_at DESC`,
      [req.auth.userId],
    );
    res.json({ workspaces: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v2/workspaces
 * Create a new workspace (requires workspace.admin or higher).
 * Body: { name, slug, description?, orgId? }
 */
router.post(
  "/api/v2/workspaces",
  requireAuth,
  requirePermission("workspace.admin"),
  async (req, res) => {
    const { name, slug, description, orgId } = req.body || {};
    if (!name || !slug) {
      return res.status(400).json({ error: "name and slug required" });
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res
        .status(400)
        .json({ error: "slug must be lowercase alphanumeric with hyphens" });
    }

    try {
      const existing = await db.get(
        "SELECT id FROM workspaces WHERE slug = $1",
        [slug],
      );
      if (existing) {
        return res.status(409).json({ error: "Slug already taken" });
      }

      // Determine org: explicit orgId, or user's primary org
      let targetOrgId = orgId;
      if (!targetOrgId) {
        const org = await db.get(
          `SELECT o.id FROM organizations o
                 JOIN workspaces w ON w.org_id = o.id
                 JOIN workspace_members wm ON wm.workspace_id = w.id
                 WHERE wm.user_id = $1 LIMIT 1`,
          [req.auth.userId],
        );
        if (!org) {
          return res
            .status(400)
            .json({
              error:
                "No organization found — create one first or provide orgId",
            });
        }
        targetOrgId = org.id;
      }

      const workspace = await db.get(
        `INSERT INTO workspaces (name, slug, description, owner_id, billing_email, org_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, name, slug, description, created_at`,
        [
          name,
          slug,
          description || null,
          req.auth.userId,
          req.auth.email,
          targetOrgId,
        ],
      );

      // Auto-add creator as admin
      const adminRole = await db.get(
        "SELECT id FROM roles WHERE name = 'admin'",
      );
      await db.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role_id, invitation_accepted)
             VALUES ($1, $2, $3, true)`,
        [workspace.id, req.auth.userId, adminRole.id],
      );

      res.status(201).json({ workspace });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

/**
 * GET /api/v2/workspaces/:workspaceId
 * Get workspace details.
 */
router.get(
  "/api/v2/workspaces/:workspaceId",
  requireAuth,
  requireWorkspaceMembership,
  setWorkspaceRlsContext,
  async (req, res) => {
    try {
      const workspace = await db.get(
        `SELECT id, name, slug, description, subscription_tier, max_members, max_projects,
                    gate_policy, ignore_patterns, scan_schedule_cron, last_scan_at,
                    sso_enabled, is_active, created_at, updated_at
             FROM workspaces WHERE id = $1`,
        [req.params.workspaceId],
      );
      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      res.json({ workspace, myRole: req.membership.role_name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

/**
 * PATCH /api/v2/workspaces/:workspaceId
 * Update workspace settings (admin only).
 */
router.patch(
  "/api/v2/workspaces/:workspaceId",
  requireAuth,
  requireWorkspaceMembership,
  requirePermission("workspace.update"),
  async (req, res) => {
    const {
      name,
      description,
      gatePolicy,
      ignorePatterns,
      scanScheduleCron,
      maxMembers,
    } = req.body || {};
    const updates = [];
    const params = [];
    let idx = 1;

    if (name) {
      updates.push(`name = $${idx++}`);
      params.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${idx++}`);
      params.push(description);
    }
    if (gatePolicy) {
      updates.push(`gate_policy = $${idx++}`);
      params.push(JSON.stringify(gatePolicy));
    }
    if (ignorePatterns) {
      updates.push(`ignore_patterns = $${idx++}`);
      params.push(ignorePatterns);
    }
    if (scanScheduleCron) {
      updates.push(`scan_schedule_cron = $${idx++}`);
      params.push(scanScheduleCron);
    }
    if (maxMembers) {
      updates.push(`max_members = $${idx++}`);
      params.push(maxMembers);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    params.push(req.params.workspaceId);
    try {
      const workspace = await db.get(
        `UPDATE workspaces SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
        params,
      );
      res.json({ workspace });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// ── Member Management ──────────────────────────────────────────────────────

/**
 * GET /api/v2/workspaces/:workspaceId/members
 */
router.get(
  "/api/v2/workspaces/:workspaceId/members",
  requireAuth,
  requireWorkspaceMembership,
  requirePermission("member.read"),
  async (req, res) => {
    try {
      const rows = await db.query(
        `SELECT wm.id, u.email, u.display_name, r.name AS role, wm.invitation_accepted,
                        wm.invite_email, wm.joined_at
                 FROM workspace_members wm
                 JOIN users u ON u.id = wm.user_id
                 JOIN roles r ON r.id = wm.role_id
                 WHERE wm.workspace_id = $1
                 ORDER BY wm.joined_at DESC`,
        [req.params.workspaceId],
      );
      res.json({ members: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

/**
 * POST /api/v2/workspaces/:workspaceId/invitations
 * Invite a member by email. Requires workspace.invite permission.
 * Body: { email, role }
 */
router.post(
  "/api/v2/workspaces/:workspaceId/invitations",
  requireAuth,
  requireWorkspaceMembership,
  requirePermission("workspace.invite"),
  async (req, res) => {
    const { email, role } = req.body || {};
    if (!email || !role) {
      return res.status(400).json({ error: "email and role required" });
    }

    try {
      const roleRow = await db.get("SELECT id FROM roles WHERE name = $1", [
        role,
      ]);
      if (!roleRow) {
        return res.status(400).json({ error: "Invalid role" });
      }

      // Check if already a member
      const existing = await db.get(
        `SELECT id FROM workspace_members
                 WHERE workspace_id = $1 AND (user_id IN (SELECT id FROM users WHERE email = $2) OR invite_email = $2)`,
        [req.params.workspaceId, email.toLowerCase()],
      );
      if (existing) {
        return res
          .status(409)
          .json({ error: "User already invited or member" });
      }

      // Generate secure invite token
      const inviteToken = crypto.randomBytes(32).toString("hex");
      const { hashPassword } = require("../lib/auth.js");
      const tokenHash = await hashPassword(inviteToken);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

      // Try to find existing user
      const targetUser = await db.get("SELECT id FROM users WHERE email = $1", [
        email.toLowerCase(),
      ]);

      await db.query(
        `INSERT INTO workspace_members
                 (workspace_id, user_id, role_id, invite_email, invite_token_hash, invite_expires_at, invitation_accepted, invited_by)
                 VALUES ($1, $2, $3, $4, $5, $6, false, $7)`,
        [
          req.params.workspaceId,
          targetUser?.id || null,
          roleRow.id,
          email.toLowerCase(),
          tokenHash,
          expiresAt,
          req.auth.userId,
        ],
      );

      res.status(201).json({
        inviteToken, // shown once — send via email
        expiresAt,
        message: `Invite sent to ${email}`,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

/**
 * POST /api/v2/workspaces/:workspaceId/invitations/:token/accept
 * Accept an invitation. No auth required (token-based).
 */
router.post(
  "/api/v2/workspaces/:workspaceId/invitations/:token/accept",
  async (req, res) => {
    const { token } = req.params;
    try {
      const invite = await db.get(
        `SELECT id, invite_token_hash, invite_expires_at, user_id, role_id, workspace_id
             FROM workspace_members
             WHERE workspace_id = $1 AND invitation_accepted = false`,
        [req.params.workspaceId],
      );
      if (!invite) {
        return res.status(404).json({ error: "Invitation not found" });
      }
      if (new Date(invite.invite_expires_at) < new Date()) {
        return res.status(410).json({ error: "Invitation expired" });
      }

      const { verifyPassword } = require("../lib/auth.js");
      const valid = await verifyPassword(token, invite.invite_token_hash);
      if (!valid) {
        return res.status(403).json({ error: "Invalid invitation token" });
      }

      // If no user_id yet, require login/registration to link
      if (!invite.user_id) {
        return res.status(400).json({
          error: "Account required",
          message: "Register or login first, then retry with auth header",
        });
      }

      await db.query(
        `UPDATE workspace_members
             SET invitation_accepted = true, invite_token_hash = NULL, invite_expires_at = NULL
             WHERE id = $1`,
        [invite.id],
      );

      res.json({
        message: "Invitation accepted",
        workspaceId: invite.workspace_id,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
