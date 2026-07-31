import { spawn } from 'node:child_process';
import { request } from 'playwright';
import { setTimeout as delay } from 'node:timers/promises';

const PORT = process.env.PLAYWRIGHT_GATE_PORT || '3000';
const BASE_URL = `http://127.0.0.1:${PORT}`;
const HEALTH_ENDPOINT = `${BASE_URL}/health`;

function startServer() {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT,
    SIMPLEBEACON_LICENSE_SECRET: '',
    JWT_SECRET: 'ci-test-jwt-secret-for-playwright-gate-only',
    JWT_REFRESH_SECRET: 'ci-test-jwt-refresh-secret-for-playwright-gate-only',
    TOKEN_ACCOUNT_SIGNING_KEY: Buffer.from(
      'ci-test-token-account-signing-key-for-playwright-gate-only'
    ).toString('base64'),
  };

  const server = spawn(process.execPath, ['ai-platform/server/index.cjs'], {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  server.stdout.on('data', (chunk) => {
    process.stdout.write(`[server] ${chunk}`);
  });
  server.stderr.on('data', (chunk) => {
    process.stderr.write(`[server] ${chunk}`);
  });

  return server;
}

async function waitForHealth(maxAttempts = 60) {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  try {
    for (let i = 0; i < maxAttempts; i += 1) {
      try {
        const res = await ctx.get('/health', { timeout: 2000 });
        if (res.ok()) return;
      } catch {
        // keep polling
      }
      await delay(1000);
    }
    throw new Error(`Server did not become healthy at ${HEALTH_ENDPOINT}`);
  } finally {
    await ctx.dispose();
  }
}

async function runChecks() {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  try {
    const validateRes = await ctx.post('/api/license/validate', {
      data: { token: 'invalid-token' },
    });
    const validateBody = await validateRes.json();

    if (validateRes.status() !== 503) {
      throw new Error(
        `Expected /api/license/validate status 503 when secret missing, got ${validateRes.status()}`
      );
    }
    if (validateBody.valid !== false || validateBody.active !== false) {
      throw new Error(
        'Expected /api/license/validate to fail closed with valid=false and active=false'
      );
    }

    const statusRes = await ctx.post('/api/auth/token-status', {
      data: { token: 'invalid-token' },
    });
    const statusBody = await statusRes.json();

    if (statusRes.status() !== 503) {
      throw new Error(
        `Expected /api/auth/token-status status 503 when secret missing, got ${statusRes.status()}`
      );
    }
    if (statusBody.valid !== false) {
      throw new Error('Expected /api/auth/token-status to fail closed with valid=false');
    }
  } finally {
    await ctx.dispose();
  }
}

async function main() {
  const server = startServer();
  let exitCode = 0;
  try {
    await waitForHealth();
    await runChecks();
    console.log('Playwright gate checks passed');
  } catch (error) {
    exitCode = 1;
    console.error('Playwright gate checks failed:', error.message);
  } finally {
    if (!server.killed) {
      server.kill('SIGTERM');
    }
  }
  process.exit(exitCode);
}

main();
