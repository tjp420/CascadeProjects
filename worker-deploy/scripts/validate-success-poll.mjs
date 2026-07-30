#!/usr/bin/env node

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = next;
    i++;
  }
  return args;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodePayloadTier(license) {
  const parts = String(license || '').split('.');
  if (parts.length < 2) return 'unknown';
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    return payload.tier || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sessionId = args.session || args.session_id || '';
  if (!sessionId) {
    throw new Error('Missing --session argument. Example: --session cs_test_123');
  }

  const baseUrl = (args.base || process.env.WORKER_BASE_URL || 'https://simplebeacon.ai').replace(/\/$/, '');
  const origin = args.origin || process.env.WORKER_ALLOWED_ORIGIN || 'https://simplebeacon.ai';
  const attempts = Number(args.attempts || 60);
  const intervalMs = Number(args.interval || 2000);
  const endpoint = `${baseUrl}/api/license?session_id=${encodeURIComponent(sessionId)}`;

  for (let i = 1; i <= attempts; i++) {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Origin: origin
      }
    });

    if (response.status === 404) {
      await wait(intervalMs);
      continue;
    }

    let body = null;
    try {
      body = await response.json();
    } catch {
      body = { raw: await response.text() };
    }

    if (!response.ok) {
      throw new Error(`License endpoint failed (${response.status}): ${JSON.stringify(body)}`);
    }

    if (!body.license) {
      throw new Error(`License endpoint returned success without token: ${JSON.stringify(body)}`);
    }

    const summary = {
      ok: true,
      baseUrl,
      sessionId,
      status: body.status,
      tier: body.tier || decodePayloadTier(body.license)
    };

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }

  throw new Error(`No token found for session ${sessionId} after ${attempts} attempts.`);
}

main().catch((err) => {
  process.stderr.write(`[validate-success-poll] ${err.message}\n`);
  process.exit(1);
});
