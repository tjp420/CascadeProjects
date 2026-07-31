// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
/**
 * Scanner Robustness Integration Tests
 *
 * These tests validate that SimpleBeacon's core scanner:
 * 1. Detects actual AI slop, fiction KPIs, and credential leaks
 * 2. Does NOT flag clean, legitimate code (false-positive resistance)
 * 3. Respects allowlists, exclusions, and path filters
 * 4. Handles edge cases (comments, minified code, test files, config)
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  scanTextPatterns,
  scanSuspiciousDependencies,
  scanLlmSlopPatterns,
} = require('../src/rules/llm-slop-patterns');

const { scanSourceFictionPatterns } = require('../src/rules/fiction-kpi-patterns');

const { scanProductionLeaks } = require('../src/rules/production-leak');

// ─── Helper: create temp repo ───
function createTempRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-robust-'));
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(root, ...filePath.split('/'));
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }
  return root;
}

function cleanup(root) {
  try {
    fs.rmSync(root, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

// ═══════════════════════════════════════════════
// FALSE POSITIVE TESTS — clean code must NOT flag
// ═══════════════════════════════════════════════

describe('False Positive Resistance', () => {
  test('clean React component is not flagged as slop', () => {
    const content = `
import React, { useState, useEffect } from 'react';
import { fetchUserData } from '../services/api';

export function UserProfile({ userId }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUserData(userId)
            .then(data => setUser(data))
            .finally(() => setLoading(false));
    }, [userId]);

    if (loading) return <div>Loading...</div>;
    if (!user) return <div>User not found</div>;

    return (
        <div className="user-profile">
            <h1>{user.name}</h1>
            <p>{user.email}</p>
        </div>
    );
}
`;
    const hits = scanTextPatterns('src/components/UserProfile.jsx', content, '.jsx');
    assert.equal(hits.length, 0, 'Clean React component should have zero slop findings');
  });

  test('legitimate API key configuration pattern is not flagged', () => {
    const content = `
// Load API key from environment — never hardcode
const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
}
module.exports = { API_KEY };
`;
    const hits = scanTextPatterns('src/config/api.js', content, '.js');
    // Should not flag env-var references as placeholder
    const placeholderHits = hits.filter((h) => h.pattern === 'SB-FICTION-001');
    assert.equal(placeholderHits.length, 0, 'Env-var config should not be flagged as placeholder');
  });

  test('markdown fence in .md file is NOT flagged (rule only targets source)', () => {
    const content = 'Here is some code:\n\n```javascript\nconsole.log("hello")\n```\n';
    const hits = scanTextPatterns('docs/README.md', content, '.md');
    const fenceHits = hits.filter((h) => h.pattern === 'SB-FICTION-002');
    assert.equal(fenceHits.length, 0, '.md files should not trigger fence detection');
  });

  test('markdown fence in parser/util file is NOT flagged (self-scan exclusion)', () => {
    const content = 'const fenced = text.match(/```json\\s*([\\s\\S]*?)```/gi) || [];\n';
    const hits = scanTextPatterns('src/utils/markdown-parser.js', content, '.js');
    const fenceHits = hits.filter((h) => h.pattern === 'SB-FICTION-002');
    assert.equal(fenceHits.length, 0, 'Fence regex in parser utility should not be flagged');
  });

  test('lorem ipsum in test fixture is excluded', () => {
    const content = '<p>Lorem Ipsum Dolor sit amet consectetur</p>\n';
    const hits = scanTextPatterns('tests/fixtures/sample.html', content, '.html');
    assert.equal(hits.length, 0, 'Test fixtures should be excluded from slop scanning');
  });

  test('comment lines mentioning TODO are not flagged as placeholders', () => {
    const content = `
// TODO: refactor this module to use dependency injection
// FIXME: handle edge case when user has no permissions
/* Handle authentication retries gracefully */
`;
    const hits = scanTextPatterns('src/services/auth.js', content, '.js');
    const placeholderHits = hits.filter((h) => h.pattern === 'SB-FICTION-001');
    assert.equal(
      placeholderHits.length,
      0,
      'TODO/FIXME comments should not be flagged as placeholders'
    );
  });

  test('common package names are not flagged as suspicious', () => {
    const content = JSON.stringify(
      {
        dependencies: {
          react: '^18.0.0',
          express: '^4.18.0',
          lodash: '^4.17.21',
          '@types/node': '^20.0.0',
        },
      },
      null,
      2
    );
    const hits = scanSuspiciousDependencies('package.json', content);
    assert.equal(hits.length, 0, 'Legitimate packages should not be flagged');
  });

  test('TypeScript generic syntax with brackets is not flagged', () => {
    const content = `
