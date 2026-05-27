const { createLanguageDetector } = require('../../server/lib/universal-language-detector');
const { getBuiltinPluginManager } = require('../../server/lib/plugin-system');
const {
    listRegistryLanguages,
    getExtensionsForProfile,
    UNIVERSAL_LANGUAGE_REGISTRY
} = require('../../server/lib/universal-language-registry');

describe('Universal Language Detector', () => {
    const detector = createLanguageDetector();

    test('detects JavaScript by extension', () => {
        const result = detector.detectLanguage('src/app.js', 'const x = 5;');
        expect(result.language).toBe('javascript');
        expect(result.confidence).toBe(1);
        expect(result.method).toBe('extension');
    });

    test('detects ZScript by extension', () => {
        const result = detector.detectLanguage('actors/weapon.zs', 'class Pistol : Weapon {}');
        expect(result.language).toBe('zscript');
        expect(result.method).toBe('extension');
    });

    test('detects ZScript from content when extension is missing', () => {
        const zscriptCode = [
            'class MyActor : Actor {',
            '  States {',
            '    Spawn:',
            '      TNT1 A 0;',
            '      Goto Super::Spawn;',
            '  }',
            '}'
        ].join('\n');
        const result = detector.detectFromContent(zscriptCode);
        expect(result.language).toBe('zscript');
        expect(result.confidence).toBeGreaterThan(0.55);
    });

    test('falls back to generic for unknown content', () => {
        const result = detector.detectLanguage('notes.xyz', 'random unstructured notes');
        expect(result.language).toBe('generic');
        expect(result.method).toBe('fallback');
    });
});

describe('Language plugin system', () => {
    test('registers built-in ZScript plugin', () => {
        const manager = getBuiltinPluginManager();
        const plugin = manager.getByLanguage('zscript');
        expect(plugin).toBeDefined();
        expect(plugin.id).toBe('zscript-analyzer-v1');
        expect(plugin.matchesExtension('.zs')).toBe(true);
    });

    test('ZScript plugin produces findings via analyze()', () => {
        const manager = getBuiltinPluginManager();
        const plugin = manager.getByLanguage('zscript');
        const content = [
            'class TestWeapon : Weapon {',
            '  override void DoEffect() { Console.Command("give all"); }',
            '}'
        ].join('\n');

        const mockScan = (body, rel, patterns, category, severity) => (
            (patterns || []).map((item) => ({
                category,
                type: item.id,
                severity,
                filePath: rel,
                line: 1,
                description: item.label
            }))
        );

        const result = plugin.analyze(content, 'weapon.zs', {
            scanContentPatterns: mockScan,
            TECH_DEBT_PATTERNS: [],
            isNonProductionAuditContentPath: () => false,
            isTechnicalDebtReportArtifact: () => false,
            detectPlaceholderAndFictionalData: () => []
        });

        expect(result.language).toBe('zscript');
        expect(result.findings.some((f) => f.type === 'console-command')).toBe(true);
    });

    test('registry defines 50+ languages', () => {
        expect(listRegistryLanguages().length).toBeGreaterThanOrEqual(50);
        expect(Object.keys(UNIVERSAL_LANGUAGE_REGISTRY).length).toBeGreaterThanOrEqual(50);
    });

    test('universal profile exposes broad extension set', () => {
        const extensions = getExtensionsForProfile('universal');
        expect(extensions.has('.zs')).toBe(true);
        expect(extensions.has('.rs')).toBe(true);
        expect(extensions.has('.sol')).toBe(true);
        expect(extensions.size).toBeGreaterThan(40);
    });

    test('registers baseline plugins for registry languages', () => {
        const manager = getBuiltinPluginManager();
        const languages = manager.listLanguages();
        expect(languages.length).toBeGreaterThanOrEqual(50);
        expect(manager.getByLanguage('python')).toBeDefined();
        expect(manager.getByLanguage('rust')).toBeDefined();
        expect(manager.getByLanguage('go')).toBeDefined();
        expect(manager.getByLanguage('sql')).toBeDefined();
        expect(manager.getByLanguage('generic')).toBeDefined();
        expect(manager.getByLanguage('python').id).toBe('python-analyzer-v1');
        expect(manager.getByLanguage('rust').id).toBe('rust-analyzer-v1');
        expect(manager.getByLanguage('zscript').id).toBe('zscript-analyzer-v1');
    });

    test('resolves Python and unknown extensions to analyzers', () => {
        const manager = getBuiltinPluginManager();
        const python = manager.resolvePlugin('main.py', '.py', 'print("hi")\n# TODO: refactor');
        expect(python.language).toBe('python');
        expect(python.id).toBe('python-analyzer-v1');

        const rust = manager.resolvePlugin('main.rs', '.rs', 'fn main() {}');
        expect(rust.language).toBe('rust');

        const unknown = manager.resolvePlugin('notes.xyz', '.xyz', '# TODO: review');
        expect(unknown.language).toBe('generic');
    });

    test('Python dedicated plugin flags TODO and print', () => {
        const manager = getBuiltinPluginManager();
        const plugin = manager.getByLanguage('python');
        const mockScan = (body, rel, patterns, category, severity) => (
            (patterns || []).map((item) => ({
                category,
                type: item.id,
                severity,
                filePath: rel
            }))
        );

        const result = plugin.analyze('print("debug")\n# TODO fix', 'server/app.py', {
            scanContentPatterns: mockScan,
            TECH_DEBT_PATTERNS: [],
            isNonProductionAuditContentPath: () => false,
            isTechnicalDebtReportArtifact: () => false,
            isPlaceholderCatalogOrMetaDoc: () => false,
            isProductionRelevantPath: () => true,
            detectPlaceholderAndFictionalData: () => []
        });

        expect(result.findings.some((f) => f.type === 'todo-marker' || f.type === 'python-todo-comment')).toBe(true);
        expect(result.findings.some((f) => f.type === 'python-print')).toBe(true);
        expect(result.structure.approximateFunctions).toBeGreaterThanOrEqual(0);
        expect(result.structure.tier).toBe('baseline');
    });

    test('resolveScanProfile defaults dashboard to universal and CLI to default', () => {
        const { resolveScanProfile } = require('../../server/lib/universal-language-config');
        const original = process.env.SCAN_PROFILE;
        delete process.env.SCAN_PROFILE;
        expect(resolveScanProfile({}, 'dashboard')).toBe('universal');
        expect(resolveScanProfile({}, 'cli')).toBe('default');
        expect(resolveScanProfile({ scanProfile: 'game-dev' }, 'dashboard')).toBe('game-dev');
        if (original) process.env.SCAN_PROFILE = original;
    });
});
