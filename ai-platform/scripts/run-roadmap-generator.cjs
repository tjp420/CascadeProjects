#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { generateCodeRoadmap } = require('../server/lib/code-roadmap-generator.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_OUTPUT = path.resolve(__dirname, '..', 'data', 'roadmap', 'dynamic-roadmap-last-scan.json');

function usage() {
    return [
        'Usage: node ai-platform/scripts/run-roadmap-generator.cjs [options]',
        '',
        'Options:',
        '  --path <directory>  Project root to scan (default: repository root)',
        '  --out <file>        Roadmap JSON output path (default: ai-platform/data/roadmap/dynamic-roadmap-last-scan.json)',
        '  --help              Show this help'
    ].join('\n');
}

function parseArgs(argv) {
    const options = {
        projectRoot: REPO_ROOT,
        outputPath: DEFAULT_OUTPUT
    };

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--help' || argument === '-h') {
            options.help = true;
            continue;
        }

        const [flag, inlineValue] = argument.split('=', 2);
        if (flag !== '--path' && flag !== '--out') {
            throw new Error(`Unknown option: ${argument}\n\n${usage()}`);
        }

        const value = inlineValue || argv[index + 1];
        if (!value || (!inlineValue && value.startsWith('--'))) {
            throw new Error(`Missing value for ${flag}\n\n${usage()}`);
        }
        if (!inlineValue) index += 1;

        if (flag === '--path') options.projectRoot = path.resolve(value);
        if (flag === '--out') options.outputPath = path.resolve(value);
    }

    return options;
}

function phaseLabel(phase) {
    return phase?.phase || 'none';
}

function printSummary(roadmap) {
    const phases = Array.isArray(roadmap.implementationPhases) ? roadmap.implementationPhases : [];
    const active = phases.find((phase) => phase.status === 'active');
    const next = phases.find((phase) => phase.status === 'planned');
    const semanticHints = roadmap.codeAnalysis?.phase2?.semanticHints || {};
    const hints = Array.isArray(semanticHints.hints) ? semanticHints.hints : [];

    console.log(`Active phase: ${phaseLabel(active)}`);
    console.log(`Next phase: ${phaseLabel(next)}`);
    console.log(
        `semanticHints: enabled=${semanticHints.enabled === true} `
        + `mode=${semanticHints.mode || 'unknown'} hint count=${hints.length}`
    );
}

async function main(argv = process.argv.slice(2)) {
    const options = parseArgs(argv);
    if (options.help) {
        console.log(usage());
        return;
    }

    if (!fs.existsSync(options.projectRoot) || !fs.statSync(options.projectRoot).isDirectory()) {
        throw new Error(`Project path is not a directory: ${options.projectRoot}`);
    }

    const roadmap = await generateCodeRoadmap(options.projectRoot, {}, { includeFiles: true });
    await fs.promises.mkdir(path.dirname(options.outputPath), { recursive: true });
    await fs.promises.writeFile(options.outputPath, `${JSON.stringify(roadmap, null, 2)}\n`, 'utf8');
    printSummary(roadmap);
    console.log(`Roadmap written to: ${options.outputPath}`);
}

if (require.main === module) {
    main().catch((error) => {
        console.error(`Roadmap generation failed: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = {
    DEFAULT_OUTPUT,
    REPO_ROOT,
    main,
    parseArgs,
    printSummary
};
