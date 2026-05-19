#!/usr/bin/env node
/**
 * Automated json_parsing Replacement Script
 */

const fs = require('fs');
const path = require('path');

class Json_parsingReplacer {
    constructor(filePath) {
        this.filePath = filePath;
        this.content = fs.readFileSync(filePath, 'utf8');
        this.changes = [];
    }

    replace() {
        const replacement = this.getReplacement();
        const pattern = replacement.pattern;
        
        let match;
        while ((match = pattern.exec(this.content)) !== null) {
            this.changes.push({
                original: match[0],
                replacement: match[0].replace(pattern, replacement.replacement),
                position: match.index
            });
        }
        
        this.content = this.content.replace(pattern, replacement.replacement);
    }

    getReplacement() {
        return {"pattern":{},"replacement":"JSON.parse(JSON.stringify($1))","description":"Replace eval(JSON.stringify()) with JSON.parse(JSON.stringify())"};
    }

    save() {
        if (this.changes.length > 0) {
            fs.writeFileSync(this.filePath, this.content);
            console.log(`Replaced ${this.changes.length} instances in ${this.filePath}`);
        } else {
            console.log(`No matching patterns found in ${this.filePath}`);
        }
    }
}

const filePath = process.argv[2];
if (!filePath) {
    console.log('Usage: node json_parsing-replacement.js <file-path>');
    process.exit(1);
}

const replacer = new Json_parsingReplacer(filePath);
replacer.replace();
replacer.save();
