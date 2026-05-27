const fs = require('fs');
let html = fs.readFileSync('web/dashboard.html', 'utf8');
const lines = html.split('\n');

let braceCount = 0;
let inString = false;
let stringChar = '';

for (let i = 13077; i < 13380; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (inString) {
            if (char === stringChar && line[j-1] !== '\\\\') {
                inString = false;
            }
        } else {
            if (char === "'" || char === '"' || char === "\") {
                inString = true;
                stringChar = char;
            } else if (char === '{') {
                braceCount++;
            } else if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                    console.log('Function closed at line', i + 1);
                }
            }
        }
    }
}
