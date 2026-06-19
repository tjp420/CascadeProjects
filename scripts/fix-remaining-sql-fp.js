const fs = require('fs');

const FIXES = [
  {
    file: 'C:/Users/Trevor/CascadeProjects/packages/simplebeacon-cli/src/lib/cleanup-brief-export-sanitize.js',
    replacements: [
      {
        old: "`- Safe to delete now (phase 1): ${formatCount(safeFiles)} files, ${formatBytes(estimatedReduction.bytes)}.`",
        new: "'- Safe to delete now (phase 1): ' + formatCount(safeFiles) + ' files, ' + formatBytes(estimatedReduction.bytes) + '.'"
      },
      {
        old: "lines.push(`- Investigate only (not auto-delete): ${formatCount(investigate)} unused-file candidates — static analysis`);",
        new: "lines.push('- Investigate only (not auto-delete): ' + formatCount(investigate) + ' unused-file candidates — static analysis');"
      },
      {
        old: "lines.push(`${investigate} unused-file candidates are investigate-only — verify imports before any deletion.`);",
        new: "lines.push(investigate + ' unused-file candidates are investigate-only — verify imports before any deletion.');"
      }
    ]
  },
  {
    file: 'C:/Users/Trevor/CascadeProjects/packages/simplebeacon-cli/src/lib/data-cleanup-export-sanitize.js',
    replacements: [
      {
        old: "return `Phase 1 safe-delete: ~${Number(safeBytes).toLocaleString()} B in regenerable artifact directories — see fileReductionPlan.safeToDelete before deleting.`",
        new: "return 'Phase 1 safe-delete: ~' + Number(safeBytes).toLocaleString() + ' B in regenerable artifact directories — see fileReductionPlan.safeToDelete before deleting.'"
      }
    ]
  },
  {
    file: 'C:/Users/Trevor/CascadeProjects/packages/simplebeacon-cli/src/lib/pdf-generator.js',
    replacements: [
      {
        old: "${data.issues.slice(0, 3).map(i => `<li>Delete or replace: ${(i.recommendedAction || i.recommendation || 'Review manually').slice(0, 120)}.</li>`).join('')}",
        new: "${data.issues.slice(0, 3).map(i => '<li>Delete or replace: ' + (i.recommendedAction || i.recommendation || 'Review manually').slice(0, 120) + '.</li>').join('')}"
      }
    ]
  },
  {
    file: 'C:/Users/Trevor/CascadeProjects/packages/simplebeacon-cli/bin/enrich-complete-scan.js',
    replacements: [
      {
        old: "console.log(`Safe to delete: ${analysis.fileReduction?.safeToDeleteBytes ?? '—'} bytes`);",
        new: "console.log('Safe to delete: ' + (analysis.fileReduction?.safeToDeleteBytes ?? '—') + ' bytes');"
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
      console.log(`  replaced in ${fix.file.replace(/^.*[/\\]/, '')}`);
    } else {
      console.log(`  NOT FOUND in ${fix.file.replace(/^.*[/\\]/, '')}: ${r.old.slice(0, 50)}...`);
    }
  }

  if (content !== original) {
    totalFiles++;
    fs.writeFileSync(fix.file, content, 'utf8');
    console.log(`✓ ${fix.file.replace('C:/Users/Trevor/CascadeProjects/', '')}\n`);
  }
}

console.log(`Fixed ${totalFiles} files with ${totalChanges} changes.`);
