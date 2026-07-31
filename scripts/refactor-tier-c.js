// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const fs = require('fs');

// === structural-intent-scanner.js ===
const scannerFile =
  'C:/Users/Trevor/CascadeProjects/ai-platform/packages/simplebeacon-intelligence/src/structural-intent-scanner.js';
let scanner = fs.readFileSync(scannerFile, 'utf8');

// 1. Extract findMatchingBrace before extractJsFunctions
const findMatchingBraceFunc = `function findMatchingBrace(content, openBrace) {
    let depth = 0;
    for (let j = openBrace; j < content.length; j += 1) {
        if (content[j] === '{') depth += 1;
        if (content[j] === '}') {
            depth -= 1;
            if (depth === 0) return j;
        }
    }
    return -1;
}

`;

scanner = scanner.replace(
  'function extractJsFunctions(content) {',
  findMatchingBraceFunc + 'function extractJsFunctions(content) {'
);

// 2. Simplify the brace-matching block inside extractJsFunctions
scanner = scanner.replace(
  /const openBrace = content\.indexOf\('\{', match\.index\);\n            if \(openBrace === -1\) continue;\n\n            let depth = 0;\n            let end = openBrace;\n            for \(let j = openBrace; j < content\.length; j \+= 1\) \{\n                if \(content\[j\] === '\{'\) depth \+= 1;\n                if \(content\[j\] === '}'\) \{\n                    depth -= 1;\n                    if \(depth === 0\) \{\n                        end = j;\n                        break;\n                    \}\n                \}\n            \}\n\n            const body = content\.slice\(openBrace \+ 1, end\);/,
  `const openBrace = content.indexOf('{', match.index);
            if (openBrace === -1) continue;
            const end = findMatchingBrace(content, openBrace);
            if (end === -1) continue;
            const body = content.slice(openBrace + 1, end);`
);

