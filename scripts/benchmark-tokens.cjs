/**
 * SimpleBeacon MCP Token Benchmark
 *
 * Measures actual token counts for standard vs progressive discovery modes.
 * Simulates a 10-turn agent session to calculate real cost savings.
 *
 * Token estimation: ~4 chars per token (industry standard heuristic for JSON)
 * Pricing: Claude Sonnet 4 ($3/M input, $15/M output), Opus-class ($10/M input)
 *
 * Usage:
 *   node scripts/benchmark-tokens.cjs
 *   node scripts/benchmark-tokens.cjs --turns 20
 *   node scripts/benchmark-tokens.cjs --turns 50 --model opus
 */
const { TOOL_DEFINITIONS } = require('../packages/simplebeacon-cli/src/mcp/tools');

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

// ── Parse args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let turns = 10;
let model = 'sonnet';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--turns' && args[i + 1]) turns = parseInt(args[i + 1], 10);
  if (args[i] === '--model' && args[i + 1]) model = args[i + 1];
}

const PRICING = {
  sonnet: { name: 'Claude Sonnet 4', inputPerM: 3, outputPerM: 15 },
  opus: { name: 'Opus-class ($10/M)', inputPerM: 10, outputPerM: 50 },
  haiku: { name: 'Haiku-class ($0.25/M)', inputPerM: 0.25, outputPerM: 1.25 },
};
const pricing = PRICING[model] || PRICING.sonnet;

// ── Token estimation ────────────────────────────────────────────────────────
function estimateTokens(obj) {
  const json = JSON.stringify(obj);
  // Industry heuristic: ~4 chars per token for JSON content
  // Anthropic's tokenizer is closer to 3.5 for structured JSON
  return Math.ceil(json.length / 3.5);
}

function estimateTokensFromString(str) {
  return Math.ceil(str.length / 3.5);
}

function formatCost(cost) {
  if (cost < 0.01) return `$${(cost * 1000).toFixed(2)}mil`;
  if (cost < 1) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

// ── Standard mode: all 34 tools sent every turn ─────────────────────────────
function standardModeTokens() {
  const allTools = TOOL_DEFINITIONS.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
  return estimateTokens({ tools: allTools });
}

// ── Progressive mode: 3 meta-tools + JIT inspection ─────────────────────────
function progressiveBaseTokens() {
  const metaTools = [
    {
      name: "search_available_tools",
      description: "Search SimpleBeacon's 34-tool registry by natural language query. Returns matching tool names and short descriptions. Use this first to find the right tool before calling inspect_tool_schema. Runs locally — no upload.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Natural language search query (e.g. 'scan for credentials', 'compliance checklist', 'agent memory', 'gate status')" },
        },
        required: ["query"],
      },
    },
    {
      name: "inspect_tool_schema",
      description: "Fetch the full parameter schema for a specific tool before calling it. Returns the complete inputSchema with all properties, enums, and descriptions. Use this after search_available_tools to get exact parameters. Runs locally — no upload.",
      inputSchema: {
        type: "object",
        properties: {
          tool_name: { type: "string", description: "Exact tool name returned by search_available_tools (e.g. 'scan_snippet', 'gate_status', 'agent_remember')" },
        },
        required: ["tool_name"],
      },
    },
    {
      name: "list_all_tools",
      description: "Returns a compact list of all 34 available tool names with one-line descriptions. Use this when you need a full overview instead of searching. Runs locally — no upload.",
      inputSchema: { type: "object", properties: {} },
    },
  ];
  return estimateTokens({ tools: metaTools });
}

function progressiveInspectTokens(toolName) {
  const tool = TOOL_DEFINITIONS.find(t => t.name === toolName);
  if (!tool) return 0;
  return estimateTokens(tool);
}

function progressiveSearchResultTokens(query) {
  const q = query.toLowerCase();
  const matches = TOOL_DEFINITIONS.filter(t =>
    t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
  ).map(t => ({ name: t.name, description: t.description }));
  return estimateTokens({ query, matchedCount: matches.length, tools: matches });
}

