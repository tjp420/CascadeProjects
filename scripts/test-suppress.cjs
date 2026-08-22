const fs = require('fs');
const path = require('path');

const rulesFile = path.join(__dirname, '..', 'packages', 'simplebeacon-cli', 'src', 'rules', 'universal-ai-rules.json');
const targetFile = path.join(__dirname, '..', 'ai-platform', 'auto-processor.js');

const rules = JSON.parse(fs.readFileSync(rulesFile, 'utf8'));
const rule = rules.find(r => r.id === 'SB-AI-008');
console.log('Rule:', rule.id, 'suppressPatterns:', rule.suppressPatterns);

const content = fs.readFileSync(targetFile, 'utf8');
const lines = content.split('\n');

const regex = new RegExp(rule.pattern, rule.patternFlags);
const suppressRegexes = (rule.suppressPatterns || []).map(sp => { try { return new RegExp(sp, 'i'); } catch { return null; } }).filter(Boolean);

let match;
while ((match = regex.exec(content)) !== null) {
    const lineIndex = content.slice(0, match.index).split('\n').length - 1;
    const line = lines[lineIndex] || '';
    const contextWindow = lines.slice(lineIndex, lineIndex + 4).join('\n');
    const suppressed = suppressRegexes.some(srx => srx.test(contextWindow) || srx.test(match[0]));
    console.log(`\nMatch at line ${lineIndex + 1}: "${match[0]}"`);
    console.log(`  Context: ${contextWindow.split('\n').map(l => l.trim()).join(' | ')}`);
    console.log(`  Suppressed: ${suppressed}`);
    if (match.index === regex.lastIndex) regex.lastIndex++;
}
