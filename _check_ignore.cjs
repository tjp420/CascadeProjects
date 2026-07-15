const fs = require('fs');
const files = [
    'ai-agent/consistency-score.cjs','ai-agent/orchestrator.cjs','ai-agent/prompts.js',
    'ai-agent/report-analyzer.cjs','ai-agent/test/prompts.test.js',
    'ai-platform/auto-processor.js','ai-platform/local-agent/agent.cjs',
    'ai-platform/local-agent/agent.test.cjs','ai-platform/local-agent/build-deb.cjs',
    'ai-platform/local-agent/build-portable.cjs','ai-platform/local-agent/build.cjs',
    'ai-platform/local-agent/setup.cjs',
    'ai-platform/packages/simplebeacon-intelligence/scripts/fetch-grammars.js',
    'ai-platform/packages/simplebeacon-intelligence/scripts/postinstall.js',
    'ai-platform/packages/simplebeacon-intelligence/src/slm-bridge.js',
    'ai-platform/packages/simplebeacon-intelligence/tests/slm-bridge.test.js',
    'ai-platform/server/ai-proxy-gateway.cjs',
    'ai-platform/server/api/assessment/AssessmentController.cjs',
    'ai-platform/server/api/metrics/path-health.cjs',
    'ai-platform/server/config/constants.cjs','ai-platform/server/cron/renewals.cjs',
    'ai-platform/server/index.cjs','ai-platform/server/lib/ai-analyst.cjs',
    'ai-platform/server/lib/audit-booking-route.cjs',
    'ai-platform/server/lib/audit-remediation-recipes/classify.cjs',
    'ai-platform/server/lib/audit-remediation-recipes/data.cjs',
    'ai-platform/server/lib/audit-remediation-recipes.cjs',
    'ai-platform/server/lib/audit-report/executive.cjs',
    'ai-platform/server/lib/audit-report/finding-utils.cjs',
    'ai-platform/server/lib/audit-report/__tests__.cjs',
    'ai-platform/server/lib/auth/login-service.cjs',
    'ai-platform/server/lib/codebase-analyzer-patterns.cjs',
    'ai-platform/server/lib/codebase-analyzer.cjs',
    'ai-platform/server/lib/complete-scan-audit-report.cjs',
    'ai-platform/server/lib/compliance-rules.cjs',
    'ai-platform/server/lib/email-service.cjs',
    'ai-platform/server/lib/enhanced-ai-orchestrator.cjs',
    'ai-platform/server/lib/file-quality-heuristics.cjs',
    'ai-platform/server/lib/fix-orchestrator/patch-strategies.cjs',
    'ai-platform/server/lib/fix-orchestrator/patch-strategies.test.cjs',
    'ai-platform/server/lib/fixtures/sample-audit-report-data.cjs',
    'ai-platform/server/lib/istanbul-telemetry-merge.cjs',
    'ai-platform/server/lib/language-patterns/python-patterns.cjs',
    'ai-platform/server/lib/language-patterns/universal-baseline-patterns.cjs',
    'ai-platform/server/lib/operator-deliverable-route.cjs',
    'ai-platform/server/lib/outreach-mail.cjs',
    'ai-platform/server/lib/outreach-resend-webhook.cjs',
    'ai-platform/server/lib/outreach-route.cjs',
    'ai-platform/server/lib/scan-scheduler.cjs',
    'ai-platform/server/lib/sso-service.cjs',
    'ai-platform/server/lib/__tests__/audit-remediation-classify.test.cjs',
    'ai-platform/server/lib/__tests__/audit-remediation-facade.test.cjs',
    'ai-platform/server/lib/__tests__/audit-report-executive.test.cjs',
    'ai-platform/server/lib/__tests__/codebase-analyzer.test.cjs',
    'ai-platform/server/lib/__tests__/istanbul-telemetry-merge.test.cjs',
    'ai-platform/server/middleware/audit.cjs',
    'ai-platform/server/middleware/upload-security.cjs',
    'ai-platform/server/routes/admin-api.cjs',
    'ai-platform/server/routes/ai-context-routes.cjs',
    'ai-platform/server/routes/auth-inline-routes.cjs',
    'ai-platform/server/routes/chatbot-api.cjs',
    'ai-platform/server/routes/fix-orchestrator-api.cjs',
    'ai-platform/server/routes/flexible-analyze-api.cjs',
    'ai-platform/server/routes/meta-routes.cjs',
    'ai-platform/server/routes/mock-data-api.cjs',
    'ai-platform/server/routes/repository-scanner-api.cjs',
    'ai-platform/server/routes/upload.cjs',
    'ai-platform/server/services/cloud-inference-service.cjs',
    'ai-platform/server/services/local-model-service.cjs',
    'ai-platform/server/services/model-inference-service.cjs',
    'ai-platform/server/services/ollama-client.cjs',
    'ai-platform/server/services/phase2-auth-handlers.cjs',
    'ai-platform/server/services/prompt-service.cjs',
    'ai-platform/server/utils/data-processor.cjs',
    'ai-platform/simplebeacon-server.cjs',
    'ai-platform/src/api/billing/billing-utils.cjs',
    'ai-platform/src/api/billing/report-bundle-builder.cjs',
    'ai-platform/src/api/build-from-path-route.cjs',
    'ai-platform/src/api/roadmap-analysis-history.cjs'
];
let missing = [];
for (const f of files) {
    try {
        const c = fs.readFileSync(f, 'utf8');
        if (!/simplebeacon-ignore/i.test(c.substring(0, 500))) {
            missing.push(f);
        }
    } catch(e) {
        missing.push(f + ' (NOT FOUND)');
    }
}
console.log('Files missing ignore comments: ' + missing.length);
missing.forEach(f => console.log('  ' + f));
