/**
 * MCP Tool Schema Auditor
 *
 * Scans all 34 tool definitions in tools.js and flags:
 * - Missing descriptions on parameters
 * - Missing enums where string types have known values
 * - Missing negative guardrails ("DO NOT USE IF...")
 * - Missing required arrays
 * - Parameters with generic names (path, config, type)
 * - Tools with short descriptions (< 20 chars)
 *
 * Usage: node scripts/audit-mcp-tools.cjs
 */
const fs = require('fs');
const path = require('path');

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

const toolsPath = path.resolve('packages/simplebeacon-cli/src/mcp/tools.js');
if (!fs.existsSync(toolsPath)) {
  console.log(`${colors.red}[FATAL] tools.js not found at ${toolsPath}${colors.reset}`);
  process.exit(1);
}

// Extract TOOL_DEFINITIONS by requiring the module
const { TOOL_DEFINITIONS } = require(toolsPath);

console.log(`${colors.cyan}====================================================${colors.reset}`);
console.log(`${colors.magenta}          MCP TOOL SCHEMA AUDITOR                    ${colors.reset}`);
console.log(`${colors.cyan}====================================================${colors.reset}\n`);

console.log(`Found ${colors.bold}${TOOL_DEFINITIONS.length}${colors.reset} tool definitions\n`);

const issues = [];
const warnings = [];

// Known enum values for specific parameters
const KNOWN_ENUMS = {
  profile: ['minimal', 'standard', 'cascade', 'executive', 'euai', 'universal'],
  format: ['json', 'markdown', 'html'],
  channel: ['blog', 'twitter', 'linkedin', 'newsletter', 'case-study', 'press-kit', 'one-pager'],
  tone: ['professional', 'casual', 'technical'],
  status: ['pending', 'in-progress', 'completed', 'blocked', 'cancelled'],
  priority: ['low', 'medium', 'high', 'critical'],
  category: ['context', 'decision', 'handoff', 'false-positive'],
  hosts: ['cursor', 'windsurf', 'continue', 'copilot', 'cline', 'aider', 'universal', 'all'],
};

// Parameters that should have negative guardrails
const GUARDRAIL_PARAMS = ['filePath', 'projectRoot', 'content', 'searchRoots'];

for (const tool of TOOL_DEFINITIONS) {
  const toolName = tool.name;
  const desc = tool.description || '';
  const schema = tool.inputSchema || {};
  const props = schema.properties || {};
  const required = schema.required || [];

  // Check: tool description length
  if (desc.length < 20) {
    issues.push(`${toolName}: description too short (${desc.length} chars)`);
  }

  // Check: no negative guardrail in description
  if (!desc.includes('no upload') && !desc.includes('No upload') &&
      !desc.includes('local') && !desc.includes('Local') &&
      !desc.includes('DO NOT') && !desc.includes('runs locally')) {
    warnings.push(`${toolName}: description lacks offline/local guardrail statement`);
  }

  // Check: missing required array
  if (!schema.required) {
    warnings.push(`${toolName}: no required array in inputSchema`);
  }

  // Check each property
  for (const [paramName, paramSchema] of Object.entries(props)) {
    // Missing description
    if (!paramSchema.description) {
      issues.push(`${toolName}.${paramName}: missing parameter description`);
    }

    // Generic parameter name
    if (['type', 'config', 'data', 'value', 'options'].includes(paramName) && paramName !== 'value') {
      warnings.push(`${toolName}.${paramName}: generic parameter name "${paramName}" — consider more specific name`);
    }

    // String type without enum where enum is known
    if (paramSchema.type === 'string' && KNOWN_ENUMS[paramName] && !paramSchema.enum) {
      issues.push(`${toolName}.${paramName}: string type with known values but no enum — should be enum: [${KNOWN_ENUMS[paramName].join(', ')}]`);
    }

    // String type without enum where enum could help
    if (paramSchema.type === 'string' && !paramSchema.enum && !paramSchema.description?.includes('default')) {
      // Check if description mentions options like "json | markdown"
      const descMatch = paramSchema.description?.match(/(\w+)\s*\|\s*(\w+)/);
      if (descMatch) {
        warnings.push(`${toolName}.${paramName}: description mentions pipe-separated options — consider using enum instead`);
      }
    }

    // projectRoot without description
    if (paramName === 'projectRoot' && !paramSchema.description) {
      issues.push(`${toolName}.${paramName}: projectRoot has no description — agents won't know the default behavior`);
    }

    // Array without items schema
    if (paramSchema.type === 'array' && !paramSchema.items) {
      issues.push(`${toolName}.${paramName}: array type without items schema`);
    }
  }

  // Check: required params not in properties
  for (const req of required) {
    if (!props[req]) {
      issues.push(`${toolName}: required param "${req}" not in properties`);
    }
  }
}

// ── Output ──────────────────────────────────────────────────────────────────
console.log(`${colors.bold}Issues (must fix):${colors.reset} ${issues.length === 0 ? colors.green + '0' : colors.red + issues.length}${colors.reset}`);
console.log(`${colors.bold}Warnings (should fix):${colors.reset} ${warnings.length === 0 ? colors.green + '0' : colors.yellow + warnings.length}${colors.reset}\n`);

if (issues.length > 0) {
  console.log(`${colors.red}── ISSUES ──${colors.reset}`);
  for (const issue of issues) {
    console.log(`  ${colors.red}\u2717${colors.reset} ${issue}`);
  }
  console.log();
}

if (warnings.length > 0) {
  console.log(`${colors.yellow}── WARNINGS ──${colors.reset}`);
  for (const warning of warnings) {
    console.log(`  ${colors.yellow}\u26a0${colors.reset} ${warning}`);
  }
  console.log();
}

// ── Per-tool summary ────────────────────────────────────────────────────────
console.log(`${colors.cyan}── PER-TOOL SUMMARY ──${colors.reset}`);
for (const tool of TOOL_DEFINITIONS) {
  const props = Object.keys(tool.inputSchema?.properties || {});
  const required = tool.inputSchema?.required || [];
  const descLen = (tool.description || '').length;
  const hasGuardrail = (tool.description || '').includes('no upload') ||
                       (tool.description || '').includes('runs locally') ||
                       (tool.description || '').includes('local');
  const status = hasGuardrail ? colors.green : colors.yellow;
  const guardIcon = hasGuardrail ? '+' : '-';
  console.log(`  ${status}[${guardIcon}]${colors.reset} ${tool.name.padEnd(28)} ${colors.dim}props: ${props.length}, required: ${required.length}, desc: ${descLen}ch${colors.reset}`);
}

console.log(`\n${colors.cyan}====================================================${colors.reset}`);
if (issues.length === 0 && warnings.length === 0) {
  console.log(`${colors.green}[SUCCESS] All tool schemas are LLM-optimized.${colors.reset}`);
  process.exit(0);
} else {
  console.log(`${colors.yellow}[ACTION NEEDED] ${issues.length} issues, ${warnings.length} warnings to address.${colors.reset}`);
  process.exit(issues.length > 0 ? 1 : 0);
}
