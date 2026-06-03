/**
 * Smoke test for the local agentic loop.
 * Validates Ollama connectivity and executes a safe, read-only goal.
 */

const { runLocalAgent, callLocalModel } = require('./orchestrator.js');

async function main() {
    console.log('=== AI Agent Smoke Test ===\n');

    // 1. Verify Ollama is reachable
    console.log('[Test 1] Pinging Ollama...');
    try {
        const ping = await callLocalModel('Respond with exactly: PONG');
        console.log(`  Model response: "${ping}"`);
        if (!ping.toLowerCase().includes('pong')) {
            console.warn('  ⚠️ Unexpected ping response, but Ollama is reachable.');
        } else {
            console.log('  ✅ Ollama is alive and responding.');
        }
    } catch (err) {
        console.error('  ❌ Ollama unreachable:', err.message);
        process.exit(1);
    }

    // 2. Run a safe, read-only agent goal
    console.log('\n[Test 2] Executing read-only agent goal: "Verify syntax of ai-tools/index.js"');
    try {
        const result = await runLocalAgent('Verify syntax of ai-tools/index.js');
        console.log('\n  Result:', JSON.stringify(result, null, 2));
        if (result.success) {
            console.log('  ✅ Agent loop completed successfully.');
        } else {
            console.error('  ⚠️ Agent loop failed:', result.error);
            process.exit(1);
        }
    } catch (err) {
        console.error('  ❌ Agent execution error:', err.message);
        process.exit(1);
    }

    console.log('\n=== All smoke tests passed ===');
}

main();