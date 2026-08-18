#!/usr/bin/env node
// Lightweight CLI wrapper to run the local SimpleBeacon agent orchestrator
const path = require('path');
const { runLocalAgent } = require(path.join(__dirname, '..', 'ai-agent', 'orchestrator.cjs'));

async function main() {
  const goal = process.argv.slice(2).join(' ').trim();
  if (!goal) {
    console.error('Usage: node tools/simplebeacon-assistant.cjs "<what you want help with>"');
    process.exit(2);
  }

  console.log(`\nSimpleBeacon Assistant — goal: ${goal}\n`);

  try {
    const result = await runLocalAgent(goal);
    if (result && result.success) {
      console.log(`Assistant completed successfully: ${JSON.stringify(result)}`);
      process.exit(0);
    }
    console.error('Assistant failed:', result || 'unknown error');
    process.exit(1);
  } catch (err) {
    console.error('Assistant error:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

main();
