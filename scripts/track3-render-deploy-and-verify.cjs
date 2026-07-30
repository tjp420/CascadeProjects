#!/usr/bin/env node
// scripts/track3-render-deploy-and-verify.cjs
// Trigger a Render deploy hook, then run the CORS/health end-to-end sweep.
// Usage:
//   RENDER_DEPLOY_HOOK=https://api.render.com/deploy/... node scripts/track3-render-deploy-and-verify.cjs
'use strict';

const https = require('https');

const PUBLIC_URL = process.env.PUBLIC_URL || 'https://simplebeacon.onrender.com';
const DEPLOY_HOOK = process.env.RENDER_DEPLOY_HOOK;
const SKIP_DEPLOY = process.env.SKIP_DEPLOY === 'true';
const HEALTH_PATH = process.env.HEALTH_PATH || '/health';
const MAX_HEALTH_RETRIES = Number(process.env.MAX_HEALTH_RETRIES || 30);
const HEALTH_RETRY_MS = Number(process.env.HEALTH_RETRY_MS || 5000);

async function request(method, urlStr, headers = {}) {
  const res = await fetch(urlStr, { method, headers });
  const body = await res.text();
  const h = {};
  res.headers.forEach((value, key) => { h[key.toLowerCase()] = value; });
  return { status: res.status, headers: h, body };
}

async function triggerDeploy() {
  if (!DEPLOY_HOOK) {
    throw new Error('RENDER_DEPLOY_HOOK is not set. Set it to the Render deploy hook URL or trigger the deploy manually.');
  }
  console.log(`▶ Triggering Render deploy hook: ${DEPLOY_HOOK.replace(/\/[^/]+$/, '/...')}`);
  const { status, headers } = await request('POST', DEPLOY_HOOK);
  console.log(`  Hook responded ${status}`);
  if (status < 200 || status >= 300) {
    throw new Error(`Deploy hook returned ${status}`);
  }
  console.log('✅ Deploy hook accepted.');
}

async function waitForHealth() {
  const url = `${PUBLIC_URL}${HEALTH_PATH}`;
  for (let i = 0; i < MAX_HEALTH_RETRIES; i++) {
    try {
      const { status, body } = await request('GET', url);
      if (status === 200) {
        console.log(`✅ Health check passed: ${url} -> 200`);
        return body;
      }
      console.log(`  Health check attempt ${i + 1}: ${status}`);
    } catch (err) {
      console.log(`  Health check attempt ${i + 1}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, HEALTH_RETRY_MS));
  }
  throw new Error(`Health check did not pass after ${MAX_HEALTH_RETRIES * HEALTH_RETRY_MS / 1000}s`);
}

async function verifyCors() {
  const allowedOrigin = 'https://foo.simplebeacon.pages.dev';
  const forbiddenOrigin = 'https://evil.example.com';

  console.log('▶ Verifying CORS preflight for allowed wildcard origin...');
  const preflight = await request('OPTIONS', `${PUBLIC_URL}${HEALTH_PATH}`, {
    Origin: allowedOrigin,
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'Content-Type'
  });
  if (preflight.status !== 204 && preflight.status !== 200) {
    throw new Error(`Preflight returned ${preflight.status}`);
  }
  if (preflight.headers['access-control-allow-origin'] !== allowedOrigin) {
    throw new Error(`Expected Access-Control-Allow-Origin: ${allowedOrigin}, got ${preflight.headers['access-control-allow-origin']}`);
  }
  const vary = (preflight.headers['vary'] || '').toLowerCase();
  if (!vary.includes('origin')) {
    throw new Error(`Expected Vary to include Origin, got ${preflight.headers['vary']}`);
  }
  console.log('✅ Allowed origin preflight passed.');

  console.log('▶ Verifying CORS rejection for forbidden origin...');
  const forbidden = await request('GET', `${PUBLIC_URL}${HEALTH_PATH}`, { Origin: forbiddenOrigin });
  if (forbidden.headers['access-control-allow-origin'] === forbiddenOrigin) {
    throw new Error(`Forbidden origin was unexpectedly allowed: ${forbiddenOrigin}`);
  }
  console.log('✅ Forbidden origin correctly rejected.');
}

async function main() {
  console.log('Track 3: Render deploy and end-to-end verification\n');
  if (SKIP_DEPLOY) {
    console.log('SKIP_DEPLOY=true — skipping webhook trigger, polling existing deployment\n');
  } else {
    await triggerDeploy();
  }
  await waitForHealth();
  await verifyCors();
  console.log('\n🎉 Track 3 e2e verification passed.');
}

main().catch((err) => {
  const msg = `\n❌ Track 3 failed: ${err.message}\n`;
  process.stderr.write(msg, () => process.exit(1));
});
