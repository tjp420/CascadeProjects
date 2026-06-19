const fs = require('fs');
const file = 'C:/Users/Trevor/CascadeProjects/packages/simplebeacon-cli/src/compliance-checklist.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  "const path = require('path');",
  "const path = require('path');\nconst constants = require('../../../ai-platform/server/config/constants.cjs');"
);
fs.writeFileSync(file, content, 'utf8');
console.log('Fixed compliance-checklist.js');
