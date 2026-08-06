#!/usr/bin/env node
// Cross-platform launcher that ensures the dashboard binds to port 58000
process.env.LOCAL_DASHBOARD_PORT = process.env.LOCAL_DASHBOARD_PORT || '58000';
// Load the server script from the repository root
require('../local_dashboard_server.js');
