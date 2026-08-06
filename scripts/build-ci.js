#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

const runs = [
  { cwd: process.cwd(), name: 'root' },
  { cwd: path.join(process.cwd(), 'ai-platform'), name: 'ai-platform' },
  { cwd: path.join(process.cwd(), 'simplebeacon-vscode-merged', 'dashboard-web'), name: 'vscode-dashboard' }
];

function runBuild(target) {
  console.log(`\n> Building ${target.name} (cwd=${target.cwd})`);
  const env = { ...process.env, NODE_ENV: 'production', VITE_SOURCEMAP: 'false' };
  const res = spawnSync('npx', ['vite', 'build'], { cwd: target.cwd, env, stdio: 'inherit', shell: true });
  if (res.status !== 0) throw new Error(`Build failed for ${target.name}`);
}

(async () => {
  try {
    for (const t of runs) {
      // skip non-existent directories
      try { require('fs').accessSync(t.cwd); } catch (e) { console.warn('Skipping missing path', t.cwd); continue; }
      runBuild(t);
    }
    console.log('\nAll builds completed successfully');
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
})();
