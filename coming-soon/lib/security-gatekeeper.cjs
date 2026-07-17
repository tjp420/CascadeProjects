'use strict';

/**
 * SecurityGatekeeper — 4-layer security gatekeeper for token validation.
 *
 * Layer 1: Sybil protection (disposable domain filter + Turnstile + IP rate limit)
 * Layer 2: Device fingerprinting (SHA-256 hash of IP-prefix + UA + accept-language)
 * Layer 3: Magic link auth (claim code generation + single-use consumption)
 * Layer 4: Dynamic scanner module delivery (auth-gated worker serving)
 *
 * Graceful degradation: falls back to MemoryCache when Redis is unavailable.
 */

const crypto = require('crypto');
const https = require('https');
const path = require('path');

// ── MemoryCache (Map-based, TTL-aware) ──────────────────────────────────────

class MemoryCache {
    constructor() {
        this._store = new Map();
    }

    _pack(value, ttlMs) {
        return { value, expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0 };
    }

    async get(key) {
        const entry = this._store.get(key);
        if (!entry) return null;
        if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
            this._store.delete(key);
            return null;
        }
        return entry.value;
    }

    async set(key, value, ttlMs = 0) {
        this._store.set(key, this._pack(value, ttlMs));
    }

    async del(key) {
        this._store.delete(key);
    }

    async incr(key, ttlMs = 0) {
        const entry = this._store.get(key);
        let count = 1;
        if (entry && (entry.expiresAt === 0 || Date.now() <= entry.expiresAt)) {
            count = (entry.value || 0) + 1;
        }
        this._store.set(key, this._pack(count, ttlMs));
        return count;
    }
}

// ── SecurityGatekeeper ──────────────────────────────────────────────────────