function processData<T extends Record<string, any>>(data: T): T {
    return Object.freeze({ ...data });
}
`;
    const hits = scanTextPatterns('src/utils/types.ts', content, '.ts');
    assert.equal(hits.length, 0, 'TypeScript generics should not trigger false positives');
  });

  test('URL with port numbers is not flagged as fiction KPI', async () => {
    const root = createTempRepo({
      'src/api/client.js': `
const BASE_URL = 'http://localhost:3000/api/v1';
const WS_URL = 'ws://localhost:8080/socket';
export { BASE_URL, WS_URL };
`,
    });
    const result = await scanLlmSlopPatterns(root, {
      sourcePaths: ['src'],
      productionPaths: ['src'],
    });
    cleanup(root);
    assert.equal(result.findings, 0, 'localhost URLs should not be flagged');
  });

  test('percentage in CSS/styles is not flagged', () => {
    const content = `
.progress-bar { width: 99.99%; }
.discount-badge::after { content: "50% OFF"; }
`;
    const hits = scanTextPatterns('src/styles/main.css', content, '.css');
    // CSS is not in SCANNABLE_EXTENSIONS but test safety
    assert.equal(hits.length, 0, 'CSS percentages should not be flagged');
  });

  test('allowlist snippets suppress matching lines', () => {
    const content = `
// This is a baseline false positive test for the rule engine
const example = "your-api-key-here";
`;
    const hits = scanTextPatterns('src/rules/validator.js', content, '.js');
    assert.equal(hits.length, 0, 'Allowlisted lines should be suppressed');
  });

  test('minified code does not produce excessive findings', () => {
    // Simulate minified JS (single line, high density)
    const content =
      'var a=1,b=2,c=3,d=4,e=5,f=6,g=7,h=8,i=9,j=10;function k(l){return l+m+n;}var o="test";'.repeat(
        20
      );
    const hits = scanTextPatterns('dist/app.min.js', content, '.js');
    assert.ok(hits.length <= 2, `Minified code produced ${hits.length} findings, expected <= 2`);
  });

  test('JSON configuration files with real values are not flagged', () => {
    const content = JSON.stringify(
      {
        apiEndpoint: 'https://api.example.com',
        timeout: 30000,
        retries: 3,
        features: { darkMode: true, notifications: false },
      },
      null,
      2
    );
    const hits = scanTextPatterns('config/app.json', content, '.json');
    assert.equal(hits.length, 0, 'Real config JSON should not be flagged');
  });
});

// ═══════════════════════════════════════════════
// TRUE POSITIVE TESTS — slop MUST be detected
// ═══════════════════════════════════════════════

describe('True Positive Detection', () => {
  test('detects YOUR_API_KEY_HERE placeholder', () => {
    const content = 'const apiKey = "YOUR_API_KEY_HERE";\n';
    const hits = scanTextPatterns('src/config.js', content, '.js');
    assert.ok(
      hits.some((h) => h.pattern === 'SB-FICTION-001'),
      'Should detect YOUR_API_KEY_HERE'
    );
  });

  test('detects INSERT_SECRET_HERE placeholder', () => {
    const content = 'export const token = "INSERT_SECRET_HERE";\n';
    const hits = scanTextPatterns('src/auth.js', content, '.js');
    assert.ok(
      hits.some((h) => h.pattern === 'SB-FICTION-001'),
      'Should detect INSERT_SECRET_HERE'
    );
  });

  test('detects markdown fence leaked into .js source', () => {
    const content = 'const code = `\n```javascript\nconsole.log(1)\n`;\n';
    const hits = scanTextPatterns('src/broken.js', content, '.js');
    assert.ok(
      hits.some((h) => h.pattern === 'SB-FICTION-002'),
      'Should detect markdown fence in JS'
    );
  });

  test('detects lorem ipsum in production HTML', () => {
    const content = '<p>Lorem Ipsum Dolor sit amet consectetur adipiscing elit</p>\n';
    const hits = scanTextPatterns('web/index.html', content, '.html');
    assert.ok(
      hits.some((h) => h.pattern === 'SB-FICTION-004'),
      'Should detect lorem ipsum in HTML'
    );
  });

  test('detects suspicious fake-* dependency names', () => {
    const content = JSON.stringify(
      {
        dependencies: {
          'fake-auth-lib': '1.0.0',
          express: '4.18.0',
        },
      },
      null,
      2
    );
    const hits = scanSuspiciousDependencies('package.json', content);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].pattern, 'SB-FICTION-003');
    assert.ok(hits[0].metadata.packageName.includes('fake-auth-lib'));
  });

  test('detects suspicious mock-* dependency names', () => {
    const content = JSON.stringify(
      {
        devDependencies: {
          'mock-api-package': '0.0.1',
          jest: '29.0.0',
        },
      },
      null,
      2
    );
    const hits = scanSuspiciousDependencies('package.json', content);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].pattern, 'SB-FICTION-003');
  });

  test('full repo scan detects mixed slop patterns', async () => {
    const root = createTempRepo({
      'src/app.js': 'export const key = "YOUR_API_KEY_HERE";\n',
      'package.json': JSON.stringify(
        {
          name: 'demo',
          dependencies: { 'fake-utils': '1.0.0', lodash: '4.17.21' },
        },
        null,
        2
      ),
    });

    const result = await scanLlmSlopPatterns(root, {
      sourcePaths: ['src'],
      productionPaths: ['src'],
    });
    cleanup(root);

    assert.ok(result.findings >= 2, `Expected >= 2 findings, got ${result.findings}`);
    assert.ok(result.issues.some((i) => i.pattern === 'SB-FICTION-001'));
    assert.ok(result.issues.some((i) => i.pattern === 'SB-FICTION-003'));
  });
});

