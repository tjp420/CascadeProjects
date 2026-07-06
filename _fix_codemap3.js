const fs = require('fs');
const f = 'c:/Users/Trevor/CascadeProjects/.simplebeacon/codemap.html';
let s = fs.readFileSync(f, 'utf8');

// Use a line-by-line approach: detect lines with odd number of single quotes
// and merge them until the string is closed, then replace newlines with \n

let lines = s.split('\n');
let out = [];
let i = 0;
while (i < lines.length) {
  let line = lines[i];
  let quoteCount = 0;
  for (let j = 0; j < line.length; j++) {
    if (line[j] === "'" && (j === 0 || line[j-1] !== '\\')) {
      quoteCount++;
    }
  }
  // If odd number of quotes, the string continues to next line(s)
  if (quoteCount % 2 === 1) {
    let combined = line;
    let j = i + 1;
    while (j < lines.length) {
      combined += '\n' + lines[j];
      let qc = 0;
      for (let k = 0; k < combined.length; k++) {
        if (combined[k] === "'" && (k === 0 || combined[k-1] !== '\\')) {
          qc++;
        }
      }
      if (qc % 2 === 0) break;
      j++;
    }
    // Now fix: replace actual newlines between quotes with \n
    // Find first unmatched quote position
    let firstQuote = combined.indexOf("'");
    let lastQuote = -1;
    let qCount = 0;
    for (let k = 0; k < combined.length; k++) {
      if (combined[k] === "'" && (k === 0 || combined[k-1] !== '\\')) {
        qCount++;
        if (qCount % 2 === 0) {
          lastQuote = k;
        }
      }
    }
    if (firstQuote >= 0 && lastQuote > firstQuote) {
      let before = combined.substring(0, firstQuote);
      let content = combined.substring(firstQuote + 1, lastQuote);
      let after = combined.substring(lastQuote + 1);
      let fixedContent = content.replace(/\n/g, '\\n');
      out.push(before + "'" + fixedContent + "'" + after);
    } else {
      out.push(combined);
    }
    i = j + 1;
    continue;
  }
  out.push(line);
  i++;
}

fs.writeFileSync(f, out.join('\n'), 'utf8');
console.log('Fixed raw newlines');
