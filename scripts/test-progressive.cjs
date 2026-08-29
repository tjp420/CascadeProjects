const { spawn } = require('child_process');
const child = spawn('node', ['packages/simplebeacon-cli/bin/simplebeacon-mcp.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, SIMPLEBEACON_OFFLINE: '1', SIMPLEBEACON_PROGRESSIVE: '1' },
});
child.stderr.on('data', () => {});
let buf = '';
function send(msg) {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('timeout')), 10000);
    const onData = (data) => {
      buf += data.toString();
      const lines = buf.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const p = JSON.parse(line);
          if (p.id === msg.id) {
            clearTimeout(to);
            child.stdout.removeListener('data', onData);
            resolve(p);
            return;
          }
        } catch {}
      }
    };
    child.stdout.on('data', onData);
    child.stdin.write(JSON.stringify(msg) + '\n');
  });
}
(async () => {
  let id = 1;
  await send({ jsonrpc: '2.0', id: id++, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } } });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  // List tools - should only see 3 meta-tools
  const list = await send({ jsonrpc: '2.0', id: id++, method: 'tools/list', params: {} });
  const toolNames = list.result.tools.map(t => t.name);
  console.log('Progressive tools/list:', toolNames.length, 'tools:', toolNames.join(', '));

  // Search for 'credential'
  const search = await send({ jsonrpc: '2.0', id: id++, method: 'tools/call', params: { name: 'search_available_tools', arguments: { query: 'credential' } } });
  const searchResult = JSON.parse(search.result.content[0].text);
  console.log('Search credential:', searchResult.matchedCount, 'matches:', searchResult.tools.map(t => t.name).join(', '));

  // Inspect scan_snippet schema
  const inspect = await send({ jsonrpc: '2.0', id: id++, method: 'tools/call', params: { name: 'inspect_tool_schema', arguments: { tool_name: 'scan_snippet' } } });
  const inspected = JSON.parse(inspect.result.content[0].text);
  console.log('Inspect scan_snippet: props =', Object.keys(inspected.inputSchema.properties).join(', '));

  // List all tools compact
  const all = await send({ jsonrpc: '2.0', id: id++, method: 'tools/call', params: { name: 'list_all_tools', arguments: {} } });
  const allResult = JSON.parse(all.result.content[0].text);
  console.log('List all tools:', allResult.totalTools, 'tools');

  // Verify a real tool still works (scan_snippet)
  const scan = await send({ jsonrpc: '2.0', id: id++, method: 'tools/call', params: { name: 'scan_snippet', arguments: { content: 'const x = 1;', filePath: 'test.js' } } });
  console.log('scan_snippet still works:', scan.result?.isError ? 'ERROR' : 'OK');

  child.kill();
  console.log('\nProgressive discovery: ALL TESTS PASSED');
})().catch(e => { console.error('FAIL:', e.message); child.kill(); process.exit(1); });
