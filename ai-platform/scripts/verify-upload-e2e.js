const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE_URL = process.env.UPLOAD_TEST_URL || 'http://127.0.0.1:54355';

async function main() {
    const login = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'dev@simplebeacon.ai', password: 'demo123' })
    });
    const loginBody = await login.json();
    console.log('login', login.status, loginBody.message || loginBody.error);
    if (!loginBody.token) {
        process.exit(1);
    }

    const tempFile = path.join(os.tmpdir(), `live-upload-test-${Date.now()}.js`);
    fs.writeFileSync(tempFile, 'console.log("live upload");\n');

    const boundary = '----LiveUploadBoundary';
    const fileContent = fs.readFileSync(tempFile);
    const chunks = [];
    const push = (text) => chunks.push(Buffer.from(`${text}\r\n`));

    push(`--${boundary}`);
    push('Content-Disposition: form-data; name="files"; filename="live.js"');
    push('Content-Type: application/javascript');
    push('');
    chunks.push(fileContent);
    chunks.push(Buffer.from('\r\n'));
    push(`--${boundary}--`);

    const body = Buffer.concat(chunks);
    const upload = await fetch(`${BASE_URL}/api/upload/files`, {
        method: 'POST',
        headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            Authorization: `Bearer ${loginBody.token}`
        },
        body
    });
    const uploadText = await upload.text();
    console.log('upload', upload.status, uploadText.slice(0, 400));
    fs.unlinkSync(tempFile);
    process.exit(upload.ok ? 0 : 1);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
