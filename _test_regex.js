const rel = 'ai-platform\\web\\simplebeacon-dashboard\\js-es2018\\utils-dom.js';
console.log('rel:', rel);
const r1 = /ai-platform[/\\]web[/\\]simplebeacon-dashboard[/\\]js[/\\]/.test(rel);
const r2 = /ai-platform[/\\]web[/\\]simplebeacon-dashboard[/\\]js-es2018[/\\]/.test(rel);
console.log('js match:', r1);
console.log('js-es2018 match:', r2);