const DEFAULT_IP_RATE_LIMIT = 1; // 1 request per 24h per IP
const DEFAULT_IP_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEVICE_BINDING_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const CLAIM_CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class SecurityGatekeeper {
    /**
     * @param {Object} options
     * @param {Object} [options.redisClient] - Redis client (optional)
     * @param {boolean} [options.strictRedis] - If true, require Redis (no fallback)
     * @param {string[]} [options.disposableDomains] - Array of disposable email domains
     * @param {string} [options.turnstileSecret] - Cloudflare Turnstile secret key
     */
    constructor(options = {}) {
        this.redisClient = options.redisClient || null;
        this.strictRedis = options.strictRedis === true;
        this.turnstileSecret = options.turnstileSecret || process.env.TURNSTILE_SECRET_KEY || '';
        this.disposableDomains = new Set(
            (options.disposableDomains || []).map(d => d.toLowerCase().trim())
        );
        this._memoryCache = new MemoryCache();
        this._useRedis = Boolean(this.redisClient);
    }

    // ── Cache abstraction ───────────────────────────────────────────────────

    async _cacheGet(key) {
        if (this._useRedis && this.redisClient) {
            try {
                const val = await this.redisClient.get(key);
                return val ? JSON.parse(val) : null;
            } catch (err) {
                if (this.strictRedis) throw err;
                this._useRedis = false;
            }
        }
        return this._memoryCache.get(key);
    }

    async _cacheSet(key, value, ttlMs = 0) {
        if (this._useRedis && this.redisClient) {
            try {
                if (ttlMs > 0) {
                    await this.redisClient.set(key, JSON.stringify(value), 'PX', ttlMs);
                } else {
                    await this.redisClient.set(key, JSON.stringify(value));
                }
                return;
            } catch (err) {
                if (this.strictRedis) throw err;
                this._useRedis = false;
            }
        }
        return this._memoryCache.set(key, value, ttlMs);
    }

    async _cacheDel(key) {
        if (this._useRedis && this.redisClient) {
            try {
                await this.redisClient.del(key);
                return;
            } catch (err) {
                if (this.strictRedis) throw err;
                this._useRedis = false;
            }
        }
        return this._memoryCache.del(key);
    }

    async _cacheIncr(key, ttlMs = 0) {
        if (this._useRedis && this.redisClient) {
            try {
                const count = await this.redisClient.incr(key);
                if (ttlMs > 0 && count === 1) {
                    await this.redisClient.expire(key, Math.ceil(ttlMs / 1000));
                }
                return count;
            } catch (err) {
                if (this.strictRedis) throw err;
                this._useRedis = false;
            }
        }
        return this._memoryCache.incr(key, ttlMs);
    }

    // ── Layer 1: Sybil Protection ───────────────────────────────────────────

    /**
     * Validate the Sybil protection layer.
     * @param {Object} req - Express request
     * @param {string} email - User email
     * @param {string} [turnstileToken] - Cloudflare Turnstile token
     * @returns {Promise<{allowed: boolean, error?: string, status?: number}>}
     */
    async validateSybilLayer(req, email, turnstileToken) {
        // 1a. Disposable domain check
        const domain = String(email || '').split('@')[1] || '';
        if (this.disposableDomains.has(domain.toLowerCase())) {
            return { allowed: false, error: 'Disposable email domains are not allowed', status: 403 };
        }

        // 1b. IP rate limiting (1 request per 24h per IP)
        const ip = this._getClientIp(req);
        const ipKey = `sybil:ip:${ip}`;
        const count = await this._cacheIncr(ipKey, DEFAULT_IP_RATE_WINDOW_MS);
        if (count > DEFAULT_IP_RATE_LIMIT) {
            return {
                allowed: false,
                error: 'Rate limit exceeded. Only one token request per day is allowed from this IP.',
                status: 429
            };
        }

        // 1c. Turnstile verification (if configured)
        if (this.turnstileSecret && turnstileToken) {
            const valid = await this._verifyTurnstile(turnstileToken, ip);
            if (!valid) {
                return { allowed: false, error: 'Captcha verification failed', status: 403 };
            }
        }

        return { allowed: true };
    }

    /**
     * Verify Cloudflare Turnstile token.
     * @param {string} token - Turnstile token
     * @param {string} remoteIp - Client IP
     * @returns {Promise<boolean>}
     */
    _verifyTurnstile(token, remoteIp) {
        return new Promise((resolve) => {
            const payload = new URLSearchParams();
            payload.append('secret', this.turnstileSecret);
            payload.append('response', token);
            if (remoteIp) payload.append('remoteip', remoteIp);

            const body = payload.toString();
            const req = https.request({
                hostname: 'challenges.cloudflare.com',
                path: '/turnstile/v0/siteverify',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(body)
                }
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        resolve(Boolean(result.success));
                    } catch {
                        resolve(false);
                    }
                });
            });
            req.on('error', () => resolve(false));
            req.write(body);
            req.end();
        });
    }

    // ── Layer 2: Device Fingerprinting ──────────────────────────────────────

    /**
     * Generate a device fingerprint hash from request properties.
     * @param {Object} req - Express request
     * @returns {string} SHA-256 hex hash
     */
    generateDeviceHash(req) {
        const ip = this._getClientIp(req);
        const ipPrefix = ip.split('.').slice(0, 3).join('.'); // first 3 octets
        const userAgent = String(req.headers['user-agent'] || '').trim();
        const acceptLanguage = String(req.headers['accept-language'] || '').trim().toLowerCase();
        const fingerprint = `${ipPrefix}|${userAgent}|${acceptLanguage}`;
        return crypto.createHash('sha256').update(fingerprint).digest('hex');
    }

    /**
     * Bind a token to a device fingerprint.
     * @param {string} token - The token to bind
     * @param {Object} req - Express request
     * @returns {Promise<string>} The device fingerprint hash
     */
    async bindTokenToDevice(token, req) {
        const fingerprint = this.generateDeviceHash(req);
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        await this._cacheSet(`device:${tokenHash}`, fingerprint, DEVICE_BINDING_TTL_MS);
        return fingerprint;
    }

    /**
     * Verify that the current request matches the stored device fingerprint.
     * @param {string} token - The token to verify
     * @param {Object} req - Express request
     * @returns {Promise<{valid: boolean, fingerprint?: string}>}
     */
    async verifyDeviceBinding(token, req) {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const storedFingerprint = await this._cacheGet(`device:${tokenHash}`);
        if (!storedFingerprint) {
            // No binding stored — allow (backwards compat for existing tokens)
            return { valid: true, fingerprint: null };
        }
        const currentFingerprint = this.generateDeviceHash(req);
        if (storedFingerprint === currentFingerprint) {
            return { valid: true, fingerprint: currentFingerprint };
        }
        return { valid: false, fingerprint: currentFingerprint };
    }

    // ── Layer 3: Magic Link Auth (Claim Code Exchange) ──────────────────────

    /**
     * Generate a single-use claim code for magic link auth.
     * @param {string} email - User email
     * @param {string} token - Sandbox/free token
     * @returns {Promise<string>} 16-byte hex claim code
     */
    async generateClaimCode(email, token) {
        const claimCode = crypto.randomBytes(16).toString('hex');
        await this._cacheSet(`claim:${claimCode}`, { email, token }, CLAIM_CODE_TTL_MS);
        return claimCode;
    }

    /**
     * Consume a claim code (single-use — deleted after read).
     * @param {string} claimCode - The claim code to consume
     * @returns {Promise<{email: string, token: string} | null>}
     */
    async consumeClaimCode(claimCode) {
        const data = await this._cacheGet(`claim:${claimCode}`);
        if (!data) return null;
        await this._cacheDel(`claim:${claimCode}`);
        return data;
    }

    // ── Layer 4: Dynamic Scanner Module Delivery ────────────────────────────

    /**
     * Verify token + device binding for scanner module access.
     * @param {string} token - Bearer token
     * @param {Object} req - Express request
     * @param {Function} dbVerifyCb - Callback to verify token in DB (returns boolean)
     * @returns {Promise<{allowed: boolean, error?: string}>}
     */
    async streamScannerModule(req, token, dbVerifyCb) {
        if (!token) {
            return { allowed: false, error: 'Token required' };
        }

        // Verify token in DB via callback
        if (typeof dbVerifyCb === 'function') {
            const dbValid = await dbVerifyCb(token);
            if (!dbValid) {
                return { allowed: false, error: 'Invalid or revoked token' };
            }
        }

        // Verify device binding
        const deviceCheck = await this.verifyDeviceBinding(token, req);
        if (!deviceCheck.valid) {
            return { allowed: false, error: 'Device mismatch' };
        }

        return { allowed: true };
    }

    // ── Utilities ───────────────────────────────────────────────────────────

    _getClientIp(req) {
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
            return String(forwarded).split(',')[0].trim();
        }
        return req.ip || req.socket?.remoteAddress || 'unknown';
    }

    /**
     * Load disposable domains from a JSON file.
     * @param {string} filePath - Path to disposable-domains.json
     * @returns {string[]}
     */
    static loadDisposableDomains(filePath) {
        try {
            const fs = require('fs');
            const raw = fs.readFileSync(filePath, 'utf8');
            const domains = JSON.parse(raw);
            if (Array.isArray(domains)) return domains;
            return [];
        } catch {
            return [];
        }
    }
}

module.exports = { SecurityGatekeeper, MemoryCache };
