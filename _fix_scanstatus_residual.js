// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const fs = require('fs');
const path = 'c:/Users/Trevor/CascadeProjects/ai-platform/web/simplebeacon-dashboard/js-es2018/components/ScanStatus.js';
let content = fs.readFileSync(path, 'utf8');

const leftoverStart = '                                    onLocalScanResult(report);';
const startIdx = content.indexOf(leftoverStart);
if (startIdx === -1) throw new Error('leftover start not found');

const endMarker = '        });';
const endIdx = content.indexOf(endMarker, startIdx);
if (endIdx === -1) throw new Error('end marker not found');

const newContent = content.slice(0, startIdx) + content.slice(endIdx + endMarker.length);
fs.writeFileSync(path, newContent);
console.log('fixed residual');
