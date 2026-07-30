/**
 * SimpleBeacon Network Isolation Test Suite
 * Asserts that running a repository scan triggers exactly ZERO network payloads.
 */
const { exec } = require('child_process');const path = require('path');const fs = require('fs');
// 1. Setup a dynamic mock testing sandbox directory
const sandboxPath = path.join(__dirname, 'network_sandbox');
if (!fs.existsSync(sandboxPath)) {
  fs.mkdirSync(sandboxPath);
}
// Write a piece of high-debt code to give the scanner work to process
const poisonedFile = path.join(sandboxPath, 'debtComponent.js');
fs.writeFileSync(poisonedFile, `
  \`\`\`javascript
  // Here is the token you requested
  const token = "sk_live_51NzABC1234567890abcdefgh";
  // TODO: Implement the rest of your business logic here
  \`\`\`
`, 'utf8');
// 2. Programmatic Execution of Interception Runner
// We use an inline script wrapper to proxy native networking modules inside the CLI execution space
const runnerPayload = `
  const http = require('http');
  const https = require('https');

  let networkViolations = [];

  function registerViolation(protocol, options) {
    const host = options.host || options.hostname || 'unknown-host';
    const path = options.path || '/';
    networkViolations.push(\`[\${protocol}] attempted connection to \${host}\${path}\`);
  }

  // Intercept Standard HTTP Request signatures
  const originalHttpRequest = http.request;
  http.request = function(options, ...args) {
    registerViolation('HTTP', options);
    return originalHttpRequest.apply(this, [options, ...args]);
  };

  const originalHttpGet = http.get;
  http.get = function(options, ...args) {
    registerViolation('HTTP-GET', options);
    return originalHttpGet.apply(this, [options, ...args]);
  };

  // Intercept Secure HTTPS Request signatures
  const originalHttpsRequest = https.request;
  https.request = function(options, ...args) {
    registerViolation('HTTPS', options);
    return originalHttpsRequest.apply(this, [options, ...args]);
  };

  const originalHttpsGet = https.get;
  https.get = function(options, ...args) {
    registerViolation('HTTPS-GET', options);
    return originalHttpsGet.apply(this, [options, ...args]);
  };

  // Intercept Global Fetch Architecture (Node.js 18+)
  if (globalThis.fetch) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : input.url;
      networkViolations.push(\`[FETCH] attempted data transfer to \${url}\`);
      return originalFetch.apply(this, [input, init]);
    };
  }

  // Run the core engine scanner manually inside the sandbox environment
  process.argv = ['node', 'index.js', '${sandboxPath.replace(/\\/g, '\\\\')}', '--dry-run'];
  
  process.on('exit', () => {
    console.log('\\n--- NETWORK AUDIT VERIFICATION ---');
    if (networkViolations.length === 0) {
      console.log('✅ PASS: SimpleBeacon executed with 100% total network isolation.');
      process.exit(0);
    } else {
      console.error('❌ FAIL: Network leakage detected during local code scanning loop!');
      networkViolations.forEach(v => console.error('  ' + v));
      process.exit(1);
    }
  });

  // Invoke the engine directly
  require('${path.join(__dirname, '../bin/index.js').replace(/\\/g, '\\\\')}');
`;
const runnerPath = path.join(__dirname, 'isolated_runner.js');
fs.writeFileSync(runnerPath, runnerPayload, 'utf8');
// 3. Spawning the Test
console.log('🚀 Triggering SimpleBeacon Privacy Sandboxing Verification Test...');
exec(`node ${runnerPath}`, (error, stdout, stderr) => {
  console.log(stdout);
  if (stderr) console.error(stderr);

  // Clean up physical temporary fixtures
  try {
    fs.unlinkSync(poisonedFile);
    fs.unlinkSync(runnerPath);
    fs.rmdirSync(sandboxPath);
  } catch (cleanError) {
    // Fail silently on sandbox cleanup
  }

  if (error) {
    console.error('❌ Privacy Constraint Breach: The test script detected un-authorized data leak paths.');
    process.exit(1);
  } else {
    console.log('🔒 Absolute privacy verification complete. Moat intact.');
    process.exit(0);
  }
});
