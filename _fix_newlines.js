const fs = require('fs');
const f = 'c:/Users/Trevor/CascadeProjects/.simplebeacon/codemap.html';
let s = fs.readFileSync(f, 'utf8');

// Fix unescaped newlines inside single-quoted string literals in the score breakdown section
// The pattern is: lines that have raw newlines inside '...' strings

// Replace "let msg = 'Score Breakdown\n\n';"  -> "let msg = 'Score Breakdown\\n\\n';"
s = s.replace(
  /let msg = 'Score Breakdown\n\n';/,
  "let msg = 'Score Breakdown\\n\\n';"
);

// Replace Architecture line
s = s.replace(
  /msg \+= 'Architecture: ' \+ \(ANALYSIS\.summary\.architectureScore \|\| 0\) \+ '\n';/,
  "msg += 'Architecture: ' + (ANALYSIS.summary.architectureScore || 0) + '\\n';"
);

// Replace Coupling line
s = s.replace(
  /msg \+= 'Coupling: ' \+ \(ANALYSIS\.summary\.couplingScore \|\| 0\) \+ '\n';/,
  "msg += 'Coupling: ' + (ANALYSIS.summary.couplingScore || 0) + '\\n';"
);

// Replace Complexity line
s = s.replace(
  /msg \+= 'Complexity: ' \+ \(ANALYSIS\.summary\.complexityScore \|\| 0\) \+ '\n';/,
  "msg += 'Complexity: ' + (ANALYSIS.summary.complexityScore || 0) + '\\n';"
);

// Replace Tests line with double newline
s = s.replace(
  /msg \+= 'Tests: ' \+ \(ANALYSIS\.summary\.testScore \|\| 0\) \+ '\n\n';/,
  "msg += 'Tests: ' + (ANALYSIS.summary.testScore || 0) + '\\n\\n';"
);

// Replace Top Issues line
s = s.replace(
  /msg \+= 'Top Issues:\n';/,
  "msg += 'Top Issues:\\n';"
);

// Replace the forEach loop bodies - pattern: msg += '• ... files)\n';
s = s.replace(
  /msg \+= '• ' \+ i\.title \+ ' \(' \+ i\.files\.length \+ ' files\)\n'; \}\);/,
  "msg += '• ' + i.title + ' (' + i.files.length + ' files)\\n'; });"
);

// Replace Improvements line
s = s.replace(
  /msg \+= '\nImprovements:\n';/,
  "msg += '\\nImprovements:\\n';"
);

// Also handle the second forEach for improvements
s = s.replace(
  /msg \+= '• ' \+ i\.title \+ ' \(' \+ i\.files\.length \+ ' files\)\n'; \}\);/,
  "msg += '• ' + i.title + ' (' + i.files.length + ' files)\\n'; });"
);

fs.writeFileSync(f, s, 'utf8');
console.log('Fixed raw newlines');
