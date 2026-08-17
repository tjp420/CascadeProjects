#!/usr/bin/env node
/**
 * Cursor preToolUse hook — paid licenses block edits when scan_snippet finds blocking issues.
 * Free tier: log-only warning (2/10 — no block).
 */
'use strict';

const fs = require('fs');
const path = require('path');

async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
}

function main() {
    readStdin().then((raw) => {
        let payload = {};
        try {
            payload = raw ? JSON.parse(raw) : {};
        } catch {
            process.stdout.write(JSON.stringify({ permission: 'allow' }));
            return;
        }

        const token = process.env.SIMPLEBEACON_LICENSE_TOKEN || '';
        const paid = Boolean(token);

        if (!paid) {
            process.stderr.write('[simplebeacon] Free tier: run scan_snippet manually (2/10 agent mode).\n');
            process.stdout.write(JSON.stringify({ permission: 'allow' }));
            return;
        }

        const toolInput = payload.tool_input || payload.input || {};
        const filePath = toolInput.path || toolInput.filePath || toolInput.target_notebook;
        const content = toolInput.contents || toolInput.new_string || toolInput.content;

        if (!content || typeof content !== 'string') {
            process.stdout.write(JSON.stringify({ permission: 'allow' }));
            return;
        }

        let scanSnippetContent;
        try {
            const cliRoot = path.join(__dirname, '..', '..', '..');
            scanSnippetContent = require(path.join(cliRoot, 'src', 'lib', 'snippet-scanner')).scanSnippetContent;
        } catch {
            try {
                scanSnippetContent = require('simplebeacon/src/lib/snippet-scanner').scanSnippetContent;
            } catch {
                process.stdout.write(JSON.stringify({ permission: 'allow' }));
                return;
            }
        }

        const result = scanSnippetContent(content, {
            filePath: filePath || 'edit.txt',
            projectRoot: process.cwd()
        });

        if (result.blockingCount > 0) {
            process.stdout.write(JSON.stringify({
                permission: 'deny',
                user_message: `SimpleBeacon blocked apply: ${result.blockingCount} high/critical finding(s). Run propose_fix via MCP, then verify_fix.`,
                agent_message: `blockingCount=${result.blockingCount}. Call propose_fix then verify_fix before applying.`
            }));
            return;
        }

        process.stdout.write(JSON.stringify({ permission: 'allow' }));
    }).catch(() => {
        process.stdout.write(JSON.stringify({ permission: 'allow' }));
    });
}

main();
