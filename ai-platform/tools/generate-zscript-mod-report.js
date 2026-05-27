#!/usr/bin/env node
/**
 * Generate ZScript mod report (structure + CVAR map + intensity diagnostics).
 *
 * Usage:
 *   node tools/generate-zscript-mod-report.js "E:\Ai\Games\Doom\...\R3D_LITE_MOD"
 *   node tools/generate-zscript-mod-report.js "path\to\mod" --out report.json
 */

const fs = require('fs');
const path = require('path');
const { generateZscriptModReport } = require('../server/lib/code-understanding/zscript-mod-report');

async function main() {
    const args = process.argv.slice(2).filter((a) => a !== '--');
    const outIdx = args.indexOf('--out');
    const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
    const projectPath = args.find((a, i) => i !== outIdx && i !== outIdx + 1 && !a.startsWith('--'));

    if (!projectPath) {
        console.error('Usage: node tools/generate-zscript-mod-report.js <projectPath> [--out report.json]');
        process.exit(1);
    }

    const resolved = path.resolve(projectPath);
    if (!fs.existsSync(resolved)) {
        console.error(`Path not found: ${resolved}`);
        process.exit(1);
    }

    const report = await generateZscriptModReport(resolved, { focus: 'lighting-intensity' });
    const json = JSON.stringify(report, null, 2);

    if (outPath) {
        await fs.promises.writeFile(path.resolve(outPath), json, 'utf8');
        console.log(`Wrote ${path.resolve(outPath)}`);
        console.log(`Files: ${report.structure.filesScanned}, CVARs: ${Object.keys(report.cvars.cvars).length}`);
    } else {
        console.log(json);
    }
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