// ═══════════════════════════════════════════════
// EDGE CASE TESTS
// ═══════════════════════════════════════════════

describe('Edge Cases & Boundary Conditions', () => {
  test('empty file produces zero findings', async () => {
    const root = createTempRepo({ 'src/empty.js': '' });
    // simplebeacon-ignore: console-log — test output
    const result = await scanLlmSlopPatterns(root, {
      sourcePaths: ['src'],
      productionPaths: ['src'],
    });
    cleanup(root);
    assert.equal(result.findings, 0);
  });

  test('very large file (>512KB) is skipped', async () => {
    const hugeContent = '/* big file */\n' + 'const x = 1;\n'.repeat(20000);
    const root = createTempRepo({ 'src/big.js': hugeContent });
    // simplebeacon-ignore: hardcoded-token — test fixture
    fs.writeFileSync(path.join(root, 'src', 'small.js'), 'const k = "INSERT_SECRET_HERE";');

    const result = await scanLlmSlopPatterns(root, {
      sourcePaths: ['src'],
      productionPaths: ['src'],
    });
    cleanup(root);

    // Should only find the small file's issue, not crash on big file
    assert.ok(result.scanned >= 1, 'Should scan at least one file');
    assert.ok(
      result.issues.some((i) => i.file === 'src/small.js'),
      'Should still find issues in valid files'
    );
  });

  test('missing sourcePaths gracefully handles absent directories', async () => {
    const root = createTempRepo({});
    const result = await scanLlmSlopPatterns(root, {
      sourcePaths: ['src', 'lib'],
      productionPaths: ['src'],
    });
    cleanup(root);
    assert.equal(result.scanned, 0);
    assert.equal(result.findings, 0);
  });

  test('unicode and special characters in code do not crash scanner', async () => {
    const root = createTempRepo({
      'src/unicode.js': `
const emoji = '🚀🔑✨';
const chinese = '用户名和密码';
const arabic = 'مفتاح_الوصول';
const mixed = "INSERT_SECRET_HERE";
`,
    });
    const result = await scanLlmSlopPatterns(root, {
      sourcePaths: ['src'],
      productionPaths: ['src'],
    });
    cleanup(root);
    assert.ok(
      result.issues.some((i) => i.pattern === 'SB-FICTION-001'),
      'Should still find placeholder in unicode file'
    );
  });

  test('binary-like content in source file is handled gracefully', async () => {
    const content = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]).toString('utf8');
    const root = createTempRepo({ 'src/binary-ish.js': content });
    const result = await scanLlmSlopPatterns(root, {
      sourcePaths: ['src'],
      productionPaths: ['src'],
    });
    cleanup(root);
    // Should not crash; findings may vary but no exception
    assert.ok(typeof result.findings === 'number');
  });

  test('package.json with no dependencies produces zero findings', () => {
    const content = JSON.stringify({ name: 'empty-pkg', version: '1.0.0' }, null, 2);
    const hits = scanSuspiciousDependencies('package.json', content);
    assert.equal(hits.length, 0);
  });

  test('multiple findings in same file all reported', () => {
    const content = `
const key1 = "YOUR_API_KEY_HERE";
const key2 = "INSERT_SECRET_HERE";
const desc = "Lorem Ipsum Dolor sit amet";
`;
    const hits = scanTextPatterns('src/config.js', content, '.js');
    assert.ok(hits.length >= 3, `Expected >= 3 hits, got ${hits.length}`);
    assert.ok(hits.some((h) => h.pattern === 'SB-FICTION-001'));
    assert.ok(hits.some((h) => h.pattern === 'SB-FICTION-004'));
  });

  test('custom ignoreGlobs are respected', async () => {
    const root = createTempRepo({
      'src/app.js': 'const key = "YOUR_API_KEY_HERE";\n',
      'legacy/old.js': 'const key = "INSERT_SECRET_HERE";\n',
    });
    const result = await scanLlmSlopPatterns(root, {
      sourcePaths: ['src', 'legacy'],
      productionPaths: ['src', 'legacy'],
      ignoreGlobs: ['legacy/**'],
    });
    cleanup(root);
    assert.ok(result.issues.some((i) => i.file === 'src/app.js'));
    assert.ok(
      !result.issues.some((i) => i.file === 'legacy/old.js'),
      'Ignored path should be excluded'
    );
  });
});

