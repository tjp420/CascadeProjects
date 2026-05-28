#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const targets = [
  path.join(__dirname, '..', 'web', 'api', 'mock-backend.js'),
  path.join(__dirname, '..', 'web', 'api', 'mock-backend-static-data.js')
];

const replacements = [
  [/\/gguf\//g, '/mock-scanner/'],
  [/generateGGUF/g, 'generateMock'],
  [/GGUF/g, 'Simplebeacon'],
  [/gguf/g, 'mock']
];

for (const filePath of targets) {
  if (!fs.existsSync(filePath)) continue;
  let text = fs.readFileSync(filePath, 'utf8');
  const before = text;
  for (const [pattern, value] of replacements) {
    text = text.replace(pattern, value);
  }
  if (text !== before) {
    fs.writeFileSync(filePath, text, 'utf8');
    console.log('Updated', path.basename(filePath));
  }
}
