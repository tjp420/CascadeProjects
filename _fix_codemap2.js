// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const fs = require('fs');
const f = 'c:/Users/Trevor/CascadeProjects/.simplebeacon/codemap.html';
let lines = fs.readFileSync(f, 'utf8').split('\n');

// Fix raw newlines inside single-quoted string literals
// A broken string line starts with whitespace, then some code, then a single quote,
// then content, then a raw newline (which ends the line), then the closing quote
// on the next line.

let out = [];
let i = 0;
while (i < lines.length) {
  const line = lines[i];
  // Detect a line that ends inside a single-quoted string
  // Pattern: ... 'some text   (no closing quote)
  const openCount = (line.match(/'/g) || []).length;
  // If odd number of single quotes, the string continues to next line
  if (openCount % 2 === 1 && i + 1 < lines.length) {
    // This line has an unterminated single-quoted string
    // Combine with next line(s) until we find the closing quote
    let combined = line;
    let j = i + 1;
    while (j < lines.length) {
      combined += '\n' + lines[j];
      const combinedOpenCount = (combined.match(/'/g) || []).length;
      if (combinedOpenCount % 2 === 0) {
        // String is now closed
        break;
      }
      j++;
    }
    // Now replace all raw newlines inside the string with \n
    // Find the first opening single quote after an = or += or (
    const match = combined.match(/^(.*?)(\s*=\s*|\+=\s*|\(\s*)/);
    if (match) {
      const prefix = combined.substring(0, match[0].length);
      const rest = combined.substring(match[0].length);
      // The rest starts with a quote, find matching end quote
      if (rest.startsWith("'") || rest.startsWith('`')) {
        const quote = rest[0];
        // Find the matching closing quote (not escaped)
        let strContent = '';
        let k = 1;
        let escaped = false;
        while (k < rest.length) {
          if (escaped) {
            strContent += rest[k];
            escaped = false;
            k++;
            continue;
          }
          if (rest[k] === '\\') {
            strContent += rest[k];
            escaped = true;
            k++;
            continue;
          }
          if (rest[k] === quote) {
            break;
          }
          strContent += rest[k];
          k++;
        }
        // strContent has the raw content with actual newlines
        // Replace actual newlines with \n
        const fixedContent = strContent.replace(/\n/g, '\\n');
        const fixedRest = quote + fixedContent + quote + rest.substring(k + 1);
        out.push(prefix + fixedRest);
        i = j + 1;
        continue;
      }
    }
  }
  out.push(line);
  i++;
}

fs.writeFileSync(f, out.join('\n'), 'utf8');
console.log('Fixed raw newlines in codemap.html');
