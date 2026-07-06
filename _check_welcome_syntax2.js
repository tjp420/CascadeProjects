const fs = require('fs');
const f = 'c:/Users/Trevor/CascadeProjects/simplebeacon-vscode-merged/src/welcomeDashboardHtml.ts';
const s = fs.readFileSync(f, 'utf8');

const match = s.match(/<script nonce="\$\{nonce\}">([\s\S]*?)<\/script>/);
if (!match) {
  console.log('No script tag found');
  process.exit(1);
}

const js = match[1];

// Mock globals without redeclaring 'vscode' (the script declares 'let vscode' itself)
const mockGlobals = `
var window={location:{},postMessage:function(){},addEventListener:function(){}};
var document={addEventListener:function(){},querySelectorAll:function(){return[];},getElementById:function(){return null;},querySelector:function(){return null;}};
`;

const wrapped = '(function(){' + mockGlobals + js + '})()';

try {
  new Function(wrapped);
  console.log('Syntax OK');
} catch (e) {
  console.log('Syntax error:', e.message);
}
