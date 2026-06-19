/**
 * SimpleBeacon Outreach Pipeline Tracker
 *
 * Tracks CCO/VP Risk prospects through the free-audit-to-paid funnel.
 * No dependencies. Run with: node outreach-prospects.js
 */

const fs = require('fs');
const path = require('path');

function log() {}
function logError() {}

const PIPELINE_FILE = path.join(__dirname, 'outreach-pipeline.json');

const STAGES = ['prospect', 'contacted', 'audit_requested', 'audit_delivered', 'executive_clearance', 'continuous_shield', 'nurture', 'closed_lost'];

function loadPipeline() {
    if (!fs.existsSync(PIPELINE_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(PIPELINE_FILE, 'utf8'));
    } catch {
        return [];
    }
}

function savePipeline(pipeline) {
    fs.writeFileSync(PIPELINE_FILE, JSON.stringify(pipeline, null, 2), 'utf8');
}

function addProspect({ name, company, industry, title, source, notes }) {
    const pipeline = loadPipeline();
    const prospect = {
        id: `prospect-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name,
        company,
        industry,
        title,
        source,
        stage: 'prospect',
        notes: notes || '',
        touchHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    pipeline.push(prospect);
    savePipeline(pipeline);
    log(`[Pipeline] Added prospect: ${name} at ${company}`);
    return prospect;
}

function advanceStage(id, newStage, note) {
    if (!STAGES.includes(newStage)) {
        logError(`[Pipeline] Invalid stage: ${newStage}. Valid: ${STAGES.join(', ')}`);
        return null;
    }
    const pipeline = loadPipeline();
    const prospect = pipeline.find(p => p.id === id);
    if (!prospect) {
        logError(`[Pipeline] Prospect not found: ${id}`);
        return null;
    }
    const oldStage = prospect.stage;
    prospect.stage = newStage;
    prospect.updatedAt = new Date().toISOString();
    prospect.touchHistory.push({
        action: `stage_change: ${oldStage} → ${newStage}`,
        note: note || '',
        at: new Date().toISOString()
    });
    savePipeline(pipeline);
    log(`[Pipeline] ${prospect.name} moved: ${oldStage} → ${newStage}`);
    return prospect;
}

function addTouch(id, action, note) {
    const pipeline = loadPipeline();
    const prospect = pipeline.find(p => p.id === id);
    if (!prospect) {
        logError(`[Pipeline] Prospect not found: ${id}`);
        return null;
    }
    prospect.touchHistory.push({ action, note: note || '', at: new Date().toISOString() });
    prospect.updatedAt = new Date().toISOString();
    savePipeline(pipeline);
    log(`[Pipeline] Touch logged for ${prospect.name}: ${action}`);
    return prospect;
}

function report() {
    const pipeline = loadPipeline();
    const byStage = {};
    for (const stage of STAGES) byStage[stage] = 0;
    let totalRevenue = 0;
    for (const p of pipeline) {
        byStage[p.stage] = (byStage[p.stage] || 0) + 1;
        if (p.stage === 'executive_clearance') totalRevenue += 499;
        if (p.stage === 'continuous_shield') totalRevenue += 1499;
    }
    log('\n=== SimpleBeacon Outreach Pipeline ===\n');
    for (const stage of STAGES) {
        log(`  ${stage.padEnd(20)} : ${byStage[stage]}`);
    }
    log(`\n  Total prospects: ${pipeline.length}`);
    log(`  Estimated revenue: $${totalRevenue.toLocaleString()}`);
    log('');
    return { byStage, totalRevenue, total: pipeline.length };
}

function list(stageFilter) {
    const pipeline = loadPipeline();
    const filtered = stageFilter ? pipeline.filter(p => p.stage === stageFilter) : pipeline;
    log(`\n=== Prospects${stageFilter ? ` (${stageFilter})` : ''} ===\n`);
    for (const p of filtered) {
        log(`  ${p.name} | ${p.company} | ${p.industry} | ${p.stage} | Last touch: ${p.touchHistory.length > 0 ? p.touchHistory[p.touchHistory.length - 1].at.slice(0, 10) : 'never'}`);
    }
    log('');
}

// CLI
const [, , cmd, ...args] = process.argv;

if (cmd === 'add') {
    const [name, company, industry, title] = args;
    if (!name || !company) {
        logError('Usage: node outreach-prospects.js add "Name" "Company" "Industry" "Title"');
        process.exit(1);
    }
    addProspect({ name, company, industry: industry || 'Unknown', title: title || 'Unknown', source: 'manual' });
} else if (cmd === 'stage') {
    const [id, stage, note] = args;
    if (!id || !stage) {
        logError('Usage: node outreach-prospects.js stage <id> <stage> [note]');
        process.exit(1);
    }
    advanceStage(id, stage, note);
} else if (cmd === 'touch') {
    const [id, action, note] = args;
    if (!id || !action) {
        logError('Usage: node outreach-prospects.js touch <id> <action> [note]');
        process.exit(1);
    }
    addTouch(id, action, note);
} else if (cmd === 'report') {
    report();
} else if (cmd === 'list') {
    list(args[0]);
} else {
    log(`
SimpleBeacon Outreach Tracker

Commands:
  add   "Name" "Company" "Industry" "Title"   Add a new prospect
  stage <id> <stage> [note]                  Move prospect to new stage
  touch <id> <action> [note]                 Log a touch/activity
  report                                      Show pipeline summary
  list [stage]                                List prospects (optionally filter by stage)

Stages: ${STAGES.join(', ')}
`);
}

module.exports = { addProspect, advanceStage, addTouch, report, list, loadPipeline, savePipeline };
