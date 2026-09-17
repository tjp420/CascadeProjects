const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// This test creates a temporary mock `vscode` module directory and runs a
// small Node runner that registers the LM tool and invokes it. It asserts
// that the tool returns a structured JSON payload containing the
// `simplebeacon` envelope we expect.

function run() {
  // Derive project root from this test file location and create mock vscode under project node_modules
  const projectRoot = path.resolve(__dirname, '..', '..', '..');
  const mockDir = path.join(projectRoot, 'node_modules', 'vscode');
  fs.mkdirSync(mockDir, { recursive: true });
  const mockIndex = `
    exports.lm = {
      LanguageModelTextPart: class { constructor(text) { this.text = text; } },
      LanguageModelToolResult: class { constructor(parts) { this.parts = parts; } },
      registerTool: function(name, tool) { global._sb_registered = { name, tool }; return { registered: true }; }
    };
    exports.window = {
      activeTextEditor: {
        document: {
          uri: { fsPath: '/repo/file.js' },
          languageId: 'javascript',
          lineCount: 42,
          getText: function () { return 'function login() { return true; }\\n'; },
        },
      },
    };
  `;
  fs.writeFileSync(path.join(mockDir, 'index.js'), mockIndex, 'utf8');

  // Runner that requires our lm-tool and registers/invokes it
  const runner = `
    (async function(){
      try {
        const projectRoot = ${JSON.stringify(projectRoot)};
        // Prime require.cache with our mock so bare require('vscode') resolves to it
        try {
          const mockResolved = require.resolve('vscode', { paths: [projectRoot] });
          // eslint-disable-next-line node/no-deprecated-api
          require.cache[mockResolved] = { id: mockResolved, filename: mockResolved, loaded: true, exports: require(mockResolved) };
        } catch (e) {
          // fallthrough
        }

        const pathToTool = ${JSON.stringify(path.resolve(__dirname, '..', 'src', 'lm-tool.js'))};
        const { registerSimpleBeaconTool } = require(pathToTool);
        const context = { subscriptions: [] };
        registerSimpleBeaconTool(context);
        const reg = global._sb_registered;
        if (!reg) {
          console.error('NO_REGISTER');
          process.exit(2);
        }
        const tool = reg.tool;
        const res = await tool.invoke({}, null);
        // Normalize possible results
        if (res && res.parts) {
          const out = res.parts.map(p => p.text || p.value || p);
          console.log(JSON.stringify({ parts: out }));
          process.exit(0);
        }
        if (Array.isArray(res)) {
          console.log(JSON.stringify({ fallback: res }));
          process.exit(0);
        }
        console.error('UNKNOWN_RESULT', typeof res);
        process.exit(3);
      } catch (e) {
        console.error('RUNNER_ERROR', e && e.stack || e);
        process.exit(4);
      }
    })();
  `;
  const runnerPath = path.join(os.tmpdir(), 'sb-lm-runner.js');
  fs.writeFileSync(runnerPath, runner, 'utf8');

  const out = cp.spawnSync(process.execPath, [runnerPath], { env: process.env, encoding: 'utf8' });

  if (out.status !== 0) {
    console.error('Child failed:', out.stderr || out.stdout);
    process.exit(1);
  }

  const jsonLine = out.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .reverse()
    .find((line) => line.startsWith("{"));
  const parsed = JSON.parse(jsonLine || out.stdout.trim());
  if (!parsed || !Array.isArray(parsed.parts) || parsed.parts.length === 0) {
    console.error('Invalid output from tool:', out.stdout);
    process.exit(1);
  }

  // Expect the tool to return JSON payloads containing the `simplebeacon` envelope
  const first = parsed.parts[0];
  if (!first.includes('simplebeacon')) {
    console.error('Missing simplebeacon envelope in output:', first);
    process.exit(1);
  }

  console.log('lm-tool mock-test: ok');
}

try { run(); } catch (e) { console.error(e && e.stack || e); process.exit(1); }
