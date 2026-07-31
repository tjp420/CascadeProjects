const fs = require('fs');
const path = require('path');
const routesDir = 'ai-platform/server/routes';
const failedFiles = ['auth-inline-routes.cjs', 'chatbot-api.cjs', 'demo-simplebeacon-api.cjs', 'external-weather-api.cjs', 'proxy-ollama-api.cjs', 'sso-routes.cjs', 'stripe-webhook-routes.cjs'];

for (const file of failedFiles) {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix pattern: sendError(res, N, 'error', extra: value) → sendError(res, N, 'error', { extra: value })
  // The broken pattern is: sendError(res, N, STRING, key: value)
  // We need to wrap everything after the 3rd arg in { }
  content = content.replace(
    /sendError\(res, (\d+), ('[^']*'|"[^"]*"|`[^`]*`), ([a-zA-Z_]\w*:[^)]+)\)/g,
    (match, status, error, extra) => {
      return 'sendError(res, ' + status + ', ' + error + ', { ' + extra.trim() + ' })';
    }
  );
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed: ' + file);
}
