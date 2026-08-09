// simplebeacon-ignore: SBOM generator utility
/**
 * SBOM Generator — produces a CycloneDX 1.5 JSON Software Bill of Materials
 * from the project's lockfile and package.json.
 *
 * CycloneDX is the standard SBOM format required by US Executive Order 14028
 * and increasingly by enterprise procurement teams.
 *
 * Output: .simplebeacon/sbom.cyclonedx.json
 */

const fs = require('fs');
const path = require('path');
const { parseLockfile, readPackageJson } = require('../lib/lockfile-parser');

/**
 * Generate a CycloneDX 1.5 SBOM from the project's lockfile.
 * @param {string} rootDir - Project root directory
 * @param {{ outputPath?: string, includeDev?: boolean }} [options]
 * @returns {Promise<{ scanned: number, findings: number, issues: Array, summary: object }>}
 */
async function generateSbom(rootDir, options = {}) {
    const includeDev = options.includeDev !== false;
    const defaultOutputPath = path.join(rootDir, '.simplebeacon', 'sbom.cyclonedx.json');
    const outputPath = options.outputPath || defaultOutputPath;

    const lockfileResult = parseLockfile(rootDir);
    const pkgJson = readPackageJson(rootDir);

    if (!lockfileResult) {
        return {
            scanned: 0,
            findings: 0,
            issues: [],
            summary: {
                lockfileFound: false,
                componentCount: 0,
                outputPath: null,
                format: 'CycloneDX',
                version: '1.5',
            },
        };
    }

    const packages = lockfileResult.packages.filter((pkg) => {
        if (!includeDev && pkg.dev) return false;
        return true;
    });

    // Build CycloneDX components
    const components = packages.map((pkg) => {
        const component = {
            type: 'library',
            'bom-ref': `pkg:npm/${pkg.name}@${pkg.version}`,
            name: pkg.name,
            version: pkg.version,
            purl: `pkg:npm/${pkg.name}@${pkg.version}`,
        };
        if (pkg.integrity) {
            component.hashes = [
                { alg: pkg.integrity.startsWith('sha512') ? 'SHA-512' : 'SHA-256', content: pkg.integrity.split('-')[1] || '' },
            ];
        }
        if (pkg.licenses && pkg.licenses.length > 0) {
            component.licenses = pkg.licenses.map((l) => ({ license: { name: l } }));
        }
        return component;
    });

    // Build root component from package.json
    const metadata = {
        timestamp: new Date().toISOString(),
        tools: [
            {
                vendor: 'SimpleBeacon',
                name: 'simplebeacon-cli',
                version: '1.0.0',
            },
        ],
    };

    if (pkgJson) {
        metadata.component = {
            type: 'application',
            'bom-ref': `pkg:npm/${pkgJson.name || 'root'}@${pkgJson.version || '0.0.0'}`,
            name: pkgJson.name || path.basename(rootDir),
            version: pkgJson.version || '0.0.0',
        };
        if (pkgJson.license) {
            metadata.component.licenses = [{ license: { name: pkgJson.license } }];
        }
    }

    const bom = {
        bomFormat: 'CycloneDX',
        specVersion: '1.5',
        serialNumber: `urn:uuid:${generateUuid()}`,
        version: 1,
        metadata,
        components,
    };

    // Write SBOM file
    try {
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        fs.writeFileSync(outputPath, JSON.stringify(bom, null, 2), 'utf8');
    } catch (err) {
        return {
            scanned: packages.length,
            findings: 0,
            issues: [{
                type: 'sbom-write-error',
                severity: 'medium',
                rule: 'sbom-generator',
                filePath: outputPath,
                line: 0,
                impact: `Failed to write SBOM: ${err.message}`,
                fix: 'Check write permissions for the .simplebeacon/ directory',
                count: 1,
                metadata: { error: err.message },
            }],
            summary: {
                lockfileFound: true,
                componentCount: components.length,
                outputPath,
                format: 'CycloneDX',
                version: '1.5',
                writeError: true,
            },
        };
    }

    // Return a single info-level finding pointing to the generated SBOM
    const issues = [{
        type: 'sbom-generated',
        severity: 'info',
        rule: 'sbom-generator',
        filePath: path.relative(rootDir, outputPath) || 'sbom.cyclonedx.json',
        line: 0,
        impact: `CycloneDX 1.5 SBOM generated with ${components.length} components`,
        fix: 'Attach this SBOM to your compliance evidence package (SOC 2, EU AI Act, EO 14028)',
        count: 1,
        metadata: {
            format: 'CycloneDX',
            version: '1.5',
            componentCount: components.length,
            outputPath: path.relative(rootDir, outputPath) || 'sbom.cyclonedx.json',
            lockfileFormat: lockfileResult.format,
        },
    }];

    return {
        scanned: packages.length,
        findings: 1,
        issues,
        summary: {
            lockfileFound: true,
            lockfileFormat: lockfileResult.format,
            componentCount: components.length,
            outputPath: path.relative(rootDir, outputPath) || 'sbom.cyclonedx.json',
            format: 'CycloneDX',
            version: '1.5',
        },
    };
}

/**
 * Generate a simple UUID v4 (no crypto dependency needed for SBOM serial).
 * @returns {string}
 */
function generateUuid() {
    const chars = '0123456789abcdef';
    let uuid = '';
    for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) {
            uuid += '-';
        } else if (i === 14) {
            uuid += '4';
        } else if (i === 19) {
            uuid += chars[Math.floor(Math.random() * 4) + 8];
        } else {
            uuid += chars[Math.floor(Math.random() * 16)];
        }
    }
    return uuid;
}

module.exports = {
    generateSbom,
};
