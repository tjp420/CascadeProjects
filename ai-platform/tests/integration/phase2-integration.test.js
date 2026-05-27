const express = require('express');
const path = require('path');
const { setupPhase2Integration, closeRedis } = require('../../server/bootstrap/phase2-integration');
const { isPublicApiRoute } = require('../../server/bootstrap/public-api-routes');

const TEST_JWT_SECRET = 'test-v1-internal-secret-min-32-chars!!';
const TEST_JWT_REFRESH_SECRET = 'test-v1-internal-refresh-secret-32c!!';

async function withPhase2Server(fn, envOverrides = {}) {
    const previousEnv = {};
    for (const [key, value] of Object.entries(envOverrides)) {
        previousEnv[key] = process.env[key];
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = String(value);
        }
    }

    const app = express();
    app.use(express.json());
    const webRoot = path.join(__dirname, '../../web');

    await setupPhase2Integration(app, { webRoot });
    require('../../server/api/assessment/routes').setupAssessmentRoutes(app);
    app.get('/api/protected/ping', (req, res) => {
        res.json({ ok: true, authRequired: process.env.REQUIRE_AUTH === 'true' });
    });

    const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });

    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
        await fn(baseUrl);
    } finally {
        if (app.locals.db?.close) {
            await app.locals.db.close();
        }
        if (app.locals.redis) {
            await closeRedis(app.locals.redis);
        }
        await new Promise((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
        });
        for (const [key, value] of Object.entries(previousEnv)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
}

describe('Phase 2 integration routes', () => {
    test('health and platform status endpoints respond', async () => {
        await withPhase2Server(async (baseUrl) => {
            const health = await fetch(`${baseUrl}/api/health`).then((r) => r.json());
            expect(health.status).toBe('ok');
            expect(health.phase).toBe(2);

            const platform = await fetch(`${baseUrl}/api/platform/status`).then((r) => r.json());
            expect(platform.phase).toBe(2);
            expect(platform.features.jwtAuth).toBe(true);
            expect(platform.redis).toBe('disabled');
            expect(platform.features.redis).toBe(false);
        });
    });

    test('login endpoint returns a JWT for demo user', async () => {
        await withPhase2Server(async (baseUrl) => {
            const response = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'dev@simplebeacon.ai', password: 'demo123' })
            });
            expect(response.ok).toBe(true);
            const payload = await response.json();
            expect(payload.token).toBeTruthy();
            expect(payload.user.email).toBe('dev@simplebeacon.ai');
            expect(payload.source).toBe('demo-file');
        });
    });

    test('login rejects invalid credentials', async () => {
        await withPhase2Server(async (baseUrl) => {
            const response = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'dev@simplebeacon.ai', password: 'wrong' })
            });
            expect(response.status).toBe(401);
        });
    });

    test('auth me returns user profile with bearer token', async () => {
        await withPhase2Server(async (baseUrl) => {
            const login = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'dev@simplebeacon.ai', password: 'demo123' })
            }).then((r) => r.json());

            const me = await fetch(`${baseUrl}/api/auth/me`, {
                headers: { Authorization: `Bearer ${login.token}` }
            }).then((r) => r.json());

            expect(me.authenticated).toBe(true);
            expect(me.user.email).toBe('dev@simplebeacon.ai');
        });
    });

    test('database health reports disabled when ENABLE_DATABASE is not set', async () => {
        await withPhase2Server(async (baseUrl) => {
            const dbHealth = await fetch(`${baseUrl}/api/health/db`).then((r) => r.json());
            expect(dbHealth.status).toBe('disabled');
        });
    });

    test('redis health reports disabled when ENABLE_REDIS is not set', async () => {
        await withPhase2Server(async (baseUrl) => {
            const redisHealth = await fetch(`${baseUrl}/api/health/redis`).then((r) => r.json());
            expect(redisHealth.status).toBe('disabled');
        });
    });

    test('auth me rejects missing bearer token', async () => {
        await withPhase2Server(async (baseUrl) => {
            const response = await fetch(`${baseUrl}/api/auth/me`);
            expect(response.status).toBe(401);
        });
    });

    test('auth refresh rejects missing bearer token', async () => {
        await withPhase2Server(async (baseUrl) => {
            const response = await fetch(`${baseUrl}/api/auth/refresh`, { method: 'POST' });
            expect(response.status).toBe(401);
        });
    });

    test('logout endpoint responds without auth', async () => {
        await withPhase2Server(async (baseUrl) => {
            const response = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
            expect(response.ok).toBe(true);
            const payload = await response.json();
            expect(payload.message).toBe('Logged out');
        });
    });
});

