// simplebeacon-ignore: Test file for scanner rules — all findings are expected test fixtures
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { generateSbom } = require('../src/rules/sbom-generator');

test('generateSbom produces CycloneDX 1.5 JSON with components', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-sbom-'));
    fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify({
        lockfileVersion: 3,
        packages: {
            'node_modules/lodash': { version: '4.17.21', resolved: 'https://registry.npmjs.org/lodash.tgz', integrity: 'sha512-abc123' },
            'node_modules/express': { version: '4.19.2' }
        }
    }));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
        name: 'test-app',
        version: '1.0.0',
        license: 'MIT'
    }));
    const result = await generateSbom(dir);
    assert.ok(result.summary.lockfileFound);
    assert.equal(result.summary.componentCount, 2);
    assert.equal(result.summary.format, 'CycloneDX');
    assert.equal(result.summary.version, '1.5');
    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0].type, 'sbom-generated');
    assert.equal(result.issues[0].severity, 'info');

    // Verify the SBOM file was written
    const sbomPath = path.join(dir, '.simplebeacon', 'sbom.cyclonedx.json');
    assert.ok(fs.existsSync(sbomPath), 'SBOM file should exist');
    const sbom = JSON.parse(fs.readFileSync(sbomPath, 'utf8'));
    assert.equal(sbom.bomFormat, 'CycloneDX');
    assert.equal(sbom.specVersion, '1.5');
    assert.ok(Array.isArray(sbom.components));
    assert.equal(sbom.components.length, 2);
    assert.ok(sbom.components.some((c) => c.name === 'lodash'));
    assert.ok(sbom.components.some((c) => c.name === 'express'));
    assert.ok(sbom.metadata.component.name === 'test-app');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('generateSbom returns empty when no lockfile', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-sbom-none-'));
    const result = await generateSbom(dir);
    assert.equal(result.summary.lockfileFound, false);
    assert.equal(result.summary.componentCount, 0);
    assert.equal(result.issues.length, 0);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('generateSbom respects includeDev option', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-sbom-dev-'));
    fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify({
        lockfileVersion: 3,
        packages: {
            'node_modules/lodash': { version: '4.17.21' },
            'node_modules/jest': { version: '29.0.0', dev: true }
        }
    }));
    const withDev = await generateSbom(dir, { includeDev: true });
    assert.equal(withDev.summary.componentCount, 2);
    const withoutDev = await generateSbom(dir, { includeDev: false });
    assert.equal(withoutDev.summary.componentCount, 1);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('generateSbom components have correct purl format', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-sbom-purl-'));
    fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify({
        lockfileVersion: 3,
        packages: {
            'node_modules/lodash': { version: '4.17.21' }
        }
    }));
    const _result = await generateSbom(dir);
    const sbomPath = path.join(dir, '.simplebeacon', 'sbom.cyclonedx.json');
    const sbom = JSON.parse(fs.readFileSync(sbomPath, 'utf8'));
    const lodash = sbom.components.find((c) => c.name === 'lodash');
    assert.equal(lodash.purl, 'pkg:npm/lodash@4.17.21');
    assert.equal(lodash['bom-ref'], 'pkg:npm/lodash@4.17.21');
    assert.equal(lodash.type, 'library');
    fs.rmSync(dir, { recursive: true, force: true });
});
