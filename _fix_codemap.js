// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const fs = require('fs');
const f = 'c:/Users/Trevor/CascadeProjects/.simplebeacon/codemap.html';
let s = fs.readFileSync(f, 'utf8');

// Fix the score breakdown section - replace raw newlines inside string literals with \n
// Pattern 1: let msg = 'Score Breakdown\n\n';
s = s.replace(
  /let msg = 'Score Breakdown\n\n';/,
  "let msg = 'Score Breakdown\\n\\n';"
);

// Pattern 2: Architecture line
s = s.replace(
  /msg \+= 'Architecture: ' \+ \(ANALYSIS\.summary\.architectureScore \|\| 0\) \+ '\n';/,
  "msg += 'Architecture: ' + (ANALYSIS.summary.architectureScore || 0) + '\\n';"
);

// Pattern 3: Coupling line
s = s.replace(
  /msg \+= 'Coupling: ' \+ \(ANALYSIS\.summary\.couplingScore \|\| 0\) \+ '\n';/,
  "msg += 'Coupling: ' + (ANALYSIS.summary.couplingScore || 0) + '\\n';"
);

// Pattern 4: Complexity line
s = s.replace(
  /msg \+= 'Complexity: ' \+ \(ANALYSIS\.summary\.complexityScore \|\| 0\) \+ '\n';/,
  "msg += 'Complexity: ' + (ANALYSIS.summary.complexityScore || 0) + '\\n';"
);

// Pattern 5: Tests line with double newline
s = s.replace(
  /msg \+= 'Tests: ' \+ \(ANALYSIS\.summary\.testScore \|\| 0\) \+ '\n\n';/,
  "msg += 'Tests: ' + (ANALYSIS.summary.testScore || 0) + '\\n\\n';"
);

// Pattern 6: Top Issues line
s = s.replace(
  /msg \+= 'Top Issues:\n';/,
  "msg += 'Top Issues:\\n';"
);

// Pattern 7: forEach body with bullet point - needs to handle the raw newline inside the string
s = s.replace(
  /issues\.slice\(0, 5\)\.forEach\(i => \{ msg \+= '• ' \+ i\.title \+ ' \(' \+ i\.files\.length \+ ' files\)\n'; \}\);/,
  "issues.slice(0, 5).forEach(i => { msg += '• ' + i.title + ' (' + i.files.length + ' files)\\n'; });"
);

// Pattern 8: Improvements line with leading newline
s = s.replace(
  /msg \+= '\nImprovements:\n';/,
  "msg += '\\nImprovements:\\n';"
);

// Pattern 9: forEach body for improvements
s = s.replace(
  /improvements\.slice\(0, 5\)\.forEach\(i => \{ msg \+= '• ' \+ i\.title \+ ' \(' \+ i\.files\.length \+ ' files\)\n'; \}\);/,
  "improvements.slice(0, 5).forEach(i => { msg += '• ' + i.title + ' (' + i.files.length + ' files)\\n'; });"
);

fs.writeFileSync(f, s, 'utf8');
console.log('Fixed codemap raw newlines');
