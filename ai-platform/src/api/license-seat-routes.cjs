"use strict";

/**
 * License Seat Management API — self-service seat roster for team admins.
 *
 * Endpoints:
 *   GET    /api/license/seats                  — Retrieve seat roster for admin's license
 *   POST   /api/license/seats/invite           — Generate invitation token + allocate seat
 *   DELETE /api/license/seats/revoke/:seatId   — Revoke a developer's seat access
 *
 * Storage: Seat data persisted in LICENSE_STORE KV under key `seats:{licenseKey}`.
 * Auth: All routes require admin authentication via `authorize('admin:all')`.
 *
 * @module license-seat-routes
 */

const express = require("express");
const crypto = require("crypto");
const { authorize } = require("../../server/middleware/authorize.cjs");
const { getTierSeatLimit } = require("../../server/config/stripe.cjs");
const {
  getSubscriptionByEmail,
} = require("../../server/lib/simplebeacon-subscription-store.cjs");
const {
  verifyLicenseToken,
} = require("../../server/lib/simplebeacon-proxy.cjs");
const logger = require("../../server/lib/app-logger.cjs");

const router = express.Router();

/**
 * Resolve the license key from the authenticated admin user.
 * Reads the subscription record to find the license token.
 * @param {Object} req - Express request with req.user
 * @returns {Promise<{licenseKey: string, tier: string, email: string}|null>}
 */
async function resolveAdminLicense(req) {
  const email = req.user?.email;
  if (!email) return null;

  const sub = getSubscriptionByEmail(email);
  if (!sub || !sub.licenseToken) return null;

  // Verify the token is still valid
  try {
    const secret = resolveLicenseSecret();
    const payload = verifyLicenseToken(sub.licenseToken, secret);
    if (!payload) return null;
    return {
      licenseKey: sub.licenseToken,
      tier: sub.licenseTier || payload.tier || "developer",
      email,
    };
  } catch (err) {
    logger.warn(
      "[LicenseSeats] Failed to verify admin license token:",
      err.message,
    );
    return null;
  }
}

function resolveLicenseSecret() {
  const secret = String(
    process.env.SIMPLEBEACON_LICENSE_SECRET ||
      process.env.SIMPLEBEACON_SIGNING_PRIVATE_KEY ||
      "",
  ).trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SIMPLEBEACON_LICENSE_SECRET is required in production");
  }
  return "dev-secret";
}

/**
 * Read seat roster from KV store.
 * @param {Object} env - Worker env or mock with LICENSE_STORE
 * @param {string} licenseKey
 * @returns {Promise<Object|null>}
 */
async function readSeatStore(env, licenseKey) {
  if (!env?.LICENSE_STORE) return null;
  const raw = await env.LICENSE_STORE.get(`seats:${licenseKey}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Write seat roster to KV store.
 * @param {Object} env
 * @param {string} licenseKey
 * @param {Object} data
 */
async function writeSeatStore(env, licenseKey, data) {
  if (!env?.LICENSE_STORE) return;
  await env.LICENSE_STORE.put(
    `seats:${licenseKey}`,
    JSON.stringify({ ...data, updatedAt: new Date().toISOString() }),
  );
}

/**
 * Initialize a seat store for a license key if one doesn't exist.
 * @param {Object} env
 * @param {string} licenseKey
 * @param {string} tier
 * @param {string} adminEmail
 * @returns {Promise<Object>}
 */
async function initSeatStore(env, licenseKey, tier, adminEmail) {
  const maxSeats = getTierSeatLimit(tier);
  const now = new Date().toISOString();
  const seatData = {
    licenseKey,
    tier,
    maxSeats,
    seats: [
      {
        seatId: "seat_" + crypto.randomBytes(6).toString("hex"),
        email: adminEmail,
        status: "active",
        inviteToken: null,
        invitedAt: now,
        activatedAt: now,
      },
    ],
    updatedAt: now,
  };
  await writeSeatStore(env, licenseKey, seatData);
  return seatData;
}

/**
 * Generate a unique invitation token.
 * @returns {string}
 */
function generateInviteToken() {
  return "inv_" + crypto.randomBytes(12).toString("hex");
}

/**
 * Generate a unique seat ID.
 * @returns {string}
 */
function generateSeatId() {
  return "seat_" + crypto.randomBytes(6).toString("hex");
}

/**
 * Build the public invite URL for a token.
 * @param {string} token
 * @returns {string}
 */
function buildInviteUrl(token) {
  const baseUrl = process.env.APP_BASE_URL || "https://simplebeacon.ai";
  return `${baseUrl}/#/activate-license?token=${token}`;
}

// ── GET /api/license/seats ──
router.get("/seats", authorize("admin:all"), async (req, res) => {
  try {
    const admin = await resolveAdminLicense(req);
    if (!admin) {
      return res
        .status(403)
        .json({
          error: "no_license",
          message: "No active license found for this account",
        });
    }

    // In Express backend, env.LICENSE_STORE is not available — use process-level mock
    // or fall back to in-memory store. The Cloudflare Worker handles KV directly.
    const env = req.app.locals.licenseEnv || null;
    let seatData = await readSeatStore(env, admin.licenseKey);
    if (!seatData) {
      // Auto-initialize seat store on first access
      seatData = await initSeatStore(
        env,
        admin.licenseKey,
        admin.tier,
        admin.email,
      );
    }

    const seatsUsed = seatData.seats.filter(
      (s) => s.status === "active",
    ).length;
    const pendingInvites = seatData.seats.filter((s) => s.status === "pending");

    res.json({
      success: true,
      maxSeats: seatData.maxSeats,
      seatsUsed,
      seatsRemaining:
        seatData.maxSeats === Infinity
          ? Infinity
          : seatData.maxSeats - seatsUsed,
      tier: seatData.tier,
      seats: seatData.seats.filter((s) => s.status === "active"),
      pendingInvites,
    });
  } catch (err) {
    logger.error("[LicenseSeats] GET /seats failed:", err.message);
    res.status(500).json({ error: "seat_lookup_failed", message: err.message });
  }
});

// ── POST /api/license/seats/invite ──
router.post("/seats/invite", authorize("admin:all"), async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res
        .status(400)
        .json({
          error: "valid_email_required",
          message: "A valid email is required",
        });
    }

    const admin = await resolveAdminLicense(req);
    if (!admin) {
      return res
        .status(403)
        .json({
          error: "no_license",
          message: "No active license found for this account",
        });
    }

    const env = req.app.locals.licenseEnv || null;
    let seatData = await readSeatStore(env, admin.licenseKey);
    if (!seatData) {
      seatData = await initSeatStore(
        env,
        admin.licenseKey,
        admin.tier,
        admin.email,
      );
    }

    const seatsUsed = seatData.seats.filter(
      (s) => s.status === "active",
    ).length;
    const totalAllocated = seatData.seats.length;
    if (seatData.maxSeats !== Infinity && totalAllocated >= seatData.maxSeats) {
      return res.status(409).json({
        error: "no_available_seats",
        message: `All ${seatData.maxSeats} seats are in use`,
      });
    }

    // Check for duplicate email
    const existing = seatData.seats.find(
      (s) => s.email.toLowerCase() === email.toLowerCase(),
    );
    if (existing) {
      return res.status(409).json({
        error: "seat_already_provisioned",
        message: `${email} already has a seat or pending invitation`,
      });
    }

    const seatId = generateSeatId();
    const inviteToken = generateInviteToken();
    const now = new Date().toISOString();

    const newSeat = {
      seatId,
      email,
      status: "pending",
      inviteToken,
      invitedAt: now,
      activatedAt: null,
    };

    seatData.seats.push(newSeat);
    await writeSeatStore(env, admin.licenseKey, seatData);

    logger.info(
      `[LicenseSeats] Invite created: ${email} for ${admin.email}'s license`,
    );

    res.status(201).json({
      success: true,
      seatId,
      email,
      inviteToken,
      inviteUrl: buildInviteUrl(inviteToken),
      seatsUsed: seatsUsed + 1,
      seatsRemaining:
        seatData.maxSeats === Infinity
          ? Infinity
          : seatData.maxSeats - seatsUsed - 1,
    });
  } catch (err) {
    logger.error("[LicenseSeats] POST /seats/invite failed:", err.message);
    res.status(500).json({ error: "invite_failed", message: err.message });
  }
});

