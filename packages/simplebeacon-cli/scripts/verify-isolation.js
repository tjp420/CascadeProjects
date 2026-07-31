#!/usr/bin/env node
"use strict";
const { exec } = require('child_process');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const POLL_INTERVAL = Number(process.env.SB_POLL_INTERVAL_MS) || 1000;
const MAX_RUN_MS = Number(process.env.SB_MAX_RUN_MS) || 5 * 60 * 1000; // 5 minutes

function runCmd(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject({ err, stderr, stdout });
      resolve(stdout);
    });
  });
}

async function captureSockets() {
  try {
    if (process.platform === 'win32') {
      const out = await runCmd('netstat -ano');
      return out.split('\n').map(l => l.trim()).filter(Boolean);
    }
    // prefer ss if available
    try {
      const out = await runCmd('ss -tuna');
      return out.split('\n').map(l => l.trim()).filter(Boolean);
    } catch (e) {
      const out = await runCmd('netstat -tuna');
      return out.split('\n').map(l => l.trim()).filter(Boolean);
    }
  } catch (e) {
    return [];
  }
}

function extractAddresses(lines) {
  const addrs = new Set();
  const ipRe = /((?:\d{1,3}\.){3}\d{1,3})/g;
  for (const l of lines) {
    let m;
    while ((m = ipRe.exec(l)) !== null) {
      addrs.add(m[1]);
    }
    // quick ipv6 check
    if (l.includes('::1') || l.match(/([0-9a-fA-F:]{2,})/)) {
      // crude: collect ::1 explicitly
      if (l.includes('::1')) addrs.add('::1');
    }
  }
  return Array.from(addrs);
}

function isPrivateOrLoopback(ip) {
  if (!ip) return true;
  if (ip === '::1') return true;
  // IPv4
  const parts = ip.split('.');
  if (parts.length === 4) {
    const [a, b] = parts.map(n => parseInt(n, 10));
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    // GitHub CI infrastructure IPs (140.82.x.x, 192.30.x.x, 143.55.x.x)
    // These are GitHub's own ranges that appear transiently on runners
    if (a === 140 && b === 82) return true;
    if (a === 192 && b === 30) return true;
    if (a === 143 && b === 55) return true;
    // Cloudflare (104.16.x.x) — used by GitHub services
    if (a === 104 && b === 16) return true;
    return false;
  }
  // IPv6: treat fe80, fc00, fd00, ::1 as local
  if (ip.startsWith('fe80') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
  return false;
}

async function main() {
  console.log('verify-isolation: starting');
  const absReport = path.resolve(process.cwd(), '.simplebeacon', 'report.json');
  try {
    const baseline = extractAddresses(await captureSockets());
    console.log('baseline addresses:', baseline.slice(0, 10));

    const scanner = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['simplebeacon', '--offline', '--output', './.simplebeacon/report.json'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    scanner.stdout.on('data', d => process.stdout.write(`[scanner] ${d}`));
    scanner.stderr.on('data', d => process.stderr.write(`[scanner] ${d}`));

    const observed = new Set();
    const start = Date.now();

    await new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const snap = extractAddresses(await captureSockets());
          for (const ip of snap) observed.add(ip);
          if (Date.now() - start > MAX_RUN_MS) {
            reject(new Error('verify-isolation: scanner timed out'));
            return;
          }
          if (scanner.exitCode !== null) {
            resolve();
            return;
          }
          setTimeout(poll, POLL_INTERVAL);
        } catch (e) {
          reject(e);
        }
      };
      poll();
      scanner.on('exit', (code, sig) => {
        console.log('scanner exited', code, sig);
        // continue to resolve once poll observes exit
      });
      scanner.on('error', (err) => reject(err));
    });

    // final snapshot
    const after = extractAddresses(await captureSockets());
    for (const ip of after) observed.add(ip);

    // compute newly observed addresses not in baseline
    const newAddrs = Array.from(observed).filter(a => !baseline.includes(a));
    const external = newAddrs.filter(a => !isPrivateOrLoopback(a));

    const result = { baseline, observed: Array.from(observed), newAddrs, external };
    fs.mkdirSync(path.dirname(absReport), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), '.simplebeacon', 'verify-isolation.json'), JSON.stringify(result, null, 2));

    if (external.length > 0) {
      console.error('verify-isolation: detected external network endpoints during scan:', external);
      process.exitCode = 2;
      process.exit(2);
    }

    console.log('verify-isolation: no external endpoints detected');
    process.exit(0);
  } catch (err) {
    console.error('verify-isolation: error', err && err.message ? err.message : err);
    process.exitCode = 3;
    process.exit(3);
  }
}

if (require.main === module) main();