// 3. Extract createCredentialFinding and flatten scanCredentialDictStubs
scanner = scanner.replace(
  /function scanCredentialDictStubs\(content, filePath, language\) \{\n    const findings = \[\];\n    const lines = content\.split\('\\n'\);\n\n    for \(let i = 0; i < lines\.length; i \+= 1\) \{\n        const line = lines\[i\];\n        if \(language === 'python'\) \{\n            const dictMatch = line\.match\(\/\['"\]\(\[\^'"\]\+\)\['"\]\\s\*:\\s\*\['"\]\(\[\^'"\]\*\)\['"\]\/\);\n            if \(dictMatch && credentialKeyMatch\(dictMatch\[1\]\) && isPlaceholderCredentialValue\(dictMatch\[2\]\)\) \{\n                findings\.push\(normalizeFinding\(\{\n                    id: INTENT_RULE_IDS\.CREDENTIAL_STUB,\n                    severity: 'high',\n                    category: 'Credential Mock Stub',\n                    file: filePath,\n                    line: i \+ 1,\n                    details: `Config key '\$\{dictMatch\[1\]\}' assigned a superficial AI placeholder value\.`\n                \}\)\);\n            \}\n        \} else \{\n            const jsMatch = line\.match\(\/\(\['"\]\)\?\(\[\\w\]\+\)\\1\\s\*:\\s\*\['"\]\(\[\^'"\]\*\)\['"\]\/\);\n            if \(jsMatch && credentialKeyMatch\(jsMatch\[2\]\) && isPlaceholderCredentialValue\(jsMatch\[3\]\)\) \{\n                findings\.push\(normalizeFinding\(\{\n                    id: INTENT_RULE_IDS\.CREDENTIAL_STUB,\n                    severity: 'high',\n                    category: 'Credential Mock Stub',\n                    file: filePath,\n                    line: i \+ 1,\n                    details: `Config key '\$\{jsMatch\[2\]\}' assigned a superficial AI placeholder value\.`\n                \}\)\);\n            \}\n        \}\n    \}\n\n    return findings;\n\}/,
  `function createCredentialFinding(key, lineNum, filePath) {
    return normalizeFinding({
        id: INTENT_RULE_IDS.CREDENTIAL_STUB,
        severity: 'high',
        category: 'Credential Mock Stub',
        file: filePath,
        line: lineNum,
        details: \`Config key '\${key}' assigned a superficial AI placeholder value.\`
    });
}

function scanCredentialDictStubs(content, filePath, language) {
    const findings = [];
    const lines = content.split('\\n');

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (language === 'python') {
            const dictMatch = line.match(/['"]([^'"]+)['"]\\s*:\\s*['"]([^'"]*)['"]/);
            if (dictMatch && credentialKeyMatch(dictMatch[1]) && isPlaceholderCredentialValue(dictMatch[2])) {
                findings.push(createCredentialFinding(dictMatch[1], i + 1, filePath));
            }
            continue;
        }
        const jsMatch = line.match(/(['"])?([\\w]+)\\1\\s*:\\s*['"]([^'"]*)['"]/);
        if (jsMatch && credentialKeyMatch(jsMatch[2]) && isPlaceholderCredentialValue(jsMatch[3])) {
            findings.push(createCredentialFinding(jsMatch[2], i + 1, filePath));
        }
    }

    return findings;
}`
);

fs.writeFileSync(scannerFile, scanner, 'utf8');
console.log('✓ structural-intent-scanner.js');

// === vector-cache.js ===
const vectorFile =
  'C:/Users/Trevor/CascadeProjects/ai-platform/packages/simplebeacon-intelligence/src/vector-cache.js';
let vector = fs.readFileSync(vectorFile, 'utf8');

// Extract countMatches helper
vector = vector.replace(
  'function extractFeatureVector(content, structuralFindings = []) {',
  `function countMatches(content, pattern) {
    return (content.match(pattern) || []).length;
}

function extractFeatureVector(content, structuralFindings = []) {`
);

// Replace repeated match patterns with countMatches calls
vector = vector.replace(
  /    const genericNames = 'data\|result\|output\|temp\|info\|val\|payload\|obj\|res';\n    const genericAssigns = \(content\.match\(new RegExp\(\`\\\\b\(\$\{genericNames\}\)\\\\s\*=\`, 'gi'\)\) \|\| \[\]\)\.length;\n    const tryBlocks = \(content\.match\(\/\\\\btry\\\\s\*\[\{:\]\/g\) \|\| \[\]\)\.length;\n    const passHandlers = \(content\.match\(\/\\\\bpass\\\\b\|\\\\bcatch\\\\s\*\(\[\^\)\]\*\)\\\\s\*\{\\\\s\*\}\/g\) \|\| \[\]\)\.length;\n    const literalReturns = \(content\.match\(\/\\\\breturn\\\\s\+\(\{\|\[\|\["\x27\x60\\d\]\/g\) \|\| \[\]\)\.length;\n    const genericReturns = \(content\.match\(new RegExp\(\`\\\\breturn\\\\s\+\(\$\{genericNames\}\)\\\\b\`, 'gi'\)\) \|\| \[\]\)\.length;\n    const dictAssigns = \(content\.match\(new RegExp\(\`\\\\b\(\$\{genericNames\}\)\\\\s\*=\\\\s\*\{\`, 'gi'\)\) \|\| \[\]\)\.length;\n    const credentialKeys = \(content\.match\(\/\['"\]\?\(secret\|token\|pass\|key\|api_key\)\['"\]\?\\s\*:\/gi\) \|\| \[\]\)\.length;\n    const placeholderVals = \(content\.match\(\/your_\|changeme\|placeholder\/gi\) \|\| \[\]\)\.length;/,
  `    const genericNames = 'data|result|output|temp|info|val|payload|obj|res';
    const genericAssigns = countMatches(content, new RegExp(\`\\\\b(\${genericNames})\\\\s*=\`, 'gi'));
    const tryBlocks = countMatches(content, /\\btry\\s*[\{:]/g);
    const passHandlers = countMatches(content, /\\bpass\\b|\\bcatch\\s*\\([^)]*\\)\\s*\\{\\s*\\}/g);
    const literalReturns = countMatches(content, /\\breturn\\s+(\\{|\\[|["'\x60\\d])/g);
    const genericReturns = countMatches(content, new RegExp(\`\\breturn\\s+(\${genericNames})\\b\`, 'gi'));
    const dictAssigns = countMatches(content, new RegExp(\`\\b(\${genericNames})\\s*=\\s*\\{\`, 'gi'));
    const credentialKeys = countMatches(content, /['"]?(secret|token|pass|key|api_key)['"]?\\s*:/gi);
    const placeholderVals = countMatches(content, /your_|changeme|placeholder/gi);`
);

fs.writeFileSync(vectorFile, vector, 'utf8');
console.log('✓ vector-cache.js');

console.log('\nDone.');
