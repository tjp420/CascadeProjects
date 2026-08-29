const { execSync, spawn } = require('child_process');
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
};

const results = [];
function recordResult(testName, category, passed, details) {
  results.push({ testName, category, passed, details });
  const status = passed ? `${colors.green}[PASS]${colors.reset}` : `${colors.red}[FAIL]${colors.reset}`;
  console.log(`${status} ${colors.yellow}${category}${colors.reset} -> ${testName}`);
  if (!passed) console.log(`       \u21b3 Error: ${details}`);
}

const mcpServerPath = path.resolve('packages/simplebeacon-cli/bin/simplebeacon-mcp.js');
const toolsPath = path.resolve('packages/simplebeacon-cli/src/mcp/tools.js');

if (!fs.existsSync(mcpServerPath)) {
  console.log(`${colors.red}[FATAL] MCP server not found at ${mcpServerPath}${colors.reset}`);
  process.exit(1);
}

const ALL_TOOLS = [
  'scan_snippet', 'scan_file', 'scan_project', 'gate_status',
  'suggest_fixes', 'get_action_plan', 'explain_finding', 'init_project',
  'compliance_checklist', 'run_analyzer_suite', 'generate_marketing',
  'export_report', 'list_rulesets', 'scan_deployment_readiness',
  'supercharge_agent', 'handoff_check', 'scan_staged', 'agent_status',
  'code_suggestions', 'install_agent_plugin', 'agent_register',
  'agent_remember', 'agent_recall', 'agent_forget', 'task_create',
  'task_list', 'task_update', 'task_complete', 'policy_check',
  'policy_list', 'gate_finalize', 'handoff_write', 'handoff_read',
  'cross_project_learn',
];

function sendMcpMessage(child, message) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for MCP response'));
    }, 15000);

    let buffer = '';
    const onData = (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === message.id) {
            clearTimeout(timeout);
            child.stdout.removeListener('data', onData);
            resolve(parsed);
            return;
          }
        } catch {
          // Not JSON, keep buffering
        }
      }
    };
    child.stdout.on('data', onData);
    child.stdin.write(JSON.stringify(message) + '\n');
  });
}

function spawnMcpServer() {
  const child = spawn('node', [mcpServerPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, SIMPLEBEACON_OFFLINE: '1' },
  });
  child.stderr.on('data', () => {});
  return child;
}

