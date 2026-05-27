const fs = require('fs');
const path = require('path');

async function uploadFile(filePath, displayName) {
    const boundary = '----NodeFormBoundary';
    const fileBuf = fs.readFileSync(filePath);
    const chunks = [];
    const push = (text) => chunks.push(Buffer.from(`${text}\r\n`));

    push(`--${boundary}`);
    push('Content-Disposition: form-data; name="name"');
    push('');
    push(displayName);
    push(`--${boundary}`);
    push('Content-Disposition: form-data; name="description"');
    push('');
    push('http upload test');
    push(`--${boundary}`);
    push('Content-Disposition: form-data; name="model"; filename="model.gguf"');
    push('Content-Type: application/octet-stream');
    push('');
    chunks.push(fileBuf);
    chunks.push(Buffer.from('\r\n'));
    push(`--${boundary}--`);

    const body = Buffer.concat(chunks);
    const start = Date.now();
    const response = await fetch('http://localhost:54355/api/models/upload', {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body
    });
    const text = await response.text();
    console.log('status', response.status, 'ms', Date.now() - start);
    console.log(text.slice(0, 500));
}

const file = process.argv[2];
const name = process.argv[3] || 'http-test-model';
if (!file) {
    console.error('Usage: node scripts/test-upload-http.js <path-to-gguf> [displayName]');
    process.exit(1);
}

uploadFile(path.resolve(file), name).catch((error) => {
    console.error(error);
    process.exit(1);
});
