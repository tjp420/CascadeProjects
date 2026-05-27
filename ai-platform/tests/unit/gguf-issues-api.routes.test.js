const express = require('express');
const core = require('../../core');

function collectMountedRoutes(app) {
    const routes = [];
    const stack = app?._router?.stack || [];
    for (const layer of stack) {
        if (!layer.route && layer.name === 'router' && layer.handle?.stack) {
            for (const child of layer.handle.stack) {
                if (!child.route) continue;
                routes.push({
                    path: child.route.path,
                    methods: Object.keys(child.route.methods || {})
                });
            }
        }
    }
    return routes;
}

describe('GGUF issues API core route surface', () => {
    test('mounts essential scan/detect/fix/rollback endpoints', async () => {
        const app = express();
        app.use(express.json());

        const api = new core.GGUFIssuesAPI(app, {
            enableRealTime: false,
            enableAI: false,
            enableBackups: true,
            enableValidation: true
        });

        try {
            const routes = collectMountedRoutes(app);
            const routeMap = new Map(routes.map((route) => [route.path, route.methods]));

            expect(routeMap.get('/scan')).toContain('get');
            expect(routeMap.get('/detect')).toContain('post');
            expect(routeMap.get('/fix/apply')).toContain('post');
            expect(routeMap.get('/fix/rollback/:fixId')).toContain('post');
        } finally {
            await api.cleanup();
        }
    });
});
