#!/usr/bin/env node
/**
 * Deployment guard: smoke-check key public/protected routes after deploy.
 * Exits non-zero on failure.
 */

const DEFAULT_BASE_URL = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:54355';

async function fetchJson(url, options = {}) {
    const res = await fetch(url, options);
    let data = null;
    try {
        data = await res.json();
    } catch {
        data = null;
    }
    return { res, data };
}

async function main() {
    const baseUrl = String(DEFAULT_BASE_URL).replace(/\/$/, '');
    const requireAuth = (process.env.SMOKE_REQUIRE_AUTH || process.env.REQUIRE_AUTH) === 'true';
    const configuredBearer = process.env.SMOKE_BEARER_TOKEN || process.env.SIMPLEBEACON_DASHBOARD_TOKEN || '';
    const failures = [];
    const notes = [];

    async function expectStatus(name, path, expectedStatus, options = {}) {
        try {
            const { res } = await fetchJson(`${baseUrl}${path}`, options);
            if (res.status !== expectedStatus) {
                failures.push(`${name}: expected ${expectedStatus}, got ${res.status}`);
            } else {
                notes.push(`OK ${name} -> ${res.status}`);
            }
        } catch (error) {
            failures.push(`${name}: request failed (${error.message})`);
        }
    }

    // Public routes expected to work without auth.
    await expectStatus('health', '/api/health', 200);
    await expectStatus('platform status', '/api/platform/status', 200);
    await expectStatus('billing plan', '/api/simplebeacon/billing/plan', 200);
    await expectStatus('assessment health', '/api/assessment/health', 200);

    // Protected route: without token should be 401 when REQUIRE_AUTH=true.
    const { res: protectedRes } = await fetchJson(`${baseUrl}/api/analyze/providers`);
    if (requireAuth) {
        if (protectedRes.status !== 401) {
            failures.push(`protected analyze/providers expected 401 without token, got ${protectedRes.status}`);
        } else {
            notes.push('OK protected analyze/providers blocks anonymous access');
        }
    } else {
        notes.push(`INFO REQUIRE_AUTH!=true, analyze/providers returned ${protectedRes.status}`);
    }

    // Login flow for bearer token.
    let token = configuredBearer;
    if (!token) {
        try {
            const email = process.env.SMOKE_LOGIN_EMAIL || 'dev@simplebeacon.ai';
            const password = process.env.SMOKE_LOGIN_PASSWORD || 'demo123';
            const { res, data } = await fetchJson(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            if (!res.ok) {
                if (requireAuth) {
                    failures.push(`login expected 200, got ${res.status}`);
                } else {
                    notes.push(`INFO login skipped (status ${res.status}) while auth gate disabled`);
                }
            } else {
                token = data?.token || '';
                if (!token && requireAuth) {
                    failures.push('login succeeded but token missing in response');
                } else if (token) {
                    notes.push('OK login token acquired');
                }
            }
        } catch (error) {
            if (requireAuth) {
                failures.push(`login request failed (${error.message})`);
            } else {
                notes.push(`INFO login skipped (${error.message}) while auth gate disabled`);
            }
        }
    } else {
        notes.push('OK bearer token provided via environment');
    }

    if (token) {
        await expectStatus('analyze/providers (auth)', '/api/analyze/providers', 200, {
            headers: { Authorization: `Bearer ${token}` }
        });
    } else if (requireAuth) {
        failures.push('auth gate enabled but no bearer token available for protected route check');
    }

    for (const line of notes) {
        console.log(line);
    }

    if (failures.length) {
        console.error('SMOKE SUITE FAILED');
        for (const failure of failures) {
            console.error(` - ${failure}`);
        }
        process.exit(1);
    }

    console.log('SMOKE SUITE PASSED');
}

main().catch((error) => {
    console.error(`SMOKE SUITE FAILED: ${error.message}`);
    process.exit(1);
});
