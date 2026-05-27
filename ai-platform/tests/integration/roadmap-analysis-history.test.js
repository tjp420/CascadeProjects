const express = require('express');
const path = require('path');
const setupBuildFromPathRoute = require('../../src/api/build-from-path-route');

async function withRoadmapServer(fn) {
    const app = express();
    app.use(express.json());
    app.locals.db = null;
    setupBuildFromPathRoute(app);

    const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });

    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
        await fn(baseUrl);
    } finally {
        await new Promise((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
        });
    }
}

describe('roadmap analysis history API', () => {
    test('GET /api/dynamic-roadmap/history returns client-only payload without database', async () => {
        await withRoadmapServer(async (baseUrl) => {
            const response = await fetch(`${baseUrl}/api/dynamic-roadmap/history`);
            expect(response.ok).toBe(true);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.source).toBe('client-only');
            expect(Array.isArray(data.entries)).toBe(true);
        });
    });

    test('POST /api/dynamic-roadmap/history accepts entries without database', async () => {
        await withRoadmapServer(async (baseUrl) => {
            const response = await fetch(`${baseUrl}/api/dynamic-roadmap/history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entry: {
                        id: 'scan-test',
                        projectPath: 'C:\\Projects\\demo',
                        title: 'Demo',
                        timestamp: new Date().toISOString()
                    }
                })
            });
            expect(response.ok).toBe(true);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.stored).toBe(false);
            expect(data.source).toBe('client-only');
        });
    });

    test('DELETE /api/dynamic-roadmap/history succeeds without database', async () => {
        await withRoadmapServer(async (baseUrl) => {
            const response = await fetch(`${baseUrl}/api/dynamic-roadmap/history`, {
                method: 'DELETE'
            });
            expect(response.ok).toBe(true);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.cleared).toBe(false);
        });
    });

    test('GET /api/code-roadmap/export/html returns executive HTML', async () => {
        const projectPath = path.join(__dirname, '../..');
        await withRoadmapServer(async (baseUrl) => {
            const response = await fetch(
                `${baseUrl}/api/code-roadmap/export/html?projectPath=${encodeURIComponent(projectPath)}`
            );
            expect(response.ok).toBe(true);
            expect(response.headers.get('content-type')).toMatch(/text\/html/);
            const html = await response.text();
            expect(html).toContain('Executive Summary');
            expect(html).toContain('Sprint');
        });
    });
});
