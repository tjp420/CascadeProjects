const fs = require('fs');
const f = 'c:/Users/Trevor/CascadeProjects/simplebeacon-vscode-merged/src/welcomeDashboardHtml.ts';
const s = fs.readFileSync(f, 'utf8');

// Extract content from first <script nonce="..."> tag
const match = s.match(/<script nonce="\$\{nonce\}">([\s\S]*?)<\/script>/);
if (!match) {
  console.log('No script tag found');
  process.exit(1);
}

const js = match[1];

// Replace vscode references with a mock
const mockVscode = 'var vscode={postMessage:function(){},acquireVsCodeApi:function(){return vscode;}};window={vscode:vscode,postMessage:function(){},addEventListener:function(){}};document={addEventListener:function(){},querySelectorAll:function(){return[];},getElementById:function(){return null;}};';

// Replace acquireVsCodeApi reference that might be called
const wrapped = '(function(){' + mockVscode + js + '})()';

try {
  new Function(wrapped);
  console.log('Syntax OK');
} catch (e) {
  console.log('Syntax error:', e.message);
  console.log('Line context:', e.lineNumber);
}