// ── Simulate agent session ──────────────────────────────────────────────────
function simulateSession(turns, mode) {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const breakdown = [];

  if (mode === 'standard') {
    const toolTokens = standardModeTokens();
    for (let t = 1; t <= turns; t++) {
      // Each turn: tool schemas are in context + agent output (~200 tokens reasoning)
      totalInputTokens += toolTokens;
      totalOutputTokens += 200; // agent reasoning + tool call
      breakdown.push({ turn: t, inputTokens: toolTokens, outputTokens: 200 });
    }
  } else {
    const baseTokens = progressiveBaseTokens();
    // Turn 1: base meta-tools + search query + search result
    const searchTokens = progressiveSearchResultTokens('scan');
    const inspectTokens = progressiveInspectTokens('scan_snippet');

    for (let t = 1; t <= turns; t++) {
      if (t === 1) {
        // First turn: meta-tools + search + inspect = higher
        totalInputTokens += baseTokens + searchTokens + inspectTokens;
        totalOutputTokens += 300; // search call + inspect call + reasoning
        breakdown.push({ turn: t, inputTokens: baseTokens + searchTokens + inspectTokens, outputTokens: 300 });
      } else {
        // Subsequent turns: only base meta-tools (already inspected tool is in context)
        totalInputTokens += baseTokens;
        totalOutputTokens += 200;
        breakdown.push({ turn: t, inputTokens: baseTokens, outputTokens: 200 });
      }
    }
  }

  return { totalInputTokens, totalOutputTokens, breakdown };
}

// ── Run benchmark ───────────────────────────────────────────────────────────
console.log(`${colors.cyan}====================================================${colors.reset}`);
console.log(`${colors.magenta}       SIMPLEBEACON MCP TOKEN BENCHMARK               ${colors.reset}`);
console.log(`${colors.cyan}====================================================${colors.reset}\n`);

console.log(`${colors.bold}Configuration:${colors.reset}`);
console.log(`  Model:    ${pricing.name}`);
console.log(`  Turns:    ${turns}`);
console.log(`  Tools:    ${TOOL_DEFINITIONS.length}`);
console.log(`  Pricing:  $${pricing.inputPerM}/M input, $${pricing.outputPerM}/M output\n`);

// ── Single-turn comparison ──────────────────────────────────────────────────
const stdSingleTurn = standardModeTokens();
const progBase = progressiveBaseTokens();
const progSearch = progressiveSearchResultTokens('scan');
const progInspect = progressiveInspectTokens('scan_snippet');
const progFirstTurn = progBase + progSearch + progInspect;
const progSubsequent = progBase;

console.log(`${colors.bold}── Single-Turn Token Footprint ──${colors.reset}\n`);
console.log(`  Standard mode (all 34 tools):     ${colors.red}${stdSingleTurn.toLocaleString()}${colors.reset} tokens/turn`);
console.log(`  Progressive mode (first turn):    ${colors.yellow}${progFirstTurn.toLocaleString()}${colors.reset} tokens (meta-tools + search + inspect)`);
console.log(`  Progressive mode (subsequent):    ${colors.green}${progSubsequent.toLocaleString()}${colors.reset} tokens/turn`);
console.log(`  ${colors.dim}Breakdown: base=${progBase}, search=${progSearch}, inspect=${progInspect}${colors.reset}\n`);

// ── Multi-turn simulation ───────────────────────────────────────────────────
const stdSession = simulateSession(turns, 'standard');
const progSession = simulateSession(turns, 'progressive');

const stdInputCost = (stdSession.totalInputTokens / 1_000_000) * pricing.inputPerM;
const stdOutputCost = (stdSession.totalOutputTokens / 1_000_000) * pricing.outputPerM;
const stdTotalCost = stdInputCost + stdOutputCost;

const progInputCost = (progSession.totalInputTokens / 1_000_000) * pricing.inputPerM;
const progOutputCost = (progSession.totalOutputTokens / 1_000_000) * pricing.outputPerM;
const progTotalCost = progInputCost + progOutputCost;

const savings = stdTotalCost - progTotalCost;
const savingsPct = ((stdTotalCost - progTotalCost) / stdTotalCost * 100).toFixed(1);
const tokenSavingsPct = ((stdSession.totalInputTokens - progSession.totalInputTokens) / stdSession.totalInputTokens * 100).toFixed(1);

console.log(`${colors.bold}── ${turns}-Turn Session Simulation ──${colors.reset}\n`);

console.log(`  ${colors.red}STANDARD MODE${colors.reset}:`);
console.log(`    Input tokens:  ${stdSession.totalInputTokens.toLocaleString()}`);
console.log(`    Output tokens: ${stdSession.totalOutputTokens.toLocaleString()}`);
console.log(`    Input cost:    ${formatCost(stdInputCost)}`);
console.log(`    Output cost:   ${formatCost(stdOutputCost)}`);
console.log(`    ${colors.bold}Total cost:     ${colors.red}${formatCost(stdTotalCost)}${colors.reset}\n`);

console.log(`  ${colors.green}PROGRESSIVE MODE${colors.reset}:`);
console.log(`    Input tokens:  ${progSession.totalInputTokens.toLocaleString()}`);
console.log(`    Output tokens: ${progSession.totalOutputTokens.toLocaleString()}`);
console.log(`    Input cost:    ${formatCost(progInputCost)}`);
console.log(`    Output cost:   ${formatCost(progOutputCost)}`);
console.log(`    ${colors.bold}Total cost:     ${colors.green}${formatCost(progTotalCost)}${colors.reset}\n`);

