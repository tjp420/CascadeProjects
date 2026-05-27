const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    understandCodeSnippet,
    detectBusinessLogicPatterns,
    appendExpertReview,
    loadExpertReviews,
    summarizeExpertConsensus
} = require('../../server/lib/code-understanding');

describe('code understanding layers', () => {
    let tempDir;

    beforeEach(async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'code-understanding-'));
    });

    afterEach(async () => {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    test('detects game-modding business logic in ZScript', () => {
        const content = [
            'class R3Light : Actor {',
            '  States {',
            '    Spawn:',
            '      TNT1 A 0;',
            '      Goto Super::Spawn;',
            '  }',
            '}'
        ].join('\n');

        const result = detectBusinessLogicPatterns(content, {
            language: 'zscript',
            filePath: 'zscript/lighting.zs'
        });

        expect(result.domains).toContain('game-modding');
        expect(result.patterns.some((p) => p.patternId === 'state-machine')).toBe(true);
    });

    test('semantic layer explains ZScript actor purpose deterministically', async () => {
        const content = 'class MyWeapon : Weapon { States { Fire: A_PlaySound("weapons/fire"); } }';
        const report = await understandCodeSnippet(content, {
            filePath: 'weapons/rifle.zs'
        }, { mode: 'deterministic' });

        expect(report.type).toBe('code-understanding-report');
        expect(report.layers.static.language).toBe('zscript');
        expect(report.layers.semantic.purpose).toMatch(/weapon|actor|state/i);
        expect(report.summary.length).toBeGreaterThan(10);
        expect(report.overallConfidence).toBeGreaterThan(0.3);
    });

    test('expert review store persists and loads reviews', async () => {
        const platformRoot = path.join(tempDir, 'platform');
        await fs.promises.mkdir(path.join(platformRoot, '.simplebeacon'), { recursive: true });

        await appendExpertReview(platformRoot, {
            projectPath: 'E:/Ai/Games/Doom',
            filePath: 'zscript/light.zs',
            domain: 'game-modding',
            validation: 'agree',
            note: 'Actor state chain looks correct for GZDoom 4.14.'
        });

        const reviews = await loadExpertReviews(platformRoot, { filePath: 'zscript/light.zs' });
        expect(reviews.length).toBe(1);
        const consensus = await summarizeExpertConsensus(reviews);
        expect(consensus.count).toBe(1);
        expect(consensus.consensus).toBe('mostly-agree');
    });

    test('attach understanding enriches codebase report shape', async () => {
        const { attachUnderstandingToCodebaseReport } = require('../../server/lib/code-understanding');
        await fs.promises.mkdir(path.join(tempDir, 'mod'), { recursive: true });
        await fs.promises.writeFile(
            path.join(tempDir, 'mod', 'actor.zs'),
            'class TestActor : Actor { States { Spawn: TNT1 A 0; } }',
            'utf8'
        );

        const baseReport = {
            findings: [{
                category: 'debug-artifact',
                type: 'console-command',
                severity: 'medium',
                filePath: 'mod/actor.zs',
                description: 'Console command in mod/actor.zs'
            }]
        };

        const enriched = await attachUnderstandingToCodebaseReport(baseReport, tempDir, {
            platformRoot: tempDir,
            understandingMode: 'deterministic'
        });

        expect(enriched.codeUnderstanding).toBeDefined();
        expect(enriched.codeUnderstanding.fileInsights.length).toBeGreaterThan(0);
        expect(enriched.codeUnderstanding.layersAvailable).toContain('semantic');
    });

    test('zscript mod report extracts CVAR map and class hierarchy', async () => {
        const modRoot = path.join(tempDir, 'R3D_LITE_MOD');
        await fs.promises.mkdir(path.join(modRoot, 'zscript', 'systems'), { recursive: true });
        await fs.promises.writeFile(path.join(modRoot, 'CVARINFO'), [
            'user float r3d_lite_intensity = 750.0;',
            'user float r3d_lite_player_intensity = 1.0;'
        ].join('\n'), 'utf8');
        await fs.promises.writeFile(path.join(modRoot, 'zscript', 'systems', 'UnifiedLightingHandler.zs'), [
            'class UnifiedLightingHandler : EventHandler {',
            '  private float masterIntensity;',
            '  void UpdateCVARs() {',
            '    CVar intensityCVar = CVar.FindCVar("r3d_lite_intensity");',
            '    if (intensityCVar) masterIntensity = intensityCVar.GetFloat();',
            '  }',
            '}'
        ].join('\n'), 'utf8');

        const { generateZscriptModReport } = require('../../server/lib/code-understanding');
        const report = await generateZscriptModReport(modRoot, { focus: 'lighting-intensity' });

        expect(report.type).toBe('zscript-mod-report');
        expect(report.cvars.cvars.r3d_lite_intensity).toBeDefined();
        expect(report.cvars.cvars.r3d_lite_intensity.usedIn.length).toBeGreaterThan(0);
        expect(report.structure.class_hierarchy.classCount).toBeGreaterThan(0);
        expect(report.function_analysis['UnifiedLightingHandler.zs.UpdateCVARs']).toBeDefined();
        expect(report.problem_diagnosis.cvar_candidates).toContain('r3d_lite_intensity');
    });

    test('ZScriptParser extracts classes and GZDoom API usage', async () => {
        const { ZScriptParser } = require('../../server/lib/parsers/zscript-parser');
        const parser = new ZScriptParser();
        const content = [
            'class UnifiedLightingHandler : EventHandler {',
            '  void UpdateCVARs() {',
            '    CVar c = CVar.FindCVar("r3d_lite_intensity");',
            '    A_Light("LIGHT");',
            '  }',
            '}'
        ].join('\n');

        const parsed = parser.parse(content, { filePath: 'zscript/systems/UnifiedLightingHandler.zs' });

        expect(parsed.classes).toHaveLength(1);
        expect(parsed.classes[0].parentClass).toBe('EventHandler');
        expect(parsed.gzdoomAPI.some((a) => a.id === 'cvar')).toBe(true);
        expect(parsed.summary.purpose).toMatch(/light|handler/i);
    });
});
