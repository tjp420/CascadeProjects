#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

const runs = [
  { cwd: process.cwd(), name: 'root' },
  { cwd: path.join(process.cwd(), 'ai-platform'), name: 'ai-platform' },
  // vscode-dashboard build skipped in CI — it requires @vitejs/plugin-react which
  // has peer dependency conflicts with vite 8 and needs its own npm install.
  // The dashboard-web build is validated separately in the VS Code extension workflow.
];

function runBuild(target) {
  console.log(`\n> Building ${target.name} (cwd=${target.cwd})`);
  const env = { ...process.env, NODE_ENV: 'production', VITE_SOURCEMAP: 'false' };
  const start = Date.now();
  const res = spawnSync('npx', ['vite', 'build'], { cwd: target.cwd, env, stdio: 'inherit', shell: true });
  const end = Date.now();
  const durationMs = end - start;
  if (res.status !== 0) throw new Error(`Build failed for ${target.name}`);
  return { name: target.name, cwd: target.cwd, durationMs };
}

(async () => {
  const results = [];
  try {
    let totalMs = 0;
    for (const t of runs) {
      // skip non-existent directories
      try { require('fs').accessSync(t.cwd); } catch (e) { console.warn('Skipping missing path', t.cwd); continue; }
      const r = runBuild(t);
      results.push(r);
      totalMs += r.durationMs;
    }
    console.log('\nAll builds completed successfully');
    // write summary
    try {
      const outDir = require('path').join(process.cwd(), '.simplebeacon');
      if (!require('fs').existsSync(outDir)) require('fs').mkdirSync(outDir, { recursive: true });
      const outFile = require('path').join(outDir, 'build-benchmark.json');
      const summary = { generatedAt: new Date().toISOString(), totalMs, targets: results };
      require('fs').writeFileSync(outFile, JSON.stringify(summary, null, 2));
      console.log('Wrote build benchmark to', outFile);
      // also print a table
      console.log('\nBuild benchmark summary:');
      results.forEach(r => console.log(` - ${r.name}: ${r.durationMs}ms`));
      console.log(` Total: ${totalMs}ms`);
    } catch (e) {
      console.warn('Failed to write build benchmark:', e.message);
    }
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    // attempt to write partial results
    try {
      const outDir = require('path').join(process.cwd(), '.simplebeacon');
      if (!require('fs').existsSync(outDir)) require('fs').mkdirSync(outDir, { recursive: true });
      const outFile = require('path').join(outDir, 'build-benchmark.json');
      const summary = { generatedAt: new Date().toISOString(), totalMs: results.reduce((s, x) => s + (x.durationMs||0), 0), targets: results };
      require('fs').writeFileSync(outFile, JSON.stringify(summary, null, 2));
    } catch (e) { /* ignore */ }
    process.exit(2);
  }
})();
