#!/usr/bin/env node
/**
 * Strip Cascade/GGUF legacy routes from simplebeacon-server.js
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'simplebeacon-server.js');
let src = fs.readFileSync(filePath, 'utf8');

// Header
src = src.replace(
  /\/\*\*\s*\n \* Simple GGUF Dashboard Server[\s\S]*?\*\//,
  `/**
 * Simplebeacon Server
 * Express server for Simplebeacon landing, dashboard, and scan APIs
 */`
);

src = src.replace(/gguf-dashboard-server\.js/g, 'simplebeacon-server.js');
src = src.replace(/GGUF Dashboard server/g, 'Simplebeacon server');
src = src.replace(/GGUF Dashboard WebSocket/g, 'Simplebeacon WebSocket');
src = src.replace(/legacy GGUF WebSocket/g, 'legacy Simplebeacon WebSocket');
src = src.replace(/Failed to start GGUF dashboard server/g, 'Failed to start Simplebeacon server');

// Remove GGUF mock data constants and loaders (through sendGgufMockAnalysisReport)
src = src.replace(
  /const GGUF_MOCK_ANALYSIS_PATH[\s\S]*?async function sendGgufMockAnalysisReport[\s\S]*?\n\}\n\n/,
  ''
);

// Remove cascade-only requires
const cascadeRequires = [
  'GGUFRoadmapAnalyzer',
  'WebsiteAnalyzer',
  'DirectoryAnalyzer',
  'setupExportAPIs',
  'setupDevelopmentRoadmapAPIs',
  'setupAIRoadmapReportAPIs',
  'AIAnalysisAPI',
  'ReportsAPI',
  'registerDynamicRoadmapApi',
  'setupURLAnalyzerAPIs',
  'setupRoadmapBuilderAPIs',
  'GlobalContextManager'
];
for (const name of cascadeRequires) {
  src = src.replace(new RegExp(`const .*${name}.*= require\\([^;]+;\\n`, 'g'), '');
}

// Remove GlobalContextManager init
src = src.replace(
  /\/\/ Initialize Global Context Manager[\s\S]*?const globalContextManager = new GlobalContextManager[\s\S]*?\n\n/,
  ''
);

// Remove legacy dashboard fallback
src = src.replace(
  /  const legacyPath = path\.join\(webRoot, 'dashboard-new\.html'\);[\s\S]*?return res\.status\(404\)\.send\('Dashboard not found'\);/,
  `  return res.status(404).send('Simplebeacon dashboard not found');`
);

// Remove sample data routes for cascade
src = src.replace(
  /app\.get\('\/data\/ai-roadmap-sample\.json'[\s\S]*?app\.get\('\/data\/gguf-development-roadmap-report\.json'[\s\S]*?\}\);\n\n/,
  ''
);

// Remove global context middleware
src = src.replace(
  /\/\/ Global Context Middleware[\s\S]*?res\.locals\.globalContext = globalContextManager\.getContext\(\);\n  next\(\);\n\}\);\n\n/,
  ''
);

// Remove GGUF API block through issue resolution model route start
src = src.replace(
  /\/\/ GGUF Analysis API[\s\S]*?(?=app\.use\(\(req, res, next\) => \{\n  if \(!internalDashboard\))/,
  ''
);

// Remove remaining gguf routes if any before marketing landing comment
src = src.replace(
  /\/\/ Marketing landing lives at \/\s*\napp\.get\('\/coming-soon'/,
  `// Marketing landing lives at /\napp.get('/coming-soon'`
);

// Remove legacy tool page routes
src = src.replace(
  /\/\/ Serve the context search page[\s\S]*?\/\/ Global Context API Endpoints/,
  '// Global Context API Endpoints (removed — Cascade legacy)\n/* removed */'
);

// Remove global context + website analyzer + gguf roadmap APIs through Phase 2 bootstrap
src = src.replace(
  /\/\/ Global Context API Endpoints[\s\S]*?\/\/ Phase 2 bootstrap \+ dashboard stub APIs/,
  '// Phase 2 bootstrap + dashboard stub APIs'
);

// Remove cascade API setup calls
src = src.replace(/\n\/\/ Setup export APIs[\s\S]*?const aiAnalysisAPI = new AIAnalysisAPI[\s\S]*?\n\n/, '\n');

// Remove ai-analysis routes through setupAIRoadmapReportAPIs
src = src.replace(
  /\/\/ Get available analysis types[\s\S]*?setupAIRoadmapReportAPIs\(app\);\n\n/,
  ''
);

// Remove GGUF issues API block in bootstrap
src = src.replace(
  /\n        if \(process.env\.ENABLE_GGUF_ISSUES_API !== 'false'\) \{[\s\S]*?\n        \}\n/,
  '\n'
);

// Remove activeAnalyses if declared
src = src.replace(/const activeAnalyses = new Map\(\);\n?/g, '');

// Clean startup logs
src = src.replace(/console\.log\(`📊 Legacy platform dashboard at:[^`]+`\);\n/, '');
src = src.replace(/console\.log\(`🔧 API endpoints available at:[^`]+`\);\n/, '');
src = src.replace(/console\.log\(`🔍 Global Context API available at:[^`]+`\);\n/, '');
src = src.replace(/console\.log\(`📤 Export APIs available at:[^`]+`\);\n/, '');
src = src.replace(/console\.log\(`🤖 AI Analysis API available at:[^`]+`\);\n/, '');
src = src.replace(/console\.log\(`📊 Reports API available at:[^`]+`\);\n/, '');
src = src.replace(/console\.log\(`🗺️ Dynamic Roadmap API available at:[^`]+`\);\n/, '');

// Remove references to deleted path constants in remaining code
src = src.replace(/AI_ROADMAP_REPORT_PATH|GGUF_ROADMAP_DATA_PATH|ISSUE_RESOLUTION_PATH|CODE_GENERATION_PATH/g, 'null');

// Remove orphaned helper functions for cascade data
for (const fn of [
  'loadIssueResolutionModel',
  'loadCodeGenerationModel',
  'sendCodeGenerationModel',
  'loadAIRoadmapReport',
  'loadGgufRoadmapData',
  'sendAIRoadmapReport',
  'sendIssueResolutionModel'
]) {
  src = src.replace(new RegExp(`async function ${fn}[\\s\\S]*?\\n\\}\\n\\n`, 'g'), '');
}

fs.writeFileSync(filePath, src);
console.log('Stripped cascade/GGUF code from simplebeacon-server.js');

// Validate syntax
try {
  require(path.resolve(filePath));
} catch (e) {
  if (e.code === 'MODULE_NOT_FOUND' || e.message.includes('Cannot find module')) {
    console.log('Syntax OK (runtime deps may load on start)');
  } else if (e instanceof SyntaxError) {
    console.error('Syntax error:', e.message);
    process.exit(1);
  }
}
