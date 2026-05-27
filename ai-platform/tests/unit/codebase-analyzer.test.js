const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    analyzeCodebase,
    ESLINT_TARGET_DIRS,
    resolveEslintTargets
} = require('../../server/lib/codebase-analyzer');

describe('codebase analyzer', () => {
    let tempDir;

    beforeEach(async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'codebase-analyzer-'));
    });

    afterEach(async () => {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    test('detects invalid JSON, TODO markers, and empty files', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'src'), { recursive: true });
        await fs.promises.writeFile(path.join(tempDir, 'src', 'broken.json'), '{ not json', 'utf8');
        await fs.promises.writeFile(path.join(tempDir, 'src', 'empty.js'), '', 'utf8');
        await fs.promises.writeFile(
            path.join(tempDir, 'src', 'debt.js'),
            'function run() {\n  // TODO: fix this later\n  console.log("debug");\n}\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });

        expect(report.type).toBe('codebase-analyzer-report');
        expect(report.summary.codeFilesAnalyzed).toBeGreaterThanOrEqual(3);
        expect(report.findings.some((f) => f.type === 'invalid-json')).toBe(true);
        expect(report.findings.some((f) => f.type === 'empty-file')).toBe(true);
        expect(report.findings.some((f) => f.category === 'tech-debt')).toBe(true);
        expect(report.summary.healthScore).toBeLessThan(100);
    });

    test('resolveEslintTargets includes dirs with lintable JS and skips empty trees', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'server'), { recursive: true });
        await fs.promises.mkdir(path.join(tempDir, 'web', 'components'), { recursive: true });
        await fs.promises.mkdir(path.join(tempDir, 'src'), { recursive: true });
        await fs.promises.writeFile(path.join(tempDir, 'server', 'app.js'), 'module.exports = {};\n', 'utf8');
        await fs.promises.writeFile(path.join(tempDir, 'src', 'app.js'), 'module.exports = {};\n', 'utf8');
        const targets = resolveEslintTargets(tempDir);
        expect(ESLINT_TARGET_DIRS).toEqual([
            'server',
            'packages',
            'web/scripts',
            'web/components',
            'web/simplebeacon-dashboard/js',
            'src'
        ]);
        expect(targets).toHaveLength(2);
        expect(targets.every((p) => p.startsWith(tempDir))).toBe(true);
    });

    test('includes repository inventory counts', async () => {
        await fs.promises.writeFile(path.join(tempDir, 'readme.md'), '# ok\n', 'utf8');
        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        expect(report.summary.repositoryFilesTotal).toBeGreaterThanOrEqual(1);
        expect(report.repositoryInventory?.totalFiles).toBeGreaterThanOrEqual(1);
    });

    test('debug analyzer scopes to server and packages paths only', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'src'), { recursive: true });
        await fs.promises.mkdir(path.join(tempDir, 'server'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'src', 'app.js'),
            'export function run() { console.log("src"); debugger; }\n',
            'utf8'
        );
        await fs.promises.writeFile(
            path.join(tempDir, 'server', 'app.js'),
            'function run() {\n  console.log("server");\n  debugger;\n}\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const debugFindings = report.findings.filter((f) => f.category === 'debug-artifact');
        expect(debugFindings.length).toBe(2);
        expect(debugFindings.every((f) => f.filePath.startsWith('server/'))).toBe(true);
    });

    test('debug analyzer only flags production-relevant paths deterministically', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'server'), { recursive: true });
        await fs.promises.mkdir(path.join(tempDir, 'tests'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'server', 'app.js'),
            'function run() {\n  console.log("prod debug");\n  debugger;\n}\n',
            'utf8'
        );
        await fs.promises.writeFile(
            path.join(tempDir, 'tests', 'app.test.js'),
            'test("x", () => { console.log("test debug"); });\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const debugFindings = report.findings.filter((f) => f.category === 'debug-artifact');
        expect(debugFindings.length).toBe(2);
        expect(debugFindings.every((f) => f.filePath.startsWith('server/'))).toBe(true);
        expect(report.summary.analyzerCounts.debugArtifacts).toBe(2);
    });

    test('debug analyzer skips gated and pattern-definition lines', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'server'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'server', 'gated.js'),
            'const DEBUG = process.env.FOO_DEBUG === "true";\nif (DEBUG) console.log("ok");\nconst x = content.includes("debugger");\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const debugFindings = report.findings.filter((f) => f.category === 'debug-artifact');
        expect(debugFindings.length).toBe(0);
    });

    test('debug analyzer skips DEBUG_PATTERNS catalog and regex literal definitions', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'server', 'lib'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'server', 'lib', 'scanner.js'),
            [
                'const DEBUG_PATTERNS = [',
                "  { id: 'debugger', pattern: /\\bdebugger\\s*;?/g, label: 'debugger statement' },",
                "  { id: 'console-log', pattern: /\\bconsole\\.(log|debug)\\s*\\(/g, label: 'console.log/debug' }",
                '];',
                "const action = 'Remove debugger statement from production-relevant code';",
                'const hasDebugger = false;',
                ''
            ].join('\n'),
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const debugFindings = report.findings.filter((f) => f.category === 'debug-artifact');
        expect(debugFindings.length).toBe(0);
    });

    test('debug analyzer skips content.includes debugger and console.log quality checks', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'server'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'server', 'quality.js'),
            [
                'function calculateFileQuality(content) {',
                "  if (content.includes('console.log')) quality -= 5;",
                "  if (content.includes('debugger')) quality -= 5;",
                '  return quality;',
                '}',
                ''
            ].join('\n'),
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const debugFindings = report.findings.filter((f) => f.category === 'debug-artifact');
        expect(debugFindings.length).toBe(0);
    });

    test('debug analyzer handles monorepo-prefixed server paths without self-flagging', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'ai-platform', 'server', 'lib'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'ai-platform', 'server', 'lib', 'scanner.js'),
            [
                'const DEBUG_PATTERNS = [',
                "  { id: 'debugger', pattern: /\\bdebugger\\s*;?/g, label: 'debugger statement' },",
                '];',
                "if (content.includes('debugger')) quality -= 5;",
                'const hasDebugger = false;',
                ''
            ].join('\n'),
            'utf8'
        );
        await fs.promises.writeFile(
            path.join(tempDir, 'ai-platform', 'server', 'routes.js'),
            'function run() { debugger; console.log("real"); }\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const debugFindings = report.findings.filter((f) => f.category === 'debug-artifact');
        expect(debugFindings.length).toBe(1);
        expect(debugFindings[0].filePath).toContain('routes.js');
        expect(debugFindings[0].type).toBe('debugger');
        expect(debugFindings.some((f) => f.filePath.includes('lib/scanner.js'))).toBe(false);
    });

    test('syntax check skips template directories', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'templates'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'templates', 'doc-template.js'),
            'function functionName(paramName, paramName, paramName) { return null; }\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const syntaxFindings = report.findings.filter((f) => f.type === 'syntax-error');
        expect(syntaxFindings.length).toBe(0);
    });

    test('tech-debt and placeholder analyzers skip pattern catalog definitions', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'server', 'lib'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'server', 'lib', 'catalog.js'),
            [
                'const TECH_DEBT_PATTERNS = [',
                "  { id: 'todo', pattern: /\\bTODO\\b[:\\s]/gi, label: 'TODO marker' },",
                '];',
                'const PLACEHOLDER_PATTERNS = [',
                "  { id: 'tbd', pattern: /\\bTBD\\b/gi, label: 'TBD placeholder' },",
                "  { id: 'coming-soon', pattern: /\\bcoming soon\\b/gi, label: 'Coming soon placeholder' },",
                '];',
                ''
            ].join('\n'),
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const techDebt = report.findings.filter((f) => f.category === 'tech-debt');
        const placeholder = report.findings.filter((f) => f.category === 'meaningless-data');
        expect(techDebt.length).toBe(0);
        expect(placeholder.length).toBe(0);
    });

    test('placeholder analyzer elevates fictional KPI claims', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'src'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'src', 'metrics.json'),
            JSON.stringify({
                marketing: 'Model reached 98.5% AI accuracy in all benchmarks',
                banner: 'Coming soon'
            }),
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const placeholder = report.findings.filter((f) => f.category === 'meaningless-data');
        expect(placeholder.some((f) => f.type === 'fiction-kpi' && f.severity === 'high')).toBe(true);
        expect(report.summary.analyzerCounts.placeholderOrFictionalData).toBeGreaterThanOrEqual(1);
    });

    test('placeholder analyzer skips report template and meta docs', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'src', 'ai-system'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'src', 'ai-system', 'automated_reporting_system.py'),
            'TEMPLATE = """\n**High:** TBD (requires detailed issue data_item)\n"""\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const placeholder = report.findings.filter((f) => f.category === 'meaningless-data');
        expect(placeholder.length).toBe(0);
    });

    test('placeholder analyzer skips remediation meta and catalog docs', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'docs', 'planning'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'docs', 'planning', 'plan.md'),
            '# Plan\n\nStatus: TBD\n100% compliance target\n',
            'utf8'
        );
        await fs.promises.writeFile(
            path.join(tempDir, 'docs', 'fiction-pattern-registry.md'),
            'Patterns: coming soon, lorem ipsum, TBD\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const placeholder = report.findings.filter((f) => f.category === 'meaningless-data');
        expect(placeholder.length).toBe(0);
    });

    test('plugin analyzer skips analyzer pattern guide docs with example markers', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'docs'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'docs', 'REPAIR_READY_ANALYZER_GUIDE.md'),
            [
                '# Analyzer guide',
                '# TODO: Replace eval() with JSON.parse()',
                '# TODO: import logging; logger.info() instead of print()',
                '- `print()` statements in production code (Low)',
                '- `console.log()` in production code (Low)',
                ''
            ].join('\n'),
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const guideFindings = report.findings.filter((f) => /repair_ready_analyzer_guide/i.test(f.filePath));
        expect(guideFindings.length).toBe(0);
    });

    test('syntax check skips ES module files with import or export', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'src', 'web'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'src', 'web', 'module.js'),
            'class Helper {}\nexport default Helper;\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const broken = report.findings.filter((f) => f.category === 'broken' && f.filePath.includes('module.js'));
        expect(broken.length).toBe(0);
    });

    test('syntax findings use descriptive labels for unclosed block comments', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'server'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'server', 'broken-header.js'),
            '/**\n * header without close\nconst x = 1;\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const broken = report.findings.find((f) => f.filePath.includes('broken-header.js'));
        expect(broken).toBeTruthy();
        expect(broken.description).toMatch(/Unclosed block comment/i);
        expect(broken.description).not.toMatch(/Invalid or unexpected token/i);
        expect(broken.recommendedAction).toMatch(/Close the open/i);
    });

    test('syntax check ignores glob ** patterns inside string literals', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'packages', 'simplebeacon-cli', 'src'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'packages', 'simplebeacon-cli', 'src', 'project-detect.js'),
            '/**\n * Detect project layout.\n */\nconst IGNORE = [\'node_modules/**\', \'tests/**\'];\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const broken = report.findings.filter(
            (f) => f.filePath.includes('project-detect.js') && f.category === 'broken'
        );
        expect(broken.length).toBe(0);
    });

    test('syntax check ignores apostrophes inside closed block comments', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'core', 'monitor'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'core', 'monitor', 'file-monitor.js'),
            '/**\n * Uses analyzer\'s watcher entrypoint.\n */\nconst mod = require(\'../engines/issue-analyzer\');\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const broken = report.findings.filter(
            (f) => f.filePath.includes('file-monitor.js') && f.category === 'broken'
        );
        expect(broken.length).toBe(0);
    });

    test('syntax check ignores block-comment markers inside template literals', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'scripts'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'scripts', 'security-analysis-simple.js'),
            'const example = `before /* not a comment */ after`;\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const broken = report.findings.filter(
            (f) => f.filePath.includes('security-analysis-simple.js') && f.category === 'broken'
        );
        expect(broken.length).toBe(0);
    });

    test('debug scan skips CLI reporter console output', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'packages', 'cli', 'src', 'reporters'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'packages', 'cli', 'src', 'reporters', 'build-report.js'),
            'function main() {\n  console.log(\'Audit report generated\');\n}\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const debugFindings = report.findings.filter(
            (f) => f.filePath.includes('reporters/build-report.js') && f.category === 'debug-artifact'
        );
        expect(debugFindings.length).toBe(0);
    });

    test('debug scan skips npm publish scripts with Write-Host output', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'packages', 'simplebeacon-cli'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'packages', 'simplebeacon-cli', 'publish.ps1'),
            'Write-Host "Publishing..." -ForegroundColor Cyan\nWrite-Host "Done"\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const debugFindings = report.findings.filter(
            (f) => f.filePath.includes('publish.ps1') && f.category === 'debug-artifact'
        );
        expect(debugFindings.length).toBe(0);
    });

    test('syntax check skips reporter tooling paths', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'packages', 'cli', 'src', 'reporters'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'packages', 'cli', 'src', 'reporters', 'legacy.js'),
            '/**\n * unclosed on purpose\nconst x = 1;\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const broken = report.findings.filter((f) => f.filePath.includes('reporters/legacy.js'));
        expect(broken.length).toBe(0);
    });

    test('eslint integration consumes existing eslint report artifact by default', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'reports', 'technical-debt', 'raw'), { recursive: true });
        const eslintReport = [
            {
                filePath: path.join(tempDir, 'src', 'index.js'),
                errorCount: 1,
                warningCount: 1,
                messages: [
                    { ruleId: 'no-debugger', severity: 2, message: 'Unexpected debugger statement.', line: 4 },
                    { ruleId: 'no-console', severity: 1, message: 'Unexpected console statement.', line: 2 }
                ]
            }
        ];
        await fs.promises.writeFile(
            path.join(tempDir, 'reports', 'technical-debt', 'raw', 'eslint-report.json'),
            JSON.stringify(eslintReport, null, 2),
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        expect(report.summary.eslintSource).toBe('artifact');
        expect(report.summary.eslintErrors).toBe(1);
        expect(report.summary.eslintWarnings).toBe(1);
        expect(report.eslintSummary.totalIssues).toBe(2);
        expect(report.eslintSummary.categorizedWarnings.some((c) => c.category === 'debug-hygiene')).toBe(true);
        expect(report.findings.some((f) => f.category === 'eslint')).toBe(true);
    });

    test('placeholder analyzer skips archived historical docs', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'docs', 'archive', 'historical-reports'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'docs', 'archive', 'historical-reports', 'old-report.md'),
            '# Old\n\nLorem ipsum and TBD and coming soon\n100% quality complete\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const placeholder = report.findings.filter((f) => f.category === 'meaningless-data');
        expect(placeholder.length).toBe(0);
    });

    test('tech-debt analyzer skips technical-debt report artifacts', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'reports', 'technical-debt', 'artifacts'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'reports', 'technical-debt', 'artifacts', 'build-artifacts.js'),
            "md.push('- P2: 225 TODO/FIXME/HACK markers indicate debt');\n",
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const techDebt = report.findings.filter((f) => f.category === 'tech-debt');
        expect(techDebt.length).toBe(0);
    });

    test('mirror src/web tree is excluded from monorepo-prefixed scans', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'ai-platform', 'src', 'web'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'ai-platform', 'src', 'web', 'mock_data_scanner.js'),
            "const pattern = /lorem ipsum|coming soon|TBD/gi;\nconsole.log('debug');\n",
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const placeholder = report.findings.filter((f) => f.category === 'meaningless-data');
        const debugFindings = report.findings.filter((f) => f.category === 'debug-artifact');
        expect(placeholder.length).toBe(0);
        expect(debugFindings.length).toBe(0);
    });

    test('tech-debt analyzer skips JSDoc deprecation, enums, and anti-fiction narrative', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'server', 'lib'), { recursive: true });
        await fs.promises.mkdir(path.join(tempDir, 'web', 'services'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'server', 'lib', 'roadmap.js'),
            [
                "const rejectedFiction = { warning: 'Enterprise design claims not implemented in v0.8-beta' };",
                'const deprecatedNarrative = { previousCompletionRate: null };',
                ''
            ].join('\n'),
            'utf8'
        );
        await fs.promises.writeFile(
            path.join(tempDir, 'web', 'services', 'platformService.js'),
            "/** @deprecated Use FEATURE_CATALOG */\nexport const LEGACY = [];\n",
            'utf8'
        );
        await fs.promises.writeFile(
            path.join(tempDir, 'web', 'services', 'status.js'),
            "const statuses = ['active', 'inactive', 'maintenance', 'deprecated'];\n",
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const techDebt = report.findings.filter((f) => f.category === 'tech-debt');
        expect(techDebt.length).toBe(0);
    });

    test('placeholder analyzer skips repository-audit sample JSON and legacy ai-system tree', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'ai-platform', 'web', 'data'), { recursive: true });
        await fs.promises.mkdir(path.join(tempDir, 'ai-platform', 'src', 'ai-system'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'ai-platform', 'web', 'data', 'mock-analysis-sample.json'),
            JSON.stringify({
                notes: 'not legacy demo oracle or 98.5% confidence fiction.',
                rejectedFiction: { warning: 'Prior demo scans used legacy oracle branding and 98.5% confidence' }
            }),
            'utf8'
        );
        await fs.promises.writeFile(
            path.join(tempDir, 'ai-platform', 'src', 'ai-system', 'status.md'),
            '# Status\n\n100% complete\ncoming soon\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const placeholder = report.findings.filter((f) => f.category === 'meaningless-data');
        expect(placeholder.length).toBe(0);
    });

    test('placeholder analyzer skips historical status reports at repo root', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'ai-platform'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'GGUF_ANALYSIS_COMPONENT_INTEGRATION_REPORT.md'),
            '# Report\n\n98.5% AI confidence\n100% complete\n',
            'utf8'
        );
        await fs.promises.writeFile(
            path.join(tempDir, 'ai-platform', 'REALTIME_STATUS_UPDATE.md'),
            '# Status\n\n100% COMPLETE\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const placeholder = report.findings.filter((f) => f.category === 'meaningless-data');
        expect(placeholder.length).toBe(0);
    });

    test('duplicate analyzer ignores mirror staging trees', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'ai-platform', 'web', 'scripts'), { recursive: true });
        await fs.promises.mkdir(path.join(tempDir, 'ai-platform', 'src', 'web'), { recursive: true });
        await fs.promises.writeFile(path.join(tempDir, 'ai-platform', 'web', 'scripts', 'widget.js'), 'module.exports = {};\n', 'utf8');
        await fs.promises.writeFile(path.join(tempDir, 'ai-platform', 'src', 'web', 'widget.js'), 'module.exports = {};\n', 'utf8');

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        const duplicates = report.findings.filter((f) => f.category === 'duplicate');
        expect(duplicates.length).toBe(0);
    });

    test('detects ZScript debug and debt markers in .zs files', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'zscript'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'zscript', 'weapon.zs'),
            [
                'class TestWeapon : Weapon',
                '{',
                '  override void DoEffect()',
                '  {',
                '    // TODO: balance damage',
                '    Console.Command("give all");',
                '    A_Log(\"debug shot\");',
                '  }',
                '}',
                ''
            ].join('\n'),
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false });
        expect(report.summary.codeFilesAnalyzed).toBeGreaterThanOrEqual(1);
        expect(report.findings.some((f) => f.category === 'tech-debt' && f.type === 'todo')).toBe(true);
        expect(report.findings.some((f) => f.category === 'debug-artifact' && f.type === 'console-command')).toBe(true);
        expect(report.findings.some((f) => f.category === 'debug-artifact' && f.type === 'debug-print')).toBe(true);
        expect(report.scanScope.scanProfile).toBe('default');
    });

    test('game-dev scan profile includes ACS and DECORATE extensions', async () => {
        const { walkCodeFiles } = require('../../server/lib/codebase-analyzer');
        await fs.promises.writeFile(path.join(tempDir, 'actor.decorate'), 'Actor Foo {}\n', 'utf8');
        await fs.promises.writeFile(path.join(tempDir, 'script.acs'), 'script Debug (void) { Print(\"x\"); }\n', 'utf8');

        const files = await walkCodeFiles(tempDir, { scanProfile: 'game-dev' });
        const names = files.map((f) => f.name).sort();
        expect(names).toEqual(expect.arrayContaining(['actor.decorate', 'script.acs']));
    });

    test('includes structure insights for plugin-analyzed files', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'server'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'server', 'app.py'),
            'def run():\n    print("debug")\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false, scanProfile: 'universal' });
        expect(report.structureInsights?.summary?.sampledFiles).toBeGreaterThanOrEqual(1);
        expect(report.structureInsights.samples.some((s) => s.language === 'python')).toBe(true);
    });

    test('context layer suppresses debug findings in test files', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'tests'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'tests', 'test_app.py'),
            'def test_x():\n    print("debug")\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false, scanProfile: 'universal' });
        const debugFindings = report.findings.filter((f) => f.category === 'debug-artifact');
        expect(debugFindings.length).toBe(0);
    });

    test('skips CLI script debug output from analysis', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'scripts'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'scripts', 'helper.py'),
            'print("debug")\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false, scanProfile: 'universal' });
        const debugFindings = report.findings.filter((f) => f.category === 'debug-artifact');
        expect(debugFindings.length).toBe(0);
    });

    test('health score weights production findings more than documentation tier', async () => {
        for (let i = 0; i < 15; i++) {
            await fs.promises.writeFile(
                path.join(tempDir, `plan-${i}.md`),
                `# Plan ${i}\n\nTODO: document item ${i}\n`,
                'utf8'
            );
        }
        const docReport = await analyzeCodebase(tempDir, { includeEslint: false });
        expect(docReport.summary.tierCounts.documentation).toBeGreaterThan(0);
        expect(docReport.summary.tierCounts.production).toBe(0);
        expect(docReport.summary.healthScore).toBeGreaterThan(70);

        await fs.promises.mkdir(path.join(tempDir, 'server'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'server', 'app.js'),
            'function run() {\n  // TODO: fix production path\n  console.log("debug");\n}\n',
            'utf8'
        );
        const mixedReport = await analyzeCodebase(tempDir, { includeEslint: false });
        expect(mixedReport.summary.tierCounts.production).toBeGreaterThan(0);
        expect(mixedReport.summary.healthScore).toBeLessThan(docReport.summary.healthScore);
    });

    test('scanContentPatterns does not duplicate findings when pattern lacks global flag', () => {
        const { scanContentPatterns } = require('../../server/lib/codebase-analyzer');
        const hits = scanContentPatterns(
            'Use placeholder data in docs only once.',
            'docs/readme.md',
            [{ id: 'placeholder-token', pattern: /\bplaceholder\b/i, label: 'Placeholder token' }],
            'meaningless-data',
            'low'
        );
        expect(hits.length).toBe(1);
        expect(hits[0].recommendedAction).toContain('Replace placeholder text');
    });

    test('skips CSS class placeholder tokens and bundled assets under assets/', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'assets'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'assets', 'editor.main.css'),
            '.monaco-editor .snippet-placeholder { opacity: 0.5; }\n/** Hack to force underline to show **/\n',
            'utf8'
        );
        await fs.promises.writeFile(
            path.join(tempDir, 'AI_PLATFORM_ROADMAP.md'),
            '- **Mock Data**: Comprehensive placeholder data for all features\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false, scanProfile: 'universal' });
        const placeholder = report.findings.filter((f) => f.category === 'meaningless-data');
        const techDebt = report.findings.filter((f) => f.category === 'tech-debt');
        expect(placeholder.length).toBe(0);
        expect(techDebt.length).toBe(0);
    });

    test('dashboard context caps deep file analysis for responsive UI scans', async () => {
        const { resolveDeepAnalyzeCap, resolveFindingsCap, resolveScanContext } = require('../../server/lib/codebase-analyzer');
        expect(resolveScanContext({ scanContext: 'complete' })).toBe('complete');
        expect(resolveScanContext({ context: 'dashboard' })).toBe('dashboard');
        expect(resolveDeepAnalyzeCap({}, 'dashboard')).toBeLessThanOrEqual(2000);
        expect(resolveDeepAnalyzeCap({}, 'cli')).toBeGreaterThan(350);
        expect(resolveDeepAnalyzeCap({}, 'complete')).toBe(Number.POSITIVE_INFINITY);
        expect(resolveFindingsCap({}, 'dashboard')).toBeLessThanOrEqual(400);
        expect(resolveFindingsCap({}, 'complete')).toBeGreaterThan(400);
    });

    test('scopes code walk to ai-platform when scanning monorepo parent', async () => {
        const baseDir = path.join(__dirname, '../..');
        const parentDir = path.join(baseDir, '..');
        const { walkCodeFiles } = require('../../server/lib/codebase-analyzer');
        const { resolvePlatformRoot } = require('../../packages/simplebeacon-cli/src/project-detect');
        const { platformRoot } = resolvePlatformRoot(parentDir);
        const parentScopedFiles = await walkCodeFiles(platformRoot, { scanProfile: 'universal' });
        const platformFiles = await walkCodeFiles(baseDir, { scanProfile: 'universal' });

        expect(platformRoot).toBe(baseDir);
        expect(parentScopedFiles.length).toBe(platformFiles.length);
    }, 60000);

    test('skips legacy src/ai-system tree from deep analysis by default', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'src', 'ai-system'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'src', 'ai-system', 'demo_ai_cleanup.py'),
            'print("debug")\n# TODO: fix\nfrom unittest.mock import MagicMock\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false, scanProfile: 'universal' });
        const aiFindings = report.findings.filter((f) => f.filePath.startsWith('src/ai-system/'));
        expect(aiFindings.length).toBe(0);
        expect(report.summary.codeFilesDiscovered).toBe(0);
    });

    test('python debug scan does not double-count print as r-print', async () => {
        await fs.promises.writeFile(
            path.join(tempDir, 'widget.py'),
            'def run():\n    print("ready")\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false, scanProfile: 'universal' });
        const debug = report.findings.filter((f) => f.category === 'debug-artifact');
        expect(debug.some((f) => f.type === 'python-print')).toBe(true);
        expect(debug.some((f) => f.type === 'r-print')).toBe(false);
    });

    test('skips demo and test HTML pages from plugin debug findings', async () => {
        await fs.promises.writeFile(
            path.join(tempDir, 'ai-tools-test.html'),
            '<script>console.log("fixture");</script>\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false, scanProfile: 'universal' });
        const debug = report.findings.filter((f) => f.category === 'debug-artifact');
        expect(debug.length).toBe(0);
    });

    test('audit remediation recipes are not flagged as production tech debt', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'server', 'lib'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'server', 'lib', 'audit-remediation-recipes.js'),
            [
                "const DEFAULT_RECIPES = {",
                "  'tech-debt': 'Resolve unfinished work markers with a tracked ticket before handoff.',",
                "  'debug-artifact': 'Remove console.log from production paths.'",
                '};',
                'module.exports = { DEFAULT_RECIPES };',
                ''
            ].join('\n'),
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false, scanProfile: 'universal' });
        const hits = report.findings.filter((f) => f.filePath.includes('audit-remediation-recipes'));
        expect(hits.length).toBe(0);
        expect(report.summary.tierCounts.production).toBe(0);
    });

    test('does not flag mock_data module names as python production leaks', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'src', 'server', 'api'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'src', 'server', 'api', 'app.py'),
            [
                'from routers import mock_data_analysis',
                'from mock_scanner import perform_security_scan',
                ''
            ].join('\n'),
            'utf8'
        );
        await fs.promises.writeFile(
            path.join(tempDir, 'src', 'server', 'api', 'enhanced_models.py'),
            'class MockDatasetDB:\n    __tablename__ = "mock_datasets"\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false, scanProfile: 'universal' });
        const mockLeaks = report.findings.filter((f) =>
            /python-(mock|unittest|magic)/.test(f.type || '')
        );
        expect(mockLeaks.length).toBe(0);
    });

    test('flags unittest.mock in production paths', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'server', 'lib'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'server', 'lib', 'bad.py'),
            'from unittest.mock import patch\n\ndef run():\n    return MagicMock()\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false, scanProfile: 'universal' });
        const mockLeaks = report.findings.filter((f) => /python-(unittest|magic|mock-module)/.test(f.type || ''));
        expect(mockLeaks.length).toBeGreaterThan(0);
    });

    test('skips Placeholder tokens in Python comments and meta-scanner production modules', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'src', 'server', 'api'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'src', 'server', 'api', 'simple_server.py'),
            'test_coverage = 75  # Placeholder - could scan for test files\n',
            'utf8'
        );
        await fs.promises.writeFile(
            path.join(tempDir, 'src', 'server', 'api', 'app.py'),
            'from routers import mock_data_analysis\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false, scanProfile: 'universal' });
        const hits = report.findings.filter((f) =>
            f.filePath.includes('simple_server.py') || f.filePath.includes('app.py')
        );
        expect(hits.length).toBe(0);
    });

    test('skips docs and scripts trees from placeholder and python-print findings', async () => {
        await fs.promises.mkdir(path.join(tempDir, 'docs'), { recursive: true });
        await fs.promises.mkdir(path.join(tempDir, 'scripts'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'docs', 'ABOUT_BUTTONS_FIX_SUMMARY.md'),
            'Placeholder KPI: 98.5% AI accuracy and example.com contact flow\n',
            'utf8'
        );
        await fs.promises.writeFile(
            path.join(tempDir, 'scripts', 'build_cleanup.py'),
            'print("Cleaning build outputs")\n',
            'utf8'
        );

        const report = await analyzeCodebase(tempDir, { includeEslint: false, scanProfile: 'universal' });
        const hits = report.findings.filter((f) =>
            f.filePath.includes('docs/ABOUT_BUTTONS_FIX_SUMMARY.md')
            || f.filePath.includes('scripts/build_cleanup.py')
        );
        expect(hits.length).toBe(0);
    });
});
