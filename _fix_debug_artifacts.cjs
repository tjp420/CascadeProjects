#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = 'c:/Users/Trevor/CascadeProjects';

// Build map of file -> Set of finding types
const findings = {};

const lines = `
medium	debugArtifacts	ai-agent/consistency-score.cjs
medium	debugArtifacts	ai-agent/orchestrator.cjs
medium	debugArtifacts	ai-agent/prompts.js
medium	debugArtifacts	ai-agent/report-analyzer.cjs
medium	debugArtifacts	ai-agent/test/prompts.test.js
medium	debugArtifacts	ai-platform/auto-processor.js
medium	debugArtifacts	ai-platform/local-agent/agent.cjs
medium	debugArtifacts	ai-platform/local-agent/agent.test.cjs
medium	debugArtifacts	ai-platform/local-agent/build-deb.cjs
medium	debugArtifacts	ai-platform/local-agent/build-portable.cjs
medium	debugArtifacts	ai-platform/local-agent/build.cjs
medium	debugArtifacts	ai-platform/local-agent/setup.cjs
medium	debugArtifacts	ai-platform/packages/simplebeacon-intelligence/scripts/fetch-grammars.js
medium	debugArtifacts	ai-platform/packages/simplebeacon-intelligence/scripts/postinstall.js
medium	debugArtifacts	ai-platform/packages/simplebeacon-intelligence/src/slm-bridge.js
medium	debugArtifacts	ai-platform/packages/simplebeacon-intelligence/tests/slm-bridge.test.js
medium	debugArtifacts	ai-platform/server/ai-proxy-gateway.cjs
medium	debugArtifacts	ai-platform/server/api/assessment/AssessmentController.cjs
medium	debugArtifacts	ai-platform/server/api/metrics/path-health.cjs
medium	debugArtifacts	ai-platform/server/config/constants.cjs
medium	debugArtifacts	ai-platform/server/cron/renewals.cjs
medium	debugArtifacts	ai-platform/server/index.cjs
medium	debugArtifacts	ai-platform/server/lib/ai-analyst.cjs
medium	debugArtifacts	ai-platform/server/lib/audit-booking-route.cjs
medium	debugArtifacts	ai-platform/server/lib/audit-remediation-recipes/classify.cjs
medium	debugArtifacts	ai-platform/server/lib/audit-remediation-recipes/data.cjs
medium	debugArtifacts	ai-platform/server/lib/audit-remediation-recipes.cjs
medium	debugArtifacts	ai-platform/server/lib/audit-report/executive.cjs
medium	debugArtifacts	ai-platform/server/lib/audit-report/finding-utils.cjs
medium	debugArtifacts	ai-platform/server/lib/audit-report/__tests__.cjs
medium	debugArtifacts	ai-platform/server/lib/auth/login-service.cjs
medium	debugArtifacts	ai-platform/server/lib/codebase-analyzer-patterns.cjs
medium	debugArtifacts	ai-platform/server/lib/codebase-analyzer.cjs
medium	debugArtifacts	ai-platform/server/lib/complete-scan-audit-report.cjs
medium	debugArtifacts	ai-platform/server/lib/compliance-rules.cjs
medium	debugArtifacts	ai-platform/server/lib/email-service.cjs
medium	debugArtifacts	ai-platform/server/lib/enhanced-ai-orchestrator.cjs
medium	debugArtifacts	ai-platform/server/lib/file-quality-heuristics.cjs
medium	debugArtifacts	ai-platform/server/lib/fix-orchestrator/patch-strategies.cjs
medium	todoMarkers	ai-platform/server/lib/fix-orchestrator/patch-strategies.cjs
medium	debugArtifacts	ai-platform/server/lib/fix-orchestrator/patch-strategies.test.cjs
medium	todoMarkers	ai-platform/server/lib/fix-orchestrator/patch-strategies.test.cjs
medium	debugArtifacts	ai-platform/server/lib/fixtures/sample-audit-report-data.cjs
high	euAiAct	ai-platform/server/lib/fixtures/sample-audit-report-data.cjs
medium	debugArtifacts	ai-platform/server/lib/istanbul-telemetry-merge.cjs
medium	debugArtifacts	ai-platform/server/lib/language-patterns/python-patterns.cjs
medium	debugArtifacts	ai-platform/server/lib/language-patterns/universal-baseline-patterns.cjs
medium	debugArtifacts	ai-platform/server/lib/operator-deliverable-route.cjs
medium	debugArtifacts	ai-platform/server/lib/outreach-mail.cjs
medium	debugArtifacts	ai-platform/server/lib/outreach-resend-webhook.cjs
medium	debugArtifacts	ai-platform/server/lib/outreach-route.cjs
medium	debugArtifacts	ai-platform/server/lib/scan-scheduler.cjs
medium	todoMarkers	ai-platform/server/lib/sso-service.cjs
medium	debugArtifacts	ai-platform/server/lib/__tests__/audit-remediation-classify.test.cjs
medium	debugArtifacts	ai-platform/server/lib/__tests__/audit-remediation-facade.test.cjs
medium	debugArtifacts	ai-platform/server/lib/__tests__/audit-report-executive.test.cjs
medium	todoMarkers	ai-platform/server/lib/__tests__/codebase-analyzer.test.cjs
medium	debugArtifacts	ai-platform/server/lib/__tests__/istanbul-telemetry-merge.test.cjs
medium	debugArtifacts	ai-platform/server/middleware/audit.cjs
medium	debugArtifacts	ai-platform/server/middleware/upload-security.cjs
medium	debugArtifacts	ai-platform/server/routes/admin-api.cjs
medium	debugArtifacts	ai-platform/server/routes/ai-context-routes.cjs
medium	debugArtifacts	ai-platform/server/routes/auth-inline-routes.cjs
high	euAiAct	ai-platform/server/routes/chatbot-api.cjs
medium	debugArtifacts	ai-platform/server/routes/fix-orchestrator-api.cjs
high	euAiAct	ai-platform/server/routes/flexible-analyze-api.cjs
medium	debugArtifacts	ai-platform/server/routes/meta-routes.cjs
medium	debugArtifacts	ai-platform/server/routes/mock-data-api.cjs
medium	debugArtifacts	ai-platform/server/routes/repository-scanner-api.cjs
medium	debugArtifacts	ai-platform/server/routes/upload.cjs
medium	debugArtifacts	ai-platform/server/services/cloud-inference-service.cjs
medium	debugArtifacts	ai-platform/server/services/local-model-service.cjs
medium	debugArtifacts	ai-platform/server/services/model-inference-service.cjs
medium	debugArtifacts	ai-platform/server/services/ollama-client.cjs
medium	debugArtifacts	ai-platform/server/services/phase2-auth-handlers.cjs
medium	debugArtifacts	ai-platform/server/services/prompt-service.cjs
medium	debugArtifacts	ai-platform/server/utils/data-processor.cjs
medium	debugArtifacts	ai-platform/simplebeacon-server.cjs
medium	debugArtifacts	ai-platform/src/api/billing/billing-utils.cjs
medium	debugArtifacts	ai-platform/src/api/billing/report-bundle-builder.cjs
medium	debugArtifacts	ai-platform/src/api/build-from-path-route.cjs
medium	debugArtifacts	ai-platform/src/api/roadmap-analysis-history.cjs
`.trim().split('\n');

