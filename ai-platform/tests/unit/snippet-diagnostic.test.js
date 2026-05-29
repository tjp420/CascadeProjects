const fs = require('fs');
const path = require('path');

const SNIPPET_DIAGNOSTIC = path.join(
  __dirname,
  '../../web/simplebeacon-dashboard/js/utils/snippetDiagnostic.js'
);

function loadSnippetDiagnostic() {
  const stripped = fs.readFileSync(SNIPPET_DIAGNOSTIC, 'utf8')
    .replace(/^export /gm, '')
    .replace(/^import .*$/gm, '');
  const fn = new Function(`${stripped}; return {
    scanSnippetText,
    filterSnippetFindingsForFile,
    isAnalyzerCacheJson,
    isCleanupExportJson,
    isFictionDigestJson,
    isLockfileName,
    isScannerMetaFileName
  };`);
  return fn();
}

describe('snippetDiagnostic mock-path triage', () => {
  let scanSnippetText;
  let filterSnippetFindingsForFile;
  let isAnalyzerCacheJson;
  let isCleanupExportJson;
  let isFictionDigestJson;
  let isScannerMetaFileName;

  beforeAll(() => {
    ({
      scanSnippetText,
      filterSnippetFindingsForFile,
      isAnalyzerCacheJson,
      isCleanupExportJson,
      isFictionDigestJson,
      isScannerMetaFileName
    } = loadSnippetDiagnostic());
  });

  test('isAnalyzerCacheJson recognizes analyzer cache shape', () => {
    expect(isAnalyzerCacheJson({
      files: {
        'server/lib/foo.js': { hash: 'abc', lastScanned: 1 }
      },
      lastScan: 1
    })).toBe(true);
    expect(isAnalyzerCacheJson({ issues: [] })).toBe(false);
  });

  test('isScannerMetaFileName matches analyzer-cache.json', () => {
    expect(isScannerMetaFileName('.simplebeacon/analyzer-cache.json')).toBe(true);
  });

  test('isScannerMetaFileName matches source-kpi-findings.json', () => {
    expect(isScannerMetaFileName('.simplebeacon/source-kpi-findings.json')).toBe(true);
  });

  test('scanSnippetText skips analyzer-cache.json by filename', () => {
    expect(scanSnippetText('{"fixtures/":1}', { fileName: 'analyzer-cache.json' })).toEqual([]);
  });

  test('scanSnippetText skips analyzer cache shape even with wrong filename', () => {
    const cacheJson = JSON.stringify({
      files: {
        'server/lib/fixtures/sample-audit-report-data.js': { hash: 'abc', lastScanned: 1 }
      },
      lastScan: 1
    });
    expect(scanSnippetText(cacheJson, { fileName: 'cache-export.json' })).toEqual([]);
  });

  test('scanSnippetText ignores path-registry lines in cache-like JSON', () => {
    const cacheLine = '"C:/repo/server/lib/fixtures/sample-audit-report-data.js": {';
    const findings = scanSnippetText(`${cacheLine}\n`);
    expect(findings).toEqual([]);
  });

  test('scanSnippetText still flags mockData assignment in source', () => {
    const findings = scanSnippetText('const mockData = { users: [] };\n');
    expect(findings.some((f) => f.id === 'mock-path')).toBe(true);
  });

  test('scanSnippetText skips source-kpi-findings.json by filename', () => {
    const line = '"file": "github-cache/facebook-react/src/__tests__/fixtures/compiler/foo.js",';
    expect(scanSnippetText(`${line}\n`, { fileName: 'source-kpi-findings.json' })).toEqual([]);
  });

  test('scanSnippetText ignores fixture paths in finding registry lines', () => {
    const line = '"file": "github-cache/facebook-react/compiler/src/__tests__/fixtures/compiler/array-from.js",';
    const findings = scanSnippetText(`${line}\n`);
    expect(findings.filter((f) => f.id === 'mock-path')).toEqual([]);
  });

  test('isCleanupExportJson recognizes cleanup export shape', () => {
    expect(isCleanupExportJson({ type: 'simplebeacon-cleanup-export', phase: 'post-phase1' })).toBe(true);
    expect(isCleanupExportJson({ type: 'simplebeacon-cleanup-brief' })).toBe(true);
    expect(isCleanupExportJson({ type: 'simplebeacon-complete-scan' })).toBe(false);
  });

  test('isScannerMetaFileName matches cleanup-export filenames', () => {
    expect(isScannerMetaFileName('cleanup-export-post-phase1-2026-05-29.json')).toBe(true);
  });

  test('scanSnippetText skips cleanup-export filenames', () => {
    const line = '"path": "tests/fixtures/ai-analyzer-eval/economic-regulatory/a-17-market-monopolization.json",';
    expect(scanSnippetText(`${line}\n`, { fileName: 'cleanup-export-post-phase1-2026-05-29.json' })).toEqual([]);
  });

  test('scanSnippetText ignores cleanup export inventory path lines', () => {
    const lines = [
      '"scripts/remove-malformed-mockdata.js",',
      '"path": "tests/fixtures/ai-analyzer-eval/economic-regulatory/a-17-market-monopolization.json",',
      '"path": "mock_data_6.json",'
    ].join('\n');
    const findings = scanSnippetText(`${lines}\n`);
    expect(findings.filter((f) => f.id === 'mock-path')).toEqual([]);
  });

  test('cleanup-export-post-phase1 on disk produces zero snippet hits', () => {
    const exportPath = path.join(__dirname, '../../.simplebeacon/cleanup-export-post-phase1-2026-05-29.json');
    if (!fs.existsSync(exportPath)) return;
    const text = fs.readFileSync(exportPath, 'utf8');
    const findings = scanSnippetText(text, { fileName: 'cleanup-export-post-phase1-2026-05-29.json' });
    expect(findings).toEqual([]);
  });

  test('cleanup-export-fresh on disk produces zero snippet hits', () => {
    const exportPath = path.join(__dirname, '../../.simplebeacon/cleanup-export-fresh-2026-05-29.json');
    if (!fs.existsSync(exportPath)) return;
    const text = fs.readFileSync(exportPath, 'utf8');
    const findings = scanSnippetText(text, { fileName: 'cleanup-export-fresh-2026-05-29.json' });
    expect(findings).toEqual([]);
  });

  test('analyzer-cache.json on disk produces zero snippet hits', () => {
    const cachePath = path.join(__dirname, '../../.simplebeacon/analyzer-cache.json');
    if (!fs.existsSync(cachePath)) return;
    const text = fs.readFileSync(cachePath, 'utf8');
    const findings = scanSnippetText(text, { fileName: 'analyzer-cache.json' });
    expect(findings).toEqual([]);
  });

  test('scanSnippetText ignores fixture paths in Simplebeacon audit HTML finding rows', () => {
    const auditHtmlPath = path.join(
      __dirname,
      '../../deliverables/vendor-handoff-2026-05-28/02-codebase-hygiene-AJ1JFI.html'
    );
    if (!fs.existsSync(auditHtmlPath)) return;
    const text = fs.readFileSync(auditHtmlPath, 'utf8');
    const findings = scanSnippetText(text, {
      fileName: 'SB-AUD-20260529-VWO0BC-CascadeProjects-ai-platform.html'
    });
    expect(findings.filter((f) => f.id === 'mock-path')).toEqual([]);
  });

  test('scanSnippetText ignores npm bin entries in package-lock.json', () => {
    const line = '        "import-local-fixture": "fixtures/cli.js"';
    const findings = scanSnippetText(`${line}\n`, { fileName: 'package-lock.json' });
    expect(findings.filter((f) => f.id === 'mock-path')).toEqual([]);
  });

  test('scanSnippetText skips package-lock.json entirely by filename', () => {
    const line = '        "import-local-fixture": "fixtures/cli.js"';
    expect(scanSnippetText(`${line}\n`, { fileName: 'package-lock.json' })).toEqual([]);
    expect(scanSnippetText(`${line}\n`, { fileName: 'C:/repo/ai-platform/package-lock.json' })).toEqual([]);
  });

  test('scanSnippetText ignores npm bin line without lockfile filename', () => {
    const line = '        "import-local-fixture": "fixtures/cli.js"';
    const findings = scanSnippetText(`${line}\n`);
    expect(findings.filter((f) => f.id === 'mock-path')).toEqual([]);
  });

  test('package-lock.json on disk produces zero mock-path snippet hits', () => {
    const lockPath = path.join(__dirname, '../../package-lock.json');
    if (!fs.existsSync(lockPath)) return;
    const text = fs.readFileSync(lockPath, 'utf8');
    const findings = scanSnippetText(text, { fileName: 'package-lock.json' });
    expect(findings.filter((f) => f.id === 'mock-path')).toEqual([]);
  });

  test('scanSnippetText ignores mock-path tokens in markdown rule documentation', () => {
    const workflowPath = path.join(__dirname, '../../SIMPLEBEACON_DEVSECOPS_WORKFLOW.md');
    if (!fs.existsSync(workflowPath)) return;
    const text = fs.readFileSync(workflowPath, 'utf8');
    const findings = scanSnippetText(text, { fileName: 'SIMPLEBEACON_DEVSECOPS_WORKFLOW.md' });
    expect(findings.filter((f) => f.id === 'mock-path')).toEqual([]);
  });

  test('filterSnippetFindingsForFile strips mock-path from markdown even when scanner is stale', () => {
    const staleFindings = [{
      id: 'mock-path',
      severity: 'high',
      label: 'Production mock/sample path',
      line: 110,
      match: '`-sample.json`'
    }];
    const filtered = filterSnippetFindingsForFile(
      staleFindings,
      'SIMPLEBEACON_DEVSECOPS_WORKFLOW.md'
    );
    expect(filtered).toEqual([]);
  });

  test('scanSnippetText ignores bare -sample.json suffix in inline rule docs without filename', () => {
    const line = '- `production-leak` scans hardcoded `-sample.json` paths in `server/` and `src/`.';
    const findings = scanSnippetText(`${line}\n`, {});
    expect(findings.filter((f) => f.id === 'mock-path')).toEqual([]);
  });

  test('scanSnippetText ignores devsecops workflow markdown even without filename', () => {
    const workflowPath = path.join(__dirname, '../../SIMPLEBEACON_DEVSECOPS_WORKFLOW.md');
    if (!fs.existsSync(workflowPath)) return;
    const text = fs.readFileSync(workflowPath, 'utf8');
    const findings = scanSnippetText(text, {});
    expect(findings.filter((f) => f.id === 'mock-path')).toEqual([]);
  });

  test('scanSnippetText still flags quoted sample json paths in source', () => {
    const findings = scanSnippetText("const p = './web/data/report-sample.json';\n");
    expect(findings.some((f) => f.id === 'mock-path')).toBe(true);
  });

  test('scanSnippetText ignores test fixture paths in jest.config.js', () => {
    const jestConfigPath = path.join(__dirname, '../../jest.config.js');
    if (!fs.existsSync(jestConfigPath)) return;
    const text = fs.readFileSync(jestConfigPath, 'utf8');
    const findings = scanSnippetText(text, { fileName: 'jest.config.js' });
    expect(findings.filter((f) => f.id === 'mock-path')).toEqual([]);
  });

  test('isFictionDigestJson recognizes fiction digest shape', () => {
    expect(isFictionDigestJson({
      type: 'simplebeacon-fiction-digest',
      sourceReport: { type: 'simplebeacon-report', gate: { pass: true } }
    })).toBe(true);
    expect(isFictionDigestJson({ type: 'simplebeacon-report' })).toBe(false);
  });

  test('isScannerMetaFileName matches fiction-digest filenames', () => {
    expect(isScannerMetaFileName('fiction-digest-c-users-trevor-cascadeprojects-ai-platform-2026-05-29.json')).toBe(true);
  });

  test('scanSnippetText ignores sample catalog lines in fiction digest exports', () => {
    const lines = [
      '"mock-analysis-sample.json",',
      '"fictional-patterns-sample.json",',
      '"ai-adoption-trends-sample.json",'
    ].join('\n');
    const findings = scanSnippetText(`${lines}\n`);
    expect(findings.filter((f) => f.id === 'mock-path')).toEqual([]);
  });

  test('fiction digest export on disk produces zero snippet hits', () => {
    const candidates = [
      path.join(process.env.USERPROFILE || '', 'Downloads/fiction-digest-c-users-trevor-cascadeprojects-ai-platform-2026-05-29.json'),
      path.join(__dirname, '../../deliverables/vendor-handoff-2026-05-28/user-export-simplebeacon-report-2026-05-29.json')
    ];
    const exportPath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!exportPath) return;
    const text = fs.readFileSync(exportPath, 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }
    if (parsed.type !== 'simplebeacon-fiction-digest') return;
    const fileName = path.basename(exportPath);
    const findings = scanSnippetText(text, { fileName });
    expect(findings).toEqual([]);
  });
});
