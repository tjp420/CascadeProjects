#!/usr/bin/env node
/**
 * Automated eval() Replacement Script
 */

const fs = require('fs');
const path = require('path');

class EvalReplacer {
    constructor(filePath) {
        this.filePath = filePath;
        this.content = fs.readFileSync(filePath, 'utf8');
        this.changes = [];
    }

    replaceJSONParse() {
        this.content = this.content.replace(
            /eval\s*\(\s*JSON\.stringify\s*\(([^)]+)\)\s*\)/g,
            'JSON.parse(JSON.stringify($1))'
        );
    }

    addSecurityComment() {
        this.content = this.content.replace(
            /(eval\s*\()/g,
            '// SECURITY WARNING: eval() usage detected - review for safer alternatives\n    $1'
        );
    }

    save() {
        fs.writeFileSync(this.filePath, this.content);
        console.log(`Fixed ${this.filePath}`);
    }
}

const filePath = process.argv[2];
if (!filePath) {
    console.log('Usage: node fix-eval-usage.js <file-path>');
    process.exit(1);
}

const replacer = new EvalReplacer(filePath);
replacer.replaceJSONParse();
replacer.addSecurityComment();
replacer.save();
