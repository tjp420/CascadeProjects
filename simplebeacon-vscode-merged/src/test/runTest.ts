import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-vscode-test-'));
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-vscode-workspace-'));

    // Pre-create a writable workspace settings file so config.update() works in the headless host
    const vscodeDir = path.join(workspaceDir, '.vscode');
    fs.mkdirSync(vscodeDir, { recursive: true });
    fs.writeFileSync(path.join(vscodeDir, 'settings.json'), '{}', 'utf8');

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ['--disable-extensions', `--user-data-dir=${userDataDir}`, workspaceDir],
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();
