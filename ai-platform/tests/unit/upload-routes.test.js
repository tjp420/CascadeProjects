const { resolveUploadAuthToken } = require('../../server/lib/upload-client-auth');

describe('upload client auth', () => {
    test('resolveUploadAuthToken prefers access_token', () => {
        const storage = {
            getItem(key) {
                const values = {
                    authToken: 'legacy',
                    token: 'session-token',
                    access_token: 'primary-token'
                };
                return values[key] || null;
            }
        };
        expect(resolveUploadAuthToken(storage)).toBe('primary-token');
    });

    test('resolveUploadAuthToken falls back through known keys', () => {
        const storage = {
            getItem(key) {
                if (key === 'token') return 'jwt-token';
                return null;
            }
        };
        expect(resolveUploadAuthToken(storage)).toBe('jwt-token');
    });

    test('resolveUploadAuthToken returns null when unset', () => {
        const storage = { getItem: () => null };
        expect(resolveUploadAuthToken(storage)).toBeNull();
    });
});

describe('upload routes contract', () => {
    const express = require('express');
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const uploadRoutes = require('../../server/routes/upload');

    async function withUploadServer(run) {
        const app = express();
        app.use(express.json());
        app.use((req, res, next) => {
            req.user = { id: 'test-user', trustLevel: 'bronze' };
            next();
        });
        app.use('/api/upload', uploadRoutes);

        const server = await new Promise((resolve) => {
            const s = app.listen(0, () => resolve(s));
        });
        const { port } = server.address();
        const baseUrl = `http://127.0.0.1:${port}`;

        try {
            await run(baseUrl);
        } finally {
            await new Promise((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()));
            });
        }
    }

    test('POST /api/upload/files accepts multipart files field', async () => {
        await withUploadServer(async (baseUrl) => {
            const tempFile = path.join(os.tmpdir(), `upload-test-${Date.now()}.js`);
            fs.writeFileSync(tempFile, 'console.log("upload test");\n');

            const boundary = '----UploadTestBoundary';
            const fileContent = fs.readFileSync(tempFile);
            const chunks = [];
            const push = (text) => chunks.push(Buffer.from(`${text}\r\n`));

            push(`--${boundary}`);
            push('Content-Disposition: form-data; name="files"; filename="sample.js"');
            push('Content-Type: application/javascript');
            push('');
            chunks.push(fileContent);
            chunks.push(Buffer.from('\r\n'));
            push(`--${boundary}--`);

            const body = Buffer.concat(chunks);
            const response = await fetch(`${baseUrl}/api/upload/files`, {
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`
                },
                body
            });

            const payload = await response.json();
            expect(response.status).toBe(200);
            expect(payload.success).toBe(true);
            expect(Array.isArray(payload.files)).toBe(true);
            expect(payload.files.length).toBe(1);
            expect(payload.files[0].originalName).toBe('sample.js');

            fs.unlinkSync(tempFile);
        });
    });

    test('POST /api/upload/git requires repoUrl', async () => {
        await withUploadServer(async (baseUrl) => {
            const response = await fetch(`${baseUrl}/api/upload/git`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const payload = await response.json();
            expect(response.status).toBe(400);
            expect(payload.success).toBe(false);
            expect(payload.error).toMatch(/repository url/i);
        });
    });

    test('POST /api/upload/files works with upload security for anonymous users', async () => {
        const express = require('express');
        const fs = require('fs');
        const os = require('os');
        const path = require('path');
        const uploadRoutes = require('../../server/routes/upload');
        const { uploadSecurity, contentValidation } = require('../../server/middleware/upload-security');

        const app = express();
        // Mirrors optionalAuthenticate with no Bearer token present
        app.use((req, res, next) => next());
        app.use('/api/upload', uploadSecurity, contentValidation, uploadRoutes);

        const server = await new Promise((resolve) => {
            const s = app.listen(0, () => resolve(s));
        });
        const { port } = server.address();
        const baseUrl = `http://127.0.0.1:${port}`;

        try {
            const tempFile = path.join(os.tmpdir(), `upload-anon-${Date.now()}.js`);
            fs.writeFileSync(tempFile, 'module.exports = {};\n');

            const boundary = '----UploadAnonBoundary';
            const fileContent = fs.readFileSync(tempFile);
            const chunks = [];
            const push = (text) => chunks.push(Buffer.from(`${text}\r\n`));

            push(`--${boundary}`);
            push('Content-Disposition: form-data; name="files"; filename="anon.js"');
            push('Content-Type: application/javascript');
            push('');
            chunks.push(fileContent);
            chunks.push(Buffer.from('\r\n'));
            push(`--${boundary}--`);

            const response = await fetch(`${baseUrl}/api/upload/files`, {
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`
                },
                body: Buffer.concat(chunks)
            });

            const payload = await response.json();
            expect(response.status).toBe(200);
            expect(payload.success).toBe(true);
            expect(payload.uploadId).toBeTruthy();

            fs.unlinkSync(tempFile);
        } finally {
            await new Promise((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()));
            });
        }
    });
});
