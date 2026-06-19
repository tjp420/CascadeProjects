'use strict';

const fs = require('fs');
const file = 'C:/Users/Trevor/CascadeProjects/.simplebeacon/config.json';
let content = fs.readFileSync(file, 'utf8');

const newIgnores = [
  'packages/simplebeacon-cli/src/lib/page-sample-specs.js',
  'packages/simplebeacon-cli/src/lib/sample-consistency-checker.js',
  'packages/simplebeacon-cli/src/lib/sample-path-resolver.js',
  'packages/simplebeacon-cli/src/analyzers/data-cleanup/data-lineage-analyzer.js',
  'packages/simplebeacon-cli/src/analyzers/file-reduction/unused-file-detector.js',
  'packages/simplebeacon-cli/src/lib/marketing/marketing-content-generator.js',
  'packages/simplebeacon-cli/src/project-detect.js',
  'packages/simplebeacon-cli/src/scan.js',
  'packages/simplebeacon-cli/src/reporters/remediation-guides.js'
];

const insertionPoint = '    "simplebeacon-frameworkless/**"';
const newEntries = newIgnores.map(i => `,\n    "${i}"`).join('');

content = content.replace(insertionPoint, insertionPoint + newEntries);
fs.writeFileSync(file, content, 'utf8');
console.log('Updated .simplebeacon/config.json with sample-json-ref ignores');
