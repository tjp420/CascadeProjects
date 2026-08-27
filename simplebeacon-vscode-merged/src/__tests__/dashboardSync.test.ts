// simplebeacon-ignore: test fixture, dashboard code — build integrity test for dashboard sync
import * as fs from 'fs';
import * as path from 'path';

/**
 * This test verifies that the dashboard-web copy inside the VS Code extension
 * does not contain Vite-only patterns that break direct loading in VS Code webviews.
 *
 * This is the test that would have caught the
 * `@/workers/scan-worker-bundled.js?worker&inline` crash in v3.0.526.
 */

const EXTENSION_ROOT = path.resolve(__dirname, '../..');
const DASHBOARD_WEB = path.join(EXTENSION_ROOT, 'dashboard-web');

// Vite-only patterns that break direct loading in VS Code webviews
// These patterns match import statements only, not URL query strings in HTML.
const VITE_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /from\s+["']@\/[^"']+["']/g, description: 'Vite @/ alias import' },
  { pattern: /import\s+["']@\/[^"']+["']/g, description: 'Vite @/ alias side-effect import' },
  { pattern: /import\s+[^;]+\?worker&inline/g, description: 'Vite ?worker&inline query suffix in import' },
  { pattern: /import\s+[^;]+\?worker\b/g, description: 'Vite ?worker query suffix in import' },
  { pattern: /import\s+[^;]+\?raw\b/g, description: 'Vite ?raw query suffix in import' },
  { pattern: /import\s+[^;]+\?inline\b/g, description: 'Vite ?inline query suffix in import' },
  { pattern: /import\.meta\.env/g, description: 'Vite import.meta.env reference' },
];

// Directories to scan for Vite patterns
const SCAN_DIRS = [
  path.join(DASHBOARD_WEB, 'js-es2018'),
  path.join(DASHBOARD_WEB, 'js'),
  path.join(DASHBOARD_WEB, 'assets'),
];

// File extensions to scan
const SCAN_EXTENSIONS = ['.js', '.mjs', '.ts'];

function walkDir(dir: string, results: string[] = []): string[] {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules and dist
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walkDir(fullPath, results);
    } else if (SCAN_EXTENSIONS.includes(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

function scanFileForVitePatterns(filePath: string): Array<{ line: number; pattern: string; match: string }> {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const findings: Array<{ line: number; pattern: string; match: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { pattern, description } of VITE_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(line)) !== null) {
        findings.push({ line: i + 1, pattern: description, match: match[0] });
      }
    }
  }
  return findings;
}

describe('Dashboard sync integrity — no Vite-only patterns', () => {
  it('dashboard-web directory should exist', () => {
    expect(fs.existsSync(DASHBOARD_WEB)).toBe(true);
  });

  it('localScanService.js should not contain Vite @/ imports', () => {
    const scanServicePath = path.join(DASHBOARD_WEB, 'js-es2018', 'services', 'localScanService.js');
    if (!fs.existsSync(scanServicePath)) {
      // Some builds may not include this file
      return;
    }
    const findings = scanFileForVitePatterns(scanServicePath);
    if (findings.length > 0) {
      throw new Error(
        `localScanService.js contains Vite-only patterns:\n` +
          findings.map((f) => `  line ${f.line}: ${f.pattern} → "${f.match}"`).join('\n')
      );
    }
  });

  it('no .js files in dashboard-web should contain Vite-only patterns', () => {
    const allFindings: Array<{ file: string; line: number; pattern: string; match: string }> = [];

    for (const dir of SCAN_DIRS) {
      const files = walkDir(dir);
      for (const file of files) {
        const findings = scanFileForVitePatterns(file);
        for (const f of findings) {
          allFindings.push({
            file: path.relative(EXTENSION_ROOT, file),
            ...f,
          });
        }
      }
    }

    if (allFindings.length > 0) {
      throw new Error(
        `Found ${allFindings.length} Vite-only pattern(s) in dashboard-web — ` +
          'these will crash when loaded directly in a VS Code webview:\n' +
          allFindings
            .slice(0, 20)
            .map((f) => `  ${f.file}:${f.line} — ${f.pattern} → "${f.match}"`)
            .join('\n') +
          (allFindings.length > 20 ? `\n  ... and ${allFindings.length - 20} more` : '')
      );
    }
  });
});