// ── DELETE /api/license/seats/revoke/:seatId ──
router.delete(
  "/seats/revoke/:seatId",
  authorize("admin:all"),
  async (req, res) => {
    try {
      const { seatId } = req.params;
      if (!seatId || !/^seat_[a-f0-9]{12}$/.test(seatId)) {
        return res
          .status(400)
          .json({
            error: "invalid_seat_id",
            message: "Invalid seat ID format",
          });
      }

      const admin = await resolveAdminLicense(req);
      if (!admin) {
        return res
          .status(403)
          .json({
            error: "no_license",
            message: "No active license found for this account",
          });
      }

      const env = req.app.locals.licenseEnv || null;
      const seatData = await readSeatStore(env, admin.licenseKey);
      if (!seatData) {
        return res
          .status(404)
          .json({
            error: "seat_not_found",
            message: "No seat data found for this license",
          });
      }

      const seatIdx = seatData.seats.findIndex((s) => s.seatId === seatId);
      if (seatIdx === -1) {
        return res
          .status(404)
          .json({
            error: "seat_not_found",
            message: `Seat ${seatId} not found in this license`,
          });
      }

      // Prevent revoking your own admin seat
      if (seatData.seats[seatIdx].email === admin.email) {
        return res
          .status(400)
          .json({
            error: "cannot_revoke_self",
            message: "You cannot revoke your own admin seat",
          });
      }

      const revokedSeat = seatData.seats[seatIdx];
      seatData.seats.splice(seatIdx, 1);
      await writeSeatStore(env, admin.licenseKey, seatData);

      // Deactivate the subscription for the revoked seat
      try {
        const {
          setSubscriptionActive,
        } = require("../../server/lib/simplebeacon-subscription-store.cjs");
        await setSubscriptionActive(revokedSeat.email, false, {
          certOrgId: null,
        });
      } catch (err) {
        logger.warn(
          `[LicenseSeats] Failed to deactivate subscription for ${revokedSeat.email}:`,
          err.message,
        );
      }

      const seatsUsed = seatData.seats.filter(
        (s) => s.status === "active",
      ).length;

      logger.info(
        `[LicenseSeats] Seat revoked: ${revokedSeat.email} (${seatId}) by ${admin.email}`,
      );

      res.json({
        success: true,
        seatId,
        email: revokedSeat.email,
        seatsUsed,
        seatsRemaining:
          seatData.maxSeats === Infinity
            ? Infinity
            : seatData.maxSeats - seatsUsed,
      });
    } catch (err) {
      logger.error("[LicenseSeats] DELETE /seats/revoke failed:", err.message);
      res.status(500).json({ error: "revoke_failed", message: err.message });
    }
  },
);

module.exports = router;