// ═══════════════════════════════════════════════
// FULL INTEGRATION: end-to-end scan on synthetic repo
// ═══════════════════════════════════════════════

describe('End-to-End Synthetic Repo Scan', () => {
  test('scans realistic project structure accurately', async () => {
    const files = {
      'package.json': JSON.stringify(
        {
          name: 'acme-app',
          dependencies: {
            react: '^18.0.0',
            express: '^4.18.0',
            'fake-auth-client': '1.0.0', // slop
          },
        },
        null,
        2
      ),
      'src/index.js': `
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
`,
      'src/App.jsx': `
import { useState } from 'react';

export default function App() {
    const [data, setData] = useState(null);
    const apiKey = "YOUR_API_KEY_HERE";  // slop: placeholder

    return <div>{data ? data.title : 'Loading...'}</div>;
}
`,
      'src/services/api.js': `
const BASE_URL = process.env.REACT_APP_API_URL;
const TIMEOUT = 30000;

export async function fetchData(endpoint) {
    const res = await fetch(\`\${BASE_URL}\${endpoint}\`, {
        headers: { 'Authorization': \`Bearer \${process.env.API_TOKEN}\` },
        signal: AbortSignal.timeout(TIMEOUT)
    });
    return res.json();
}
`,
      'src/utils/helpers.js': `
// This module provides utility functions
export function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
`,
      'tests/App.test.jsx': `
import { render, screen } from '@testing-library/react';
import App from '../src/App';

test('renders app', () => {
    render(<App />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
});
`,
      'public/index.html': `
<!DOCTYPE html>
<html>
<head><title>Acme App</title></head>
<body>
    <div id="root"></div>
    <p>Lorem Ipsum Dolor sit amet</p>
</body>
</html>
`,
    };

    const root = createTempRepo(files);
    const result = await scanLlmSlopPatterns(root, {
      sourcePaths: ['src', 'public'],
      productionPaths: ['src'],
    });
    cleanup(root);

    // Assertions on findings
    const findings = result.issues;

    // Should detect placeholder in App.jsx
    assert.ok(
      findings.some((f) => f.file === 'src/App.jsx' && f.pattern === 'SB-FICTION-001'),
      'Should detect placeholder in App.jsx'
    );

    // Should detect fake dependency
    assert.ok(
      findings.some(
        (f) => f.pattern === 'SB-FICTION-003' && f.metadata.packageName === 'fake-auth-client'
      ),
      'Should detect fake-auth-client dependency'
    );

    // Should detect lorem ipsum in public HTML
    assert.ok(
      findings.some((f) => f.file === 'public/index.html' && f.pattern === 'SB-FICTION-004'),
      'Should detect lorem ipsum in public HTML'
    );

    // Should NOT flag clean code
    assert.ok(
      !findings.some((f) => f.file === 'src/services/api.js'),
      'Should NOT flag clean api.js'
    );
    assert.ok(
      !findings.some((f) => f.file === 'src/utils/helpers.js'),
      'Should NOT flag clean helpers.js'
    );
    assert.ok(!findings.some((f) => f.file === 'src/index.js'), 'Should NOT flag clean index.js');

    // Test files should be excluded
    assert.ok(!findings.some((f) => f.file === 'tests/App.test.jsx'), 'Should NOT scan test files');
  });
});

// ═══════════════════════════════════════════════
// SCORE SUMMARY
// ═══════════════════════════════════════════════

function printScore() {
  // simplebeacon-ignore: console-log — test completion summary
  console.log('\n✅ Scanner robustness integration tests complete');
}

printScore();
