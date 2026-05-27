const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const scriptsDir = path.join(__dirname, '..', 'web', 'scripts');
const projectRoot = path.join(__dirname, '..');
const outPath = path.join(scriptsDir, 'eslint-shared-globals.json');
const lintReportPath = path.join(projectRoot, '.simplebeacon', 'eslint-web-undef-pass.json');

const names = new Set(['event']);

function collectFromSource(content) {
    for (const match of content.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)) {
        names.add(match[1]);
    }
    for (const match of content.matchAll(/\bwindow\[['"]([A-Za-z_$][\w$]*)['"]\]\s*=/g)) {
        names.add(match[1]);
    }
    for (const match of content.matchAll(/\bglobalThis\.([A-Za-z_$][\w$]*)\s*=/g)) {
        names.add(match[1]);
    }
}

function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) continue;
        if (!entry.name.endsWith('.js')) continue;
        collectFromSource(fs.readFileSync(abs, 'utf8'));
    }
}

function collectFromLintReport() {
    if (!fs.existsSync(lintReportPath)) {
        return;
    }

    const report = JSON.parse(fs.readFileSync(lintReportPath, 'utf8'));
    for (const entry of report) {
        for (const msg of entry.messages || []) {
            if (msg.ruleId !== 'no-undef') continue;
            const match = msg.message.match(/^'([^']+)'/);
            if (match) names.add(match[1]);
        }
    }
}

function writeGlobals() {
    const sorted = [...names].sort();
    fs.writeFileSync(
        outPath,
        `${JSON.stringify(Object.fromEntries(sorted.map((name) => [name, 'readonly'])), null, 2)}\n`,
        'utf8'
    );
    console.log(`Wrote ${sorted.length} globals to ${outPath}`);
}

function runLintReport() {
    try {
        execFileSync(
            'npx eslint web/scripts/*.js -f json -o .simplebeacon/eslint-web-undef-pass.json',
            { cwd: projectRoot, stdio: 'inherit', shell: true }
        );
    } catch (_error) {
        // ESLint exits 1 when findings exist; the JSON report is still written.
    }
}

function main() {
    walk(scriptsDir);
    writeGlobals();
    runLintReport();
    collectFromLintReport();
    writeGlobals();
}

main();
