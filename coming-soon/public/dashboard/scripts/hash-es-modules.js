#!/usr/bin/env node
/**
 * Post-build ES module hashing script.
 *
 * Walks js/ and js-es2018/ directories, computes content hashes,
 * renames files, and rewrites import statements + HTML script tags.
 *
 * Usage:
 *   node scripts/hash-es-modules.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['js', 'js-es2018'];
const MANIFEST_PATH = path.join(ROOT, 'module-manifest.json');

function sha256(content) {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
}

function walk(dir, callback) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, callback);
        } else {
            callback(full, entry.name);
        }
    }
}

function main() {
    const manifest = {};
    const jsFiles = [];

    // Collect all JS files and compute hashes
    for (const dir of DIRS) {
        const absDir = path.join(ROOT, dir);
        if (!fs.existsSync(absDir)) continue;
        walk(absDir, (fullPath, name) => {
            if (!name.endsWith('.js')) return;
            const rel = path.relative(ROOT, fullPath).replace(/\\/g, '/');
            const content = fs.readFileSync(fullPath, 'utf8');
            const hash = sha256(content);
            const base = name.replace(/\.js$/, '');
            const hashedName = `${base}.${hash}.js`;
            const hashedRel = rel.replace(name, hashedName);
            manifest[rel] = hashedRel;
            jsFiles.push({ rel, fullPath, hashedRel, hashedName, hash, content });
        });
    }

    // Rename files on disk
    for (const file of jsFiles) {
        const newPath = file.fullPath.replace(file.rel.split('/').pop(), file.hashedName);
        fs.renameSync(file.fullPath, newPath);
        file.newPath = newPath;
    }

    // Rewrite imports inside JS files
    for (const file of jsFiles) {
        let content = fs.readFileSync(file.newPath, 'utf8');
        for (const other of jsFiles) {
            // Match relative imports like ./utils.js, ../utils.js, ./components/Foo.js
            const pattern = new RegExp(
                `(import\\s+(?:.*?\\s+from\\s+)?['"])${escapeRegex(other.rel.replace(/\\/g, '/').replace(/\.js$/, ''))}(\\.js)?(['"])`,
                'g'
            );
            content = content.replace(pattern, `$1${other.hashedRel.replace(/\.js$/, '')}$2$3`);
        }
        fs.writeFileSync(file.newPath, content, 'utf8');
    }

    // Rewrite HTML script tags and import maps
    const htmlPath = path.join(ROOT, 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    for (const file of jsFiles) {
        const original = file.rel.replace(/\\/g, '/');
        const hashed = file.hashedRel.replace(/\\/g, '/');
        html = html.replace(new RegExp(escapeRegex(original), 'g'), hashed);
    }
    fs.writeFileSync(htmlPath, html, 'utf8');

    // Write manifest
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');

    console.log(`[hash-es-modules] Hashed ${jsFiles.length} JS files.`);
    console.log(`[hash-es-modules] Manifest written to ${MANIFEST_PATH}`);
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (require.main === module) {
    main();
}

module.exports = { sha256, walk };
