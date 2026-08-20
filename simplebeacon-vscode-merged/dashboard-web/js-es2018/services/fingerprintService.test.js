// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Node tests for the structural fingerprinting service.
 */
import assert from 'node:assert';
import { identifyProgram, formatFingerprint } from './fingerprintService.js';
function makePaths(parts) {
  return parts;
}
async function test() {
  // Node.js project
  const node = identifyProgram('my-app', makePaths(['package.json', 'node_modules/foo/index.js', 'src/main.js']));
  assert.strictEqual(node.profile, 'nodejs');
  assert.ok(node.confidence >= 80, `Node confidence too low: ${node.confidence}`);
  // Unity project
  const unity = identifyProgram(
    'unity-game',
    makePaths(['Assets/Scripts/Player.cs', 'ProjectSettings/UnityProjectSettings.asset', 'Packages/manifest.json'])
  );
  assert.strictEqual(unity.profile, 'unity');
  assert.ok(unity.confidence >= 80, `Unity confidence too low: ${unity.confidence}`);
  // Python project
  const python = identifyProgram('py-app', makePaths(['requirements.txt', '.venv/bin/python', 'main.py']));
  assert.strictEqual(python.profile, 'python');
  assert.ok(python.confidence >= 75, `Python confidence too low: ${python.confidence}`);
  // Unreal Engine project
  const unreal = identifyProgram(
    'ue-game',
    makePaths(['Engine/Binaries/Win64/UE4Editor.exe', 'Game.uproject', 'Content/Maps/Main.umap'])
  );
  assert.strictEqual(unreal.profile, 'unreal');
  assert.ok(unreal.confidence >= 80, `Unreal confidence too low: ${unreal.confidence}`);
  // VS Code: workspace
  const vscode = identifyProgram('repo', makePaths(['.vscode/settings.json', '.vscode/launch.json', 'src/index.js']));
  assert.strictEqual(vscode.profile, 'vscode');
  assert.ok(vscode.confidence >= 70, `VS Code: confidence too low: ${vscode.confidence}`);
  // Unknown / mixed project
  const unknown = identifyProgram('custom', makePaths(['readme.md', 'build.sh', 'assets/logo.png']));
  assert.strictEqual(unknown.profile, 'unknown');
  assert.strictEqual(unknown.confidence, 0);
  // Formatting
  const formatted = formatFingerprint(node);
  assert.ok(formatted.includes('Node.js Project'));
  assert.ok(formatted.includes('files'));
  console.log('fingerprintService tests passed');
}
test().catch((e) => {
  console.error(e);
  process.exit(1);
});
