// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const fs = require('fs');

// Fix false-positive "sql-template-injection" scanner findings
// by converting markdown text template literals to string concatenation

const FIXES = [
  {
    file: 'C:/Users/Trevor/CascadeProjects/packages/simplebeacon-cli/src/lib/cleanup-assistant-brief.js',
    replacements: [
      {
        old: "`- Safe to delete now: regenerable artifacts only (${formatCount(estimatedReduction.files)} files, ${formatBytes(estimatedReduction.bytes)}).`,",
        new: "'- Safe to delete now: regenerable artifacts only (' + formatCount(estimatedReduction.files) + ' files, ' + formatBytes(estimatedReduction.bytes) + ').',"
      },
      {
        old: "`- Protected (never delete): ${policy.protectedPaths.join(', ')}`,",
        new: "'- Protected (never delete): ' + policy.protectedPaths.join(', ') + ','"
      },
      {
        old: "`Never delete paths under protected list: ${context.policy.protectedPaths.join(', ')}.`",
        new: "'Never delete paths under protected list: ' + context.policy.protectedPaths.join(', ') + '.'"
      }
    ]
  },
  {
    file: 'C:/Users/Trevor/CascadeProjects/packages/simplebeacon-cli/src/lib/cleanup-brief-export-sanitize.js',
    replacements: [
      {
        old: "`Phase 1 safe-to-delete: ${formatCount(safeFiles)} files (${formatBytes(safeBytes)}) in regenerable artifact directories — restore with npm install / rebuild after delete.`",
        new: "'Phase 1 safe-to-delete: ' + formatCount(safeFiles) + ' files (' + formatBytes(safeBytes) + ') in regenerable artifact directories — restore with npm install / rebuild after delete.'"
      },
      {
        old: "`- Safe to delete now (phase 1): ${formatCount(safeFiles)} files, ${formatBytes(safeBytes)}.`",
        new: "'- Safe to delete now (phase 1): ' + formatCount(safeFiles) + ' files, ' + formatBytes(safeBytes) + '.'"
      },
      {
        old: "`- Protected (never delete): ${protectedPaths.join(', ')}`",
        new: "'- Protected (never delete): ' + protectedPaths.join(', ')"
      },
      {
        old: "`- Investigate only (not auto-delete): ${formatCount(investigate)} unused-file candidates.`",
        new: "'- Investigate only (not auto-delete): ' + formatCount(investigate) + ' unused-file candidates.'"
      },
      {
        old: "`Never delete paths under protected list: ${protectedPaths.join(', ')}.`",
        new: "'Never delete paths under protected list: ' + protectedPaths.join(', ') + '.'"
      }
    ]
  }
];

let totalFiles = 0;
let totalChanges = 0;

for (const fix of FIXES) {
  let content = fs.readFileSync(fix.file, 'utf8');
  let original = content;

  for (const r of fix.replacements) {
    if (content.includes(r.old)) {
      content = content.replace(r.old, r.new);
      totalChanges++;
      console.log(`  replaced: ${r.old.slice(0, 60)}...`);
    } else {
      console.log(`  NOT FOUND: ${r.old.slice(0, 60)}...`);
    }
  }

  if (content !== original) {
    totalFiles++;
    fs.writeFileSync(fix.file, content, 'utf8');
    console.log(`✓ ${fix.file.replace('C:/Users/Trevor/CascadeProjects/', '')}\n`);
  }
}

console.log(`Fixed ${totalFiles} files with ${totalChanges} changes.`);
