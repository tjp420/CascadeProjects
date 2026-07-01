'use strict';

const crypto = require('crypto');
const constants = require('../../config/constants.cjs');

const deviceTrust = new Map();

// Generate device fingerprint
function generateDeviceFingerprint(req) {
  if (!req || typeof req !== 'object') return '';
  const userAgent = req.headers?.['user-agent'] || '';
  const ip = req.ip || req.connection?.remoteAddress || '';
  return crypto.createHash('sha256').update(`${userAgent}:${ip}`).digest('hex');
}

// Trust device
function trustDevice(userId, deviceFingerprint, duration = 30 * 24 * 60 * constants.ONE_MINUTE_MS) {
  if (!userId || typeof userId !== 'string') return;
  if (!deviceFingerprint || typeof deviceFingerprint !== 'string') return;
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 30 * 24 * 60 * constants.ONE_MINUTE_MS;
  const key = `${userId}:${deviceFingerprint}`;
  deviceTrust.set(key, {
    trusted: true,
    trustedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + duration).toISOString()
  });

  // Auto-cleanup expired devices (clamp to Node's max setTimeout of ~24.8 days)
  const cleanupDelay = Math.min(safeDuration, 2147483647);
  setTimeout(() => {
    deviceTrust.delete(key);
  }, cleanupDelay).unref();
}

// Device trust verification middleware
function verifyDeviceTrust(req, res, next) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }
  const deviceFingerprint = generateDeviceFingerprint(req);

  const trustedDevice = deviceTrust.get(`${user.id}:${deviceFingerprint}`);

  if (!trustedDevice && user.trustLevel === 'gold') {
    return res.status(403).json({
      error: 'Device Not Trusted',
      message: 'Device trust required for this access level',
      deviceTrustRequired: true
    });
  }

  req.device = trustedDevice || { fingerprint: deviceFingerprint, trusted: false };
  next();
}

module.exports = { generateDeviceFingerprint, trustDevice, verifyDeviceTrust, deviceTrust };