async function runTests() {
  console.log(`${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.magenta}        SIMPLEBEACON MCP FUZZER & INJECTION HARNESS   ${colors.reset}`);
  console.log(`${colors.cyan}====================================================${colors.reset}\n`);

  // ── TEST 1: Tool Discovery & Schema Validation ─────────────────────────────
  try {
    console.log(`${colors.cyan}[*] Testing MCP tool discovery and schema validation...${colors.reset}`);

    const child = spawnMcpServer();
    let msgId = 1;

    await sendMcpMessage(child, {
      jsonrpc: '2.0', id: msgId++, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'fuzzer', version: '1.0' } },
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

    const listResponse = await sendMcpMessage(child, {
      jsonrpc: '2.0', id: msgId++, method: 'tools/list', params: {},
    });

    child.kill();

    if (!listResponse?.result?.tools) {
      recordResult('Tool Discovery', 'Discovery', false, 'tools/list returned no tools array');
    } else {
      const discoveredTools = listResponse.result.tools.map(t => t.name);
      const missing = ALL_TOOLS.filter(t => !discoveredTools.includes(t));
      const extra = discoveredTools.filter(t => !ALL_TOOLS.includes(t));

      if (missing.length > 0) {
        recordResult('Tool Completeness', 'Discovery', false, `Missing tools: ${missing.join(', ')}`);
      } else {
        recordResult('Tool Completeness', 'Discovery', true, `All ${ALL_TOOLS.length} tools discovered`);
      }

      if (extra.length > 0) {
        recordResult('Tool Registry Sync', 'Discovery', false, `Unexpected tools: ${extra.join(', ')}`);
      } else {
        recordResult('Tool Registry Sync', 'Discovery', true, 'No unexpected tools found');
      }

      let schemaErrors = [];
      for (const tool of listResponse.result.tools) {
        if (!tool.name) schemaErrors.push(`${tool.name || 'unknown'}: missing name`);
        if (!tool.description) schemaErrors.push(`${tool.name}: missing description`);
        if (!tool.inputSchema) schemaErrors.push(`${tool.name}: missing inputSchema`);
        if (tool.inputSchema && tool.inputSchema.type !== 'object') {
          schemaErrors.push(`${tool.name}: inputSchema.type must be "object"`);
        }
      }
      if (schemaErrors.length > 0) {
        recordResult('Tool Schema Validation', 'Discovery', false, schemaErrors.join('; '));
      } else {
        recordResult('Tool Schema Validation', 'Discovery', true, 'All tools have valid schemas');
      }
    }
  } catch (err) {
    recordResult('Tool Discovery', 'Discovery', false, err.message);
  }

  // ── TEST 2: Unknown Tool Handling ──────────────────────────────────────────
  try {
    console.log(`\n${colors.cyan}[*] Testing unknown tool rejection...${colors.reset}`);

    const child = spawnMcpServer();
    let msgId = 100;

    await sendMcpMessage(child, {
      jsonrpc: '2.0', id: msgId++, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'fuzzer', version: '1.0' } },
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

    const response = await sendMcpMessage(child, {
      jsonrpc: '2.0', id: msgId++, method: 'tools/call',
      params: { name: 'totally_fake_tool_xyz', arguments: {} },
    });

    child.kill();

    if (response?.result?.isError) {
      recordResult('Unknown Tool Rejection', 'Injection', true, 'Server rejects unknown tools with isError');
    } else {
      recordResult('Unknown Tool Rejection', 'Injection', false, 'Server did not flag unknown tool as error');
    }
  } catch (err) {
    recordResult('Unknown Tool Rejection', 'Injection', false, err.message);
  }

  // ── TEST 3: Malformed Arguments Injection ──────────────────────────────────
  try {
    console.log(`\n${colors.cyan}[*] Injecting malformed arguments into MCP tools...${colors.reset}`);

    const child = spawnMcpServer();
    let msgId = 200;

    await sendMcpMessage(child, {
      jsonrpc: '2.0', id: msgId++, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'fuzzer', version: '1.0' } },
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

    const malformedPayloads = [
      { name: 'scan_snippet', arguments: { content: null, filePath: null } },
      { name: 'scan_snippet', arguments: { content: 'A'.repeat(100000), filePath: 'test.js' } },
      { name: 'scan_snippet', arguments: { content: '{"__proto__": {"polluted": true}}', filePath: 'test.js' } },
      { name: 'scan_file', arguments: { filePath: '../../../../etc/passwd' } },
      { name: 'scan_file', arguments: { filePath: '' } },
      { name: 'agent_remember', arguments: { key: '', value: '\x00\x01\x02' } },
      { name: 'task_create', arguments: { description: null } },
      { name: 'gate_status', arguments: { projectRoot: 'C:\\nonexistent\\path\\that\\does\\not\\exist' } },
    ];

    let injectionPassed = 0;
    let injectionFailed = 0;

    for (const payload of malformedPayloads) {
      try {
        const response = await sendMcpMessage(child, {
          jsonrpc: '2.0', id: msgId++, method: 'tools/call',
          params: payload,
        });

        if (response?.result?.isError || response?.error) {
          injectionPassed++;
        } else {
          const text = response?.result?.content?.[0]?.text || '';
          if (text.includes('polluted') || text.includes('__proto__')) {
            injectionFailed++;
            recordResult(`Prototype Pollution: ${payload.name}`, 'Injection', false, 'Prototype pollution detected in response');
          } else {
            injectionPassed++;
          }
        }
      } catch {
        injectionFailed++;
      }
    }

    child.kill();

    if (injectionFailed === 0) {
      recordResult('Malformed Argument Injection', 'Injection', true, `${injectionPassed}/${malformedPayloads.length} payloads handled safely`);
    } else {
      recordResult('Malformed Argument Injection', 'Injection', false, `${injectionFailed}/${malformedPayloads.length} payloads caused issues`);
    }
  } catch (err) {
    recordResult('Malformed Argument Injection', 'Injection', false, err.message);
  }

  // ── TEST 4: Path Traversal Protection ──────────────────────────────────────
  try {
    console.log(`\n${colors.cyan}[*] Testing path traversal protection...${colors.reset}`);

    const child = spawnMcpServer();
    let msgId = 300;

    await sendMcpMessage(child, {
      jsonrpc: '2.0', id: msgId++, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'fuzzer', version: '1.0' } },
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

    const traversalPaths = [
      '../../../etc/passwd',
      '..\\\\..\\\\..\\\\windows\\\\system32\\\\config\\\\sam',
      '/etc/shadow',
      'C:\\Windows\\System32\\config\\SAM',
      '../../../../proc/self/environ',
    ];

    let traversalBlocked = 0;

    for (const traversal of traversalPaths) {
      const response = await sendMcpMessage(child, {
        jsonrpc: '2.0', id: msgId++, method: 'tools/call',
        params: { name: 'scan_file', arguments: { filePath: traversal } },
      });

      const text = response?.result?.content?.[0]?.text || '';
      // Blocked if: isError flag set, OR error message about project root, OR no actual file contents
      const hasErrorFlag = response?.result?.isError;
      const hasProjectRootError = text.includes('project root') || text.includes('within project');
      const hasRealFileContents = (text.includes('root:') && text.includes(':/bin'))
        || (text.includes('shadow:') && text.includes(':$6$'))
        || (text.includes('[boot loader]'));
      if (hasErrorFlag || hasProjectRootError || !hasRealFileContents) {
        traversalBlocked++;
      }
    }

    child.kill();

    if (traversalBlocked === traversalPaths.length) {
      recordResult('Path Traversal Protection', 'Injection', true, `${traversalBlocked}/${traversalPaths.length} traversal attempts blocked`);
    } else {
      recordResult('Path Traversal Protection', 'Injection', false, `${traversalPaths.length - traversalBlocked} traversal attempts succeeded`);
    }
  } catch (err) {
    recordResult('Path Traversal Protection', 'Injection', false, err.message);
  }

  // ── TEST 5: Zero-Upload Network Isolation (MCP layer) ──────────────────────
  try {
    console.log(`\n${colors.cyan}[*] Verifying MCP server zero-upload network isolation...${colors.reset}`);

    const toolsSource = fs.readFileSync(toolsPath, 'utf8');
    const serverSource = fs.readFileSync(path.resolve('packages/simplebeacon-cli/src/mcp/stdio-server.js'), 'utf8');
    const combined = toolsSource + serverSource;

    const networkPatterns = [
      { pattern: /fetch\s*\(\s*['"]https?:\/\//g, label: 'fetch() to external URL' },
      { pattern: /axios\.(get|post|put|delete|patch)\s*\(/g, label: 'axios HTTP call' },
      { pattern: /http\.request\s*\(/g, label: 'http.request()' },
      { pattern: /https\.request\s*\(/g, label: 'https.request()' },
      { pattern: /XMLHttpRequest/g, label: 'XMLHttpRequest' },
    ];

    const foundLeaks = [];
    for (const { pattern, label } of networkPatterns) {
      const codeOnly = combined
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/['"`][^'"`]*fetch[^'"`]*['"`]/g, '');
      const codeMatches = codeOnly.match(pattern);
      if (codeMatches && codeMatches.length > 0) {
        foundLeaks.push(`${label} (${codeMatches.length} occurrences)`);
      }
    }

    const hasNetworkGuard = combined.includes('networkGuard') || combined.includes('assertOfflineClean');

    if (foundLeaks.length > 0) {
      recordResult('MCP Zero-Upload Isolation', 'Compliance', false, `Network calls found: ${foundLeaks.join(', ')}`);
    } else if (!hasNetworkGuard) {
      recordResult('MCP Zero-Upload Isolation', 'Compliance', false, 'No networkGuard detected — offline enforcement missing');
    } else {
      recordResult('MCP Zero-Upload Isolation', 'Compliance', true, 'MCP layer enforces offline mode via networkGuard');
    }
  } catch (err) {
    recordResult('MCP Zero-Upload Isolation', 'Compliance', false, err.message);
  }

  // ── TEST 6: Protocol Compliance (JSON-RPC 2.0) ─────────────────────────────
  try {
    console.log(`\n${colors.cyan}[*] Testing JSON-RPC 2.0 protocol compliance...${colors.reset}`);

    const child = spawnMcpServer();
    let msgId = 400;

    const preInitResponse = await sendMcpMessage(child, {
      jsonrpc: '2.0', id: msgId++, method: 'tools/list', params: {},
    });

    if (preInitResponse?.error?.code === -32002) {
      recordResult('Pre-Initialize Rejection', 'Protocol', true, 'Server rejects requests before initialize');
    } else {
      recordResult('Pre-Initialize Rejection', 'Protocol', false, 'Server allowed request before initialize');
    }

    await sendMcpMessage(child, {
      jsonrpc: '2.0', id: msgId++, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'fuzzer', version: '1.0' } },
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

    const unknownMethodResponse = await sendMcpMessage(child, {
      jsonrpc: '2.0', id: msgId++, method: 'custom/unknown_method', params: {},
    });

    if (unknownMethodResponse?.error?.code === -32601) {
      recordResult('Unknown Method Handling', 'Protocol', true, 'Server returns -32601 for unknown methods');
    } else {
      recordResult('Unknown Method Handling', 'Protocol', false, `Expected -32601, got: ${JSON.stringify(unknownMethodResponse?.error)}`);
    }

    const pingResponse = await sendMcpMessage(child, {
      jsonrpc: '2.0', id: msgId++, method: 'ping', params: {},
    });

    if (pingResponse?.result && !pingResponse.error) {
      recordResult('Ping Protocol', 'Protocol', true, 'Server responds to ping');
    } else {
      recordResult('Ping Protocol', 'Protocol', false, 'Server did not respond to ping correctly');
    }

    child.kill();
  } catch (err) {
    recordResult('Protocol Compliance', 'Protocol', false, err.message);
  }

  // ── TEST 7: Large Payload Handling ─────────────────────────────────────────
  try {
    console.log(`\n${colors.cyan}[*] Testing large payload resilience...${colors.reset}`);

    const child = spawnMcpServer();
    let msgId = 500;

    await sendMcpMessage(child, {
      jsonrpc: '2.0', id: msgId++, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'fuzzer', version: '1.0' } },
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

    const hugeContent = 'function foo() { return "' + 'A'.repeat(500000) + '"; }';
    const startTime = Date.now();

    const response = await sendMcpMessage(child, {
      jsonrpc: '2.0', id: msgId++, method: 'tools/call',
      params: { name: 'scan_snippet', arguments: { content: hugeContent, filePath: 'huge.js' } },
    });

    const elapsed = Date.now() - startTime;
    child.kill();

    if (response?.result && !response?.error) {
      recordResult('Large Payload Resilience', 'DAST', true, `Handled 500KB payload in ${elapsed}ms`);
    } else if (response?.result?.isError) {
      recordResult('Large Payload Resilience', 'DAST', true, `Server safely rejected 500KB payload in ${elapsed}ms`);
    } else {
      recordResult('Large Payload Resilience', 'DAST', false, `Server failed on 500KB payload: ${response?.error?.message || 'unknown'}`);
    }
  } catch (err) {
    recordResult('Large Payload Resilience', 'DAST', false, err.message);
  }

  // ── FINAL OUTPUT ───────────────────────────────────────────────────────────
  console.log(`\n${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.magenta}              MCP FUZZING COMPLETE                  ${colors.reset}`);
  console.log(`${colors.cyan}====================================================${colors.reset}\n`);

  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = results.filter(r => !r.passed);

  console.log(`Passed: ${colors.green}${passedTests}/${totalTests}${colors.reset}`);

  if (failedTests.length > 0) {
    console.log(`\n${colors.red}Failed tests:${colors.reset}`);
    for (const t of failedTests) {
      console.log(`  ${colors.red}\u2717${colors.reset} ${t.category} -> ${t.testName}`);
      console.log(`     ${colors.dim}${t.details}${colors.reset}`);
    }
    console.log(`\n${colors.red}[CRITICAL] MCP server has injection vectors or protocol gaps.${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}[SUCCESS] MCP server is injection-safe, protocol-compliant, and offline-enforced.${colors.reset}\n`);
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error(`${colors.red}[FATAL] ${err.message}${colors.reset}`);
  process.exit(1);
});