describe('REQUIRE_AUTH production profile', () => {
    test('platform status reports authRequired when REQUIRE_AUTH=true', async () => {
        await withPhase2Server(async (baseUrl) => {
            const platform = await fetch(`${baseUrl}/api/platform/status`).then((r) => r.json());
            expect(platform.authRequired).toBe(true);
        }, {
            REQUIRE_AUTH: 'true',
            JWT_SECRET: TEST_JWT_SECRET,
            JWT_REFRESH_SECRET: TEST_JWT_REFRESH_SECRET
        });
    });

    test('blocks unauthenticated access to protected API routes', async () => {
        await withPhase2Server(async (baseUrl) => {
            const response = await fetch(`${baseUrl}/api/protected/ping`);
            expect(response.status).toBe(401);
            const payload = await response.json();
            expect(payload.error || payload.message).toBeTruthy();
        }, {
            REQUIRE_AUTH: 'true',
            JWT_SECRET: TEST_JWT_SECRET,
            JWT_REFRESH_SECRET: TEST_JWT_REFRESH_SECRET
        });
    });

    test('allows authenticated access to protected API routes', async () => {
        await withPhase2Server(async (baseUrl) => {
            const login = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'dev@simplebeacon.ai', password: 'demo123' })
            }).then((r) => r.json());

            const response = await fetch(`${baseUrl}/api/protected/ping`, {
                headers: { Authorization: `Bearer ${login.token}` }
            });
            expect(response.ok).toBe(true);
            const payload = await response.json();
            expect(payload.ok).toBe(true);
        }, {
            REQUIRE_AUTH: 'true',
            JWT_SECRET: TEST_JWT_SECRET,
            JWT_REFRESH_SECRET: TEST_JWT_REFRESH_SECRET
        });
    });

    test('keeps public platform and health routes reachable without auth', async () => {
        await withPhase2Server(async (baseUrl) => {
            const health = await fetch(`${baseUrl}/api/health`);
            expect(health.ok).toBe(true);

            const platform = await fetch(`${baseUrl}/api/platform/status`);
            expect(platform.ok).toBe(true);

            const login = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'dev@simplebeacon.ai', password: 'demo123' })
            });
            expect(login.ok).toBe(true);
        }, {
            REQUIRE_AUTH: 'true',
            JWT_SECRET: TEST_JWT_SECRET,
            JWT_REFRESH_SECRET: TEST_JWT_REFRESH_SECRET
        });
    });

    test('canonical public-route allowlist under REQUIRE_AUTH=true', async () => {
        await withPhase2Server(async (baseUrl) => {
            const publicGetRoutes = [
                '/api/health',
                '/api/health/db',
                '/api/platform/status',
                '/api/simplebeacon/billing/plan',
                '/api/assessment/health'
            ];

            for (const route of publicGetRoutes) {
                const response = await fetch(`${baseUrl}${route}`);
                expect(response.status).not.toBe(401);
                expect(response.status).not.toBe(403);
            }

            const anonProtected = await fetch(`${baseUrl}/api/protected/ping`);
            expect(anonProtected.status).toBe(401);

            const login = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'dev@simplebeacon.ai', password: 'demo123' })
            }).then((r) => r.json());

            const authProtected = await fetch(`${baseUrl}/api/protected/ping`, {
                headers: { Authorization: `Bearer ${login.token}` }
            });
            expect(authProtected.ok).toBe(true);
        }, {
            REQUIRE_AUTH: 'true',
            JWT_SECRET: TEST_JWT_SECRET,
            JWT_REFRESH_SECRET: TEST_JWT_REFRESH_SECRET
        });
    });

    test('public-route source-of-truth helper classifies routes correctly', () => {
        expect(isPublicApiRoute('health', 'GET')).toBe(true);
        expect(isPublicApiRoute('simplebeacon/billing/plan', 'GET')).toBe(true);
        expect(isPublicApiRoute('simplebeacon/billing/checkout', 'POST')).toBe(true);
        expect(isPublicApiRoute('assessment/health', 'GET')).toBe(true);
        expect(isPublicApiRoute('trust/history', 'GET')).toBe(true);
        expect(isPublicApiRoute('trust/trend', 'GET')).toBe(true);
        expect(isPublicApiRoute('trust/methodology', 'GET')).toBe(true);
        expect(isPublicApiRoute('assessments', 'POST')).toBe(true);
        expect(isPublicApiRoute('analyze/providers', 'GET')).toBe(false);
    });

    test('allows public assessment create without auth when repoUrl provided', async () => {
        await withPhase2Server(async (baseUrl) => {
            const missingRepo = await fetch(`${baseUrl}/api/assessments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company: 'Acme' })
            });
            expect(missingRepo.status).toBe(400);

            const pathOnly = await fetch(`${baseUrl}/api/assessments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectPath: 'C:\\\\temp' })
            });
            expect(pathOnly.status).toBe(403);

            const scanAlias = await fetch(`${baseUrl}/api/assessment/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company: 'Acme' })
            });
            expect(scanAlias.status).toBe(400);

            const health = await fetch(`${baseUrl}/api/assessment/health`);
            expect(health.ok).toBe(true);

            const protectedGet = await fetch(`${baseUrl}/api/assessments/not-an-id`);
            expect(protectedGet.status).toBe(401);
        }, {
            REQUIRE_AUTH: 'true',
            JWT_SECRET: TEST_JWT_SECRET,
            JWT_REFRESH_SECRET: TEST_JWT_REFRESH_SECRET
        });
    });

    test('rejects malformed login payload with 400', async () => {
        await withPhase2Server(async (baseUrl) => {
            const response = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 123, password: null })
            });
            expect(response.status).toBe(400);
            const payload = await response.json();
            expect(payload.error).toBe('Invalid login payload');
        }, {
            REQUIRE_AUTH: 'true',
            JWT_SECRET: TEST_JWT_SECRET,
            JWT_REFRESH_SECRET: TEST_JWT_REFRESH_SECRET
        });
    });

    test('fails fast when REQUIRE_AUTH=true and refresh secret is missing', async () => {
        await expect(withPhase2Server(async () => {}, {
            REQUIRE_AUTH: 'true',
            JWT_SECRET: TEST_JWT_SECRET,
            JWT_REFRESH_SECRET: undefined
        })).rejects.toThrow(/JWT_REFRESH_SECRET/);
    });

    test('applies API security headers in production mode', async () => {
        await withPhase2Server(async (baseUrl) => {
            const response = await fetch(`${baseUrl}/api/health`);
            expect(response.headers.get('x-content-type-options')).toBe('nosniff');
            expect(response.headers.get('x-frame-options')).toBe('DENY');
            expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
            expect(response.headers.get('permissions-policy')).toContain('geolocation=');
            expect(response.headers.get('strict-transport-security')).toContain('max-age=');
        }, {
            NODE_ENV: 'production',
            REQUIRE_AUTH: 'true',
            SEED_DEMO_USERS: 'false',
            JWT_SECRET: TEST_JWT_SECRET,
            JWT_REFRESH_SECRET: TEST_JWT_REFRESH_SECRET
        });
    });

    test('refresh route enforces rate limit headers', async () => {
        await withPhase2Server(async (baseUrl) => {
            const login = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'dev@simplebeacon.ai', password: 'demo123' })
            }).then((r) => r.json());
            const response = await fetch(`${baseUrl}/api/auth/refresh`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${login.token}` }
            });
            expect(response.ok).toBe(true);
            expect(response.headers.get('ratelimit-limit')).toBeTruthy();
        }, {
            REQUIRE_AUTH: 'true',
            SEED_DEMO_USERS: 'false',
            JWT_SECRET: TEST_JWT_SECRET,
            JWT_REFRESH_SECRET: TEST_JWT_REFRESH_SECRET,
            AUTH_REFRESH_RATE_LIMIT_MAX: '2'
        });
    });
});
