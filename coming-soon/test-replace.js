// Test: does $1 in function replacement get interpreted as backreference?
const html = '<meta charset="UTF-8">\n<title>How We Found $1.25M</title>';
const headBlock = '    <title>How We Found $1.25M in AI Slop</title>';
const result = html.replace(/(<meta[^>]*charset[^>]*>)/i, (match) => match + '\n' + headBlock + '\n');
console.log('Result:');
console.log(result);
console.log('---');
console.log('Contains $1 in output:', result.includes('$1'));
console.log('Contains <meta charset> in title:', result.includes('<meta charset="UTF-8">.25M'));
