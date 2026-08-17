'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { detectGameEngine, resolveGameEngine, VALID_ENGINES } = require('../src/lib/game-engine-registry');
const { parseUnityLog, parseGodotLog, parseGameLog } = require('../src/lib/game-log-parsers');
const { scanGameAssetIntegrity } = require('../src/rules/game-asset-integrity-patterns');
const { scanLuaScriptGraph } = require('../src/rules/lua-script-graph-patterns');
const { buildInitConfig } = require('../src/config');

describe('game engine registry', () => {
    it('lists valid engines including auto and generic', () => {
        assert.ok(VALID_ENGINES.includes('auto'));
        assert.ok(VALID_ENGINES.includes('unity'));
        assert.ok(VALID_ENGINES.includes('generic'));
    });

    it('detects godot from project.godot', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-godot-'));
        fs.writeFileSync(path.join(tmp, 'project.godot'), '[application]\nconfig/name="Test"\n');
        assert.equal(detectGameEngine(tmp), 'godot');
    });

    it('respects explicit engine override', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-generic-'));
        assert.equal(resolveGameEngine(tmp, { engine: 'unity' }), 'unity');
    });
});

describe('game log parsers', () => {
    it('parses Unity CS compile errors', () => {
        const entries = parseUnityLog('error CS0246: Type missing in Assets/Scripts/Player.cs:12');
        assert.ok(entries.some((e) => e.kind === 'compile-error'));
    });

    it('parses Godot resource errors', () => {
        const entries = parseGodotLog("ERROR: Cannot open file 'res://missing.tscn'");
        assert.ok(entries.some((e) => e.kind === 'load-error'));
    });

    it('auto-detects engine in mixed log helper', () => {
        const entries = parseGameLog('error CS0246: foo in Assets/Bar.cs:1');
        assert.ok(entries.length >= 1);
    });
});

describe('game asset integrity', () => {
    it('flags missing json asset path', async () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-asset-'));
        fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify({ texture: 'textures/missing.png' }));
        const result = await scanGameAssetIntegrity(tmp, { sourcePaths: ['.'] });
        assert.ok(result.findings >= 1);
        assert.ok(result.issues.some((i) => i.type === 'game-missing-asset'));
    });
});

describe('lua script graph', () => {
    it('flags unresolved require', async () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-lua-'));
        fs.writeFileSync(path.join(tmp, 'main.lua'), 'local x = require("missing_module")\n');
        const result = await scanLuaScriptGraph(tmp, { sourcePaths: ['.'] });
        assert.ok(result.findings >= 1);
    });
});

describe('gamedev init profile', () => {
    it('builds gamedev config with engine auto', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-init-'));
        const { config, profile } = buildInitConfig(tmp, { profile: 'gamedev' });
        assert.equal(profile, 'gamedev');
        assert.equal(config.engine, 'auto');
        assert.equal(config.gameDev.engine, 'auto');
        assert.equal(config.rules['game-asset-integrity-patterns'].enabled, true);
    });
});
