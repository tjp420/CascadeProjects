import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scanGzdoomMod, isGzdoomFile } from '../gzdoomScanner';
import { installRulePack, listAvailablePacks } from '../rulePackInstaller';

describe('GZDoom Rule Pack', () => {
  describe('isGzdoomFile', () => {
    it('recognizes .zs files', () => {
      expect(isGzdoomFile('src/weapon.zs')).toBe(true);
    });
    it('recognizes .zscript files', () => {
      expect(isGzdoomFile('src/player.zscript')).toBe(true);
    });
    it('recognizes .cvarinfo files', () => {
      expect(isGzdoomFile('config.cvarinfo')).toBe(true);
    });
    it('recognizes .mapinfo files', () => {
      expect(isGzdoomFile('maps.mapinfo')).toBe(true);
    });
    it('recognizes .bat launch scripts', () => {
      expect(isGzdoomFile('launch.bat')).toBe(true);
    });
    it('recognizes .pk3 mod archives', () => {
      expect(isGzdoomFile('mymod.pk3')).toBe(true);
    });
    it('does not match .ts files', () => {
      expect(isGzdoomFile('src/app.ts')).toBe(false);
    });
    it('does not match .js files', () => {
      expect(isGzdoomFile('src/app.js')).toBe(false);
    });
  });

  describe('scanGzdoomMod', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gzdoom-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('detects missing asset references', () => {
      // Create a ZScript file that references a non-existent PK3
      const zsContent = 'class MyWeapon : Actor {\n  String assetRef = "textures.pk3";\n}';
      fs.writeFileSync(path.join(tmpDir, 'weapon.zs'), zsContent);

      const result = scanGzdoomMod(tmpDir);
      const missingAssets = result.assetReferences.filter((a) => !a.exists);
      expect(missingAssets.length).toBeGreaterThan(0);
      expect(missingAssets[0].fileName).toBe('textures.pk3');
    });

    it('finds existing asset references', () => {
      // Create a PK3 file and a script that references it
      fs.writeFileSync(path.join(tmpDir, 'mymod.pk3'), 'dummy');
      const zsContent = 'String ref = "mymod.pk3";';
      fs.writeFileSync(path.join(tmpDir, 'main.zs'), zsContent);

      const result = scanGzdoomMod(tmpDir);
      const found = result.assetReferences.filter((a) => a.exists);
      expect(found.length).toBeGreaterThan(0);
      expect(found[0].fileName).toBe('mymod.pk3');
    });

    it('detects CVAR conflicts across files', () => {
      // Two config files setting the same CVAR to different values
      fs.writeFileSync(path.join(tmpDir, 'autoexec.cfg'), 'set r_drawvoxels 1\n');
      fs.writeFileSync(path.join(tmpDir, 'user.cfg'), 'set r_drawvoxels 0\n');

      const result = scanGzdoomMod(tmpDir);
      const conflicts = result.cvarConflicts.filter((c) => c.valuesConflict);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].cvarName).toBe('r_drawvoxels');
    });

    it('reports info for duplicate CVARs with same value', () => {
      fs.writeFileSync(path.join(tmpDir, 'autoexec.cfg'), 'set r_skybox 1\n');
      fs.writeFileSync(path.join(tmpDir, 'user.cfg'), 'set r_skybox 1\n');

      const result = scanGzdoomMod(tmpDir);
      const duplicates = result.cvarConflicts.filter((c) => !c.valuesConflict);
      expect(duplicates.length).toBeGreaterThan(0);
    });

    it('returns empty results for non-existent directory', () => {
      const result = scanGzdoomMod('/nonexistent/path');
      expect(result.assetReferences.length).toBe(0);
      expect(result.cvarConflicts.length).toBe(0);
      expect(result.issues.length).toBe(0);
    });

    it('generates issues for missing assets', () => {
      fs.writeFileSync(path.join(tmpDir, 'script.zs'), 'String ref = "missing.pk3";\n');

      const result = scanGzdoomMod(tmpDir);
      const missingIssues = result.issues.filter((i) => i.type === 'GZ-ASSET-MISSING');
      expect(missingIssues.length).toBeGreaterThan(0);
      expect(missingIssues[0].severity).toBe('warning');
    });

    it('generates issues for conflicting CVARs', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.cfg'), 'set vid_gamma 1.5\n');
      fs.writeFileSync(path.join(tmpDir, 'b.cfg'), 'set vid_gamma 2.0\n');

      const result = scanGzdoomMod(tmpDir);
      const conflictIssues = result.issues.filter((i) => i.type === 'GZ-CVAR-CONFLICT');
      expect(conflictIssues.length).toBeGreaterThan(0);
      expect(conflictIssues[0].severity).toBe('warning');
    });

    it('skips node_modules and .git directories', () => {
      fs.mkdirSync(path.join(tmpDir, 'node_modules'));
      fs.writeFileSync(path.join(tmpDir, 'node_modules', 'lib.zs'), 'String ref = "missing.pk3";\n');
      fs.mkdirSync(path.join(tmpDir, '.git'));
      fs.writeFileSync(path.join(tmpDir, '.git', 'config.zs'), 'String ref = "also-missing.pk3";\n');

      const result = scanGzdoomMod(tmpDir);
      expect(result.assetReferences.length).toBe(0);
    });
  });

  describe('Rule Pack Installer', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rulepack-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('lists available packs including gzdoom', () => {
      const packs = listAvailablePacks();
      expect(packs).toContain('gzdoom');
    });

    it('installs the gzdoom rule pack', () => {
      const result = installRulePack('gzdoom', tmpDir);
      expect(result.installed).toBeGreaterThan(0);
      expect(result.skipped).toBe(0);
      expect(fs.existsSync(result.filePath)).toBe(true);

      const installed = JSON.parse(fs.readFileSync(result.filePath, 'utf8'));
      expect(installed.rules.length).toBeGreaterThan(0);
      // Verify some GZDoom rules are present
      const ids = installed.rules.map((r: any) => r.id);
      expect(ids).toContain('GZ-RENDER-001');
      expect(ids).toContain('GZ-DEBUG-001');
    });

    it('skips duplicate rules on re-install', () => {
      installRulePack('gzdoom', tmpDir);
      const result = installRulePack('gzdoom', tmpDir);
      expect(result.installed).toBe(0);
      expect(result.skipped).toBeGreaterThan(0);
    });

    it('merges with existing custom rules', () => {
      // Create existing custom rules
      const sbDir = path.join(tmpDir, '.simplebeacon');
      fs.mkdirSync(sbDir, { recursive: true });
      fs.writeFileSync(
        path.join(sbDir, 'custom-rules.json'),
        JSON.stringify({
          rules: [{ id: 'CUSTOM-001', regex: 'test', severity: 'warning', message: 'test' }],
          severityOverrides: [],
          allowlist: ['legacy/**'],
        }),
        'utf8'
      );

      const result = installRulePack('gzdoom', tmpDir);
      expect(result.installed).toBeGreaterThan(0);

      const installed = JSON.parse(fs.readFileSync(path.join(sbDir, 'custom-rules.json'), 'utf8'));
      // Should have both the existing custom rule and the GZDoom rules
      const ids = installed.rules.map((r: any) => r.id);
      expect(ids).toContain('CUSTOM-001');
      expect(ids).toContain('GZ-RENDER-001');
      // Should preserve existing allowlist
      expect(installed.allowlist).toContain('legacy/**');
    });

    it('throws for unknown pack name', () => {
      expect(() => installRulePack('nonexistent', tmpDir)).toThrow();
    });
  });
});