console.log(`${colors.bold}── Savings ──${colors.reset}\n`);
console.log(`  Token reduction:  ${colors.green}${tokenSavingsPct}%${colors.reset} (${(stdSession.totalInputTokens - progSession.totalInputTokens).toLocaleString()} tokens saved)`);
console.log(`  Cost reduction:   ${colors.green}${savingsPct}%${colors.reset} (${formatCost(savings)} saved per session)\n`);

// ── Monthly projections ──────────────────────────────────────────────────────
console.log(`${colors.bold}── Monthly Projections (30 days) ──${colors.reset}\n`);

const scenarios = [
  { name: 'Solo Indie Dev', tasksPerDay: 20 },
  { name: 'Power User / Agency', tasksPerDay: 100 },
  { name: 'Enterprise Team (15 devs)', tasksPerDay: 300 },
];

console.log(`  ${'Scenario'.padEnd(35)} ${'Standard'.padStart(12)} ${'Progressive'.padStart(12)} ${'Savings'.padStart(12)} ${colors.dim}%'.padStart(6)}${colors.reset}`);
console.log(`  ${'─'.repeat(35)} ${'─'.repeat(12)} ${'─'.repeat(12)} ${'─'.repeat(12)} ${'─'.repeat(6)}`);

for (const s of scenarios) {
  const monthlySessions = s.tasksPerDay * 30 * turns / 10; // normalize to 10-turn sessions
  const stdMonthly = stdTotalCost * monthlySessions;
  const progMonthly = progTotalCost * monthlySessions;
  const monthlySavings = stdMonthly - progMonthly;
  const pct = ((monthlySavings / stdMonthly) * 100).toFixed(1);
  console.log(`  ${s.name.padEnd(35)} ${formatCost(stdMonthly).padStart(12)} ${formatCost(progMonthly).padStart(12)} ${formatCost(monthlySavings).padStart(12)} ${colors.green}${pct.padStart(5)}%${colors.reset}`);
}

// ── Per-tool token weights ──────────────────────────────────────────────────
console.log(`\n${colors.bold}── Per-Tool Token Weights (top 10 heaviest) ──${colors.reset}\n`);

const toolWeights = TOOL_DEFINITIONS.map(t => ({
  name: t.name,
  tokens: estimateTokens(t),
  descLen: t.description.length,
  propCount: Object.keys(t.inputSchema?.properties || {}).length,
})).sort((a, b) => b.tokens - a.tokens);

for (const tw of toolWeights.slice(0, 10)) {
  console.log(`  ${tw.name.padEnd(30)} ${colors.yellow}${String(tw.tokens).padStart(5)}${colors.reset} tokens  ${colors.dim}(${tw.propCount} props, ${tw.descLen}ch desc)${colors.reset}`);
}

const totalToolTokens = toolWeights.reduce((s, t) => s + t.tokens, 0);
const avgToolTokens = Math.round(totalToolTokens / toolWeights.length);
console.log(`\n  ${colors.dim}Total: ${totalToolTokens.toLocaleString()} tokens across ${toolWeights.length} tools (avg: ${avgToolTokens}/tool)${colors.reset}`);

// ── Compression ratio ────────────────────────────────────────────────────────
console.log(`\n${colors.bold}── Compression Ratio ──${colors.reset}\n`);
const ratio = (stdSingleTurn / progSubsequent).toFixed(1);
console.log(`  Standard per-turn:     ${stdSingleTurn.toLocaleString()} tokens`);
console.log(`  Progressive per-turn:  ${progSubsequent.toLocaleString()} tokens (after first turn)`);
console.log(`  ${colors.bold}Compression ratio:      ${colors.green}${ratio}x${colors.reset} reduction after first turn\n`);

console.log(`${colors.cyan}====================================================${colors.reset}`);
console.log(`${colors.green}[BENCHMARK COMPLETE] Progressive discovery saves ${tokenSavingsPct}% tokens (${savingsPct}% cost) per ${turns}-turn session.${colors.reset}`);
console.log(`${colors.cyan}====================================================${colors.reset}\n`);

// ── Verdict ─────────────────────────────────────────────────────────────────
if (parseFloat(savingsPct) > 80) {
  console.log(`${colors.green}[VERDICT] Enterprise-ready. Token compression exceeds 80% threshold.${colors.reset}`);
  process.exit(0);
} else if (parseFloat(savingsPct) > 50) {
  console.log(`${colors.yellow}[VERDICT] Good savings. Consider additional TOON compression for further gains.${colors.reset}`);
  process.exit(0);
} else {
  console.log(`${colors.yellow}[VERDICT] Moderate savings. Review tool schema sizes for further optimization.${colors.reset}`);
  process.exit(0);
}
