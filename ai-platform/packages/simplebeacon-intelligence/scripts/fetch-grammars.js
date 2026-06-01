/**
 * Download Tree-sitter WASM grammars from tree-sitter release artifacts.
 * Network required — run manually: npm run fetch-grammars
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

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

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    for (const grammar of GRAMMARS) {
        const dest = path.join(OUT_DIR, grammar.file);
        if (fs.existsSync(dest)) {
            console.log(`[fetch-grammars] skip ${grammar.file} (exists)`);
            continue;
        }
        console.log(`[fetch-grammars] downloading ${grammar.language}...`);
        try {
            await download(grammar.url, dest);
            console.log(`[fetch-grammars] saved ${dest}`);
        } catch (err) {
            console.warn(`[fetch-grammars] failed ${grammar.language}: ${err.message}`);
        }
    }
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { GRAMMARS, download, OUT_DIR };
