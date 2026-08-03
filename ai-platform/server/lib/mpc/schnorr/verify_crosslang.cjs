const { spawnSync } = require('child_process');
const { JcsCanonicalizer } = require('./jcs.cjs');

const jcs = new JcsCanonicalizer();

const samples = [
  { s: 'A\u030A' },
  { alpha: 1, beta: 2 },
  { n: 1.2345e20 },
  { n: -0 },
  { arr: ["e\u0301", "é"] }
];

function runBinary(path, input) {
  try {
    const proc = spawnSync(path, { input: JSON.stringify(input), encoding: 'utf8' });
    if (proc.error) throw proc.error;
    if (proc.status !== 0) throw new Error(`exit ${proc.status}: ${proc.stderr}`);
    // read first line of stdout as canonical output
    const out = (proc.stdout || '').trim().split(/\r?\n/)[0] || '';
    return out;
  } catch (e) {
    throw new Error(`failed to run ${path}: ${e.message}`);
  }
}

function run() {
  // Use `go run` to ensure the source in the repo is executed (avoids stale binaries)
  const goPath = 'go';
  const rustPath = './ai-platform/server/lib/mpc/schnorr/reference-runner-rust/target/release/reference-runner-rust';

  for (const s of samples) {
    const jsCanon = jcs.canonicalize(s);

    let goCanon = null;
    try {
      // run 'go run main.go' in the Go runner directory
      const proc = spawnSync(goPath, ['run', 'ai-platform/server/lib/mpc/schnorr/reference-runner-go/main.go'], { input: JSON.stringify(s), encoding: 'utf8' });
      if (proc.error) throw proc.error;
      if (proc.status !== 0) throw new Error(`exit ${proc.status}: ${proc.stderr}`);
      goCanon = (proc.stdout || '').trim().split(/\r?\n/)[0] || '';
    } catch (e) {
      console.error(e.message);
      process.exitCode = 2;
      return;
    }

    let rustCanon = null;
    try {
      rustCanon = runBinary(rustPath, s);
    } catch (e) {
      console.error(e.message);
      process.exitCode = 3;
      return;
    }

    if (jsCanon !== goCanon || jsCanon !== rustCanon) {
      console.error('Mismatch for sample:', JSON.stringify(s));
      console.error('JS   ->', jsCanon);
      console.error('Go   ->', goCanon);
      console.error('Rust ->', rustCanon);
      process.exit(1);
    } else {
      console.log('OK:', jsCanon);
    }
  }
  console.log('All parity checks passed');
}

run();
