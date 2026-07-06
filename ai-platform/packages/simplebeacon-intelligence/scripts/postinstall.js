/**
 * Post-install probe — platform detection and setup hints (no network required).
 */

import os from 'os';
import * as treeSitterLoader from '../src/tree-sitter-loader.js';
import * as slmBridge from '../src/slm-bridge.js';
const { getTreeSitterStatus } = treeSitterLoader;
const { probeSlmBin } = slmBridge;

/**
 * Platform label.
 * @returns {any}
 */
function platformLabel() {
    const platform = process.platform;
    const arch = process.arch;
    if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64 (Apple Silicon — Metal SLM recommended)';
    if (platform === 'darwin') return 'darwin-x64';
    if (platform === 'win32') return 'win32-x64';
    if (platform === 'linux') return `linux-${arch}`;
    return `${platform}-${arch}`;
}

/**
 * Main.
 * @returns {any}
 */
function main() {
    const status = getTreeSitterStatus();
    const slm = probeSlmBin();

    const hints = [];
    if (!status.webTreeSitterInstalled) {
        hints.push('Optional: npm install web-tree-sitter (included as optionalDependency)');
    }
    if (!Object.values(status.grammarsAvailable).some(Boolean)) {
        hints.push('Run: npm run fetch-grammars — downloads Tree-sitter WASM grammars');
    }
    if (!slm.configured) {
        hints.push('Optional SLM: set LLAMA_CPP_BIN and SIMPLEBEACON_SLM_MODEL for Tier 2 review');
    }

    const message = [
        '[@simplebeacon/intelligence] Hybrid Local Intelligence installed.',
        `Platform: ${platformLabel()} (${os.cpus()[0]?.model || 'unknown CPU'})`,
        `Tree-sitter WASM: ${status.ready ? 'ready' : 'structural-only until grammars fetched'}`,
        `SLM: ${slm.configured ? (slm.executable ? 'binary found' : 'path configured but missing') : 'not configured'}`,
        hints.length ? `Next: ${hints.join(' | ')}` : 'Ready for intelligence.enabled in .simplebeacon/config.json'
    ].join('\n');

}

main();

export { main };
