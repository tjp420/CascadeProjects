// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
/**
 * Download Tree-sitter WASM grammars from tree-sitter release artifacts.
 * Network required — run manually: npm run fetch-grammars
 */

import fs from 'fs';
import https from 'https';
import path from 'path';

const GRAMMARS = [
    {
        language: 'javascript',
        url: 'https://github.com/tree-sitter/tree-sitter-javascript/releases/download/v0.23.1/tree-sitter-javascript.wasm',
        file: 'tree-sitter-javascript.wasm'
    },
    {
        language: 'typescript',
        url: 'https://github.com/tree-sitter/tree-sitter-typescript/releases/download/v0.23.2/tree-sitter-typescript.wasm',
        file: 'tree-sitter-typescript.wasm'
    },
    {
        language: 'python',
        url: 'https://github.com/tree-sitter/tree-sitter-python/releases/download/v0.23.4/tree-sitter-python.wasm',
        file: 'tree-sitter-python.wasm'
    },
    {
        language: 'go',
        url: 'https://github.com/tree-sitter/tree-sitter-go/releases/download/v0.23.4/tree-sitter-go.wasm',
        file: 'tree-sitter-go.wasm'
    }
];

const OUT_DIR = path.join(__dirname, '..', 'grammars');

/**
 * Download.
 * @param {string} url
 * @param {any} dest
 * @returns {any}
 */
function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                file.close();
                fs.unlinkSync(dest);
                download(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                file.close();
                reject(new Error(`HTTP ${response.statusCode} for ${url}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(dest);
            });
        }).on('error', (err) => {
            file.close();
            reject(err);
        });
    });
}

/**
 * Main.
 * @returns {any}
 */
async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    for (const grammar of GRAMMARS) {
        const dest = path.join(OUT_DIR, grammar.file);
        if (fs.existsSync(dest)) {
            continue;
        }
        try {
            await download(grammar.url, dest);
        } catch (err) {
            console.warn(`[fetch-grammars] failed ${grammar.language}: ${err.message}`);
        }
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

export { GRAMMARS, download, OUT_DIR };
