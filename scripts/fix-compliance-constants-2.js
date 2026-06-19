const fs = require('fs');
const file = 'C:/Users/Trevor/CascadeProjects/packages/simplebeacon-cli/src/compliance-checklist.js';
let content = fs.readFileSync(file, 'utf8');
// Remove the duplicate constants import inside the try block
content = content.replace(
  "            const { runNpmAudit } = require(auditRunnerPath);\nconst constants = require('../../../ai-platform/server/config/constants.cjs');\n            const audit = runNpmAudit(root, { force: false });",
  "            const { runNpmAudit } = require(auditRunnerPath);\n            const audit = runNpmAudit(root, { force: false });"
);
fs.writeFileSync(file, content, 'utf8');
console.log('Removed duplicate constants import');
