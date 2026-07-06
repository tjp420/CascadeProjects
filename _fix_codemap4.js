const fs = require('fs');
const f = 'c:/Users/Trevor/CascadeProjects/.simplebeacon/codemap.html';
let s = fs.readFileSync(f, 'utf8');

// Block 1: Score Breakdown header
s = s.replace(
  "let msg = 'Score Breakdown\n\n';",
  "let msg = 'Score Breakdown\\n\\n';"
);

// Block 2: Architecture line
s = s.replace(
  "msg += 'Architecture: ' + (ANALYSIS.summary.architectureScore || 0) + '\n';",
  "msg += 'Architecture: ' + (ANALYSIS.summary.architectureScore || 0) + '\\n';"
);

// Block 3: Coupling line
s = s.replace(
  "msg += 'Coupling: ' + (ANALYSIS.summary.couplingScore || 0) + '\n';",
  "msg += 'Coupling: ' + (ANALYSIS.summary.couplingScore || 0) + '\\n';"
);

// Block 4: Complexity line
s = s.replace(
  "msg += 'Complexity: ' + (ANALYSIS.summary.complexityScore || 0) + '\n';",
  "msg += 'Complexity: ' + (ANALYSIS.summary.complexityScore || 0) + '\\n';"
);

// Block 5: Tests line (double newline)
s = s.replace(
  "msg += 'Tests: ' + (ANALYSIS.summary.testScore || 0) + '\n\n';",
  "msg += 'Tests: ' + (ANALYSIS.summary.testScore || 0) + '\\n\\n';"
);

// Block 6: Top Issues header
s = s.replace(
  "msg += 'Top Issues:\n';",
  "msg += 'Top Issues:\\n';"
);

// Block 7: bullet point in issues forEach
s = s.replace(
  "issues.slice(0, 5).forEach(i => { msg += '• ' + i.title + ' (' + i.files.length + ' files)\n'; });",
  "issues.slice(0, 5).forEach(i => { msg += '• ' + i.title + ' (' + i.files.length + ' files)\\n'; });"
);

// Block 8: Improvements header
s = s.replace(
  "msg += '\nImprovements:\n';",
  "msg += '\\nImprovements:\\n';"
);

// Block 9: bullet point in improvements forEach
s = s.replace(
  "improvements.slice(0, 5).forEach(i => { msg += '• ' + i.title + ' (' + i.files.length + ' files)\n'; });",
  "improvements.slice(0, 5).forEach(i => { msg += '• ' + i.title + ' (' + i.files.length + ' files)\\n'; });"
);

fs.writeFileSync(f, s, 'utf8');
console.log('done');
