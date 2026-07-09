const express = require('express');
const { setupAdminAPI } = require('./ai-platform/server/routes/admin-api.cjs');

const app = express();
app.use(express.json());

// mock app.locals.db
app.locals.db = {
  query: async (sql, params) => ({
    rows: [
      { id: 'user-1', email: 'a@example.com', name: 'A', trust_level: 'gold', verification_status: 'verified', successful_analyses: 5, security_incidents: 0, community_contributions: 1, created_at: new Date().toISOString() }
    ]
  })
};

setupAdminAPI(app, { platformRoot: __dirname });

const routes = app._router.stack
  .filter(layer => layer.route)
  .map(layer => `${Object.keys(layer.route.methods).join(',')} ${layer.route.path}`);
console.log('Registered admin routes:', routes);

// simulate admin user
app.get('/api/admin/users', (req, res, next) => {
  req.user = { id: 'admin', role: 'admin', email: 'admin@example.com', name: 'Admin' };
  next();
});

const port = 3456;
const server = app.listen(port, async () => {
  const response = await fetch(`http://localhost:${port}/api/admin/users`, { headers: { Authorization: 'Bearer dummy' } });
  const body = await response.json();
  console.log('GET /api/admin/users status:', response.status);
  console.log(JSON.stringify(body, null, 2));
  server.close();
});