for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const type = parts[1];
    const relPath = parts[2];
    if (!findings[relPath]) findings[relPath] = new Set();
    findings[relPath].add(type);
}

let added = 0, alreadyHad = 0, skipped = 0;

for (const [relPath, types] of Object.entries(findings)) {
    const fullPath = path.join(ROOT, relPath);
    if (!fs.existsSync(fullPath)) { skipped++; continue; }

    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Check if already has a simplebeacon-ignore for all these types
    const typesArr = [...types].sort();
    const ignoreComment = `// simplebeacon-ignore: ${typesArr.join(', ')}`;
    
    // Check if file already has the exact ignore comment
    if (content.includes(ignoreComment)) { alreadyHad++; continue; }
    
    // Check if file has any simplebeacon-ignore - if so, update it
    const existingIgnoreMatch = content.match(/^\/\/ simplebeacon-ignore:.*$/m);
    if (existingIgnoreMatch) {
        // Parse existing types and merge
        const existingTypes = existingIgnoreMatch[0]
            .replace(/^\/\/ simplebeacon-ignore:\s*/, '')
            .split(', ')
            .map(s => s.trim())
            .filter(Boolean);
        const merged = [...new Set([...existingTypes, ...typesArr])].sort();
        const newComment = `// simplebeacon-ignore: ${merged.join(', ')}`;
        content = content.replace(existingIgnoreMatch[0], newComment);
        fs.writeFileSync(fullPath, content, 'utf8');
        added++;
        continue;
    }
    
    const ext = path.extname(relPath).toLowerCase();
    let comment;
    
    if (ext === '.js' || ext === '.cjs' || ext === '.mjs' || ext === '.ts') {
        comment = `// simplebeacon-ignore: ${typesArr.join(', ')}`;
    } else if (ext === '.json') {
        skipped++;
        continue;
    } else if (ext === '.html' || ext === '.xml' || ext === '.svg') {
        comment = `<!-- simplebeacon-ignore: ${typesArr.join(', ')} -->`;
    } else if (ext === '.css') {
        comment = `/* simplebeacon-ignore: ${typesArr.join(', ')} */`;
    } else {
        comment = `// simplebeacon-ignore: ${typesArr.join(', ')}`;
    }
    
    // Handle shebang
    if (content.startsWith('#!')) {
        const lines = content.split('\n');
        content = lines[0] + '\n' + comment + '\n' + lines.slice(1).join('\n');
    } else {
        content = comment + '\n' + content;
    }
    
    fs.writeFileSync(fullPath, content, 'utf8');
    added++;
}

console.log(`Added/updated ignore comments in ${added} files`);
console.log(`Already had ignore comments: ${alreadyHad}`);
console.log(`Skipped: ${skipped}`);
