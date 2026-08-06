#!/usr/bin/env node
const { spawn, execSync } = require('child_process');
const path = require('path');

const BACKEND_PORT = process.env.BACKEND_PORT || '59277';
const PROXY_PORT = process.env.JITTER_PROXY_PORT || '59278';

console.log('🔄 Preparing SimpleBeacon Network Jitter Dev Environment...');

// Cross-platform cleanup for leftover processes on our proxy port
try {
  if (process.platform === 'win32') {
    try {
      execSync(`powershell -Command "Get-NetTCPConnection -LocalPort ${PROXY_PORT} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"`, { stdio: 'ignore' });
      console.log(`🧹 Cleared legacy bindings on proxy port ${PROXY_PORT}.`);
    } catch (_) {
      // ignore
    }
  } else {
    try {
      execSync(`lsof -t -i:${PROXY_PORT} | xargs -r kill -9`, { stdio: 'ignore' });
      console.log(`🧹 Cleared legacy bindings on proxy port ${PROXY_PORT}.`);
    } catch (_) {
      // ignore
    }
  }
} catch (e) {
  // best-effort cleanup; continue
}

// 1. Launch the Network Jitter Proxy background process
const proxyPath = path.join(__dirname, 'network-jitter-proxy.js');
const proxyProcess = spawn(process.execPath, [proxyPath], {
  env: { ...process.env, VITE_API_PORT: BACKEND_PORT, JITTER_PROXY_PORT: PROXY_PORT },
  stdio: 'inherit'
});

// 2. Launch the Vite Development Server routed through our proxy link
const webDir = path.join(__dirname, '..', 'ai-platform', 'web', 'simplebeacon-dashboard');
const viteProcess = spawn('npm', ['run', 'dev'], {
  cwd: webDir,
  env: { ...process.env, VITE_API_PORT: PROXY_PORT },
  stdio: 'inherit',
  shell: true
});

// Safeguard child lifetimes by cleaning up processes when the host terminal drops
const cleanExit = () => {
  console.log('\n🛑 Shutting down network jitter harness threads...');
  try { proxyProcess.kill(); } catch (e) { }
  try { viteProcess.kill(); } catch (e) { }
  process.exit();
};

process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);

// Relay child exit codes
proxyProcess.on('exit', (code) => {
  console.log(`proxy process exited with ${code}`);
});
viteProcess.on('exit', (code) => {
  console.log(`vite process exited with ${code}`);
  // if vite stops, also stop proxy
  try { proxyProcess.kill(); } catch (e) { }
  process.exit(code || 0);
});
