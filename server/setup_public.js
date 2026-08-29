// server/setup_public.js
// Creates public/ success & cancel pages for the Stripe test server

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const publicDir = path.join(repoRoot, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

const successHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment success</title>
</head>
<body>
  <h1>Payment successful</h1>
  <p>Thank you — this was a test payment in Stripe Test Mode. No real funds were transferred.</p>
  <p>Return to your app or close this window.</p>
</body>
</html>`;

const cancelHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment canceled</title>
</head>
<body>
  <h1>Payment canceled</h1>
  <p>The test payment was canceled. No action was taken.</p>
</body>
</html>`;

fs.writeFileSync(path.join(publicDir, 'success.html'), successHtml, 'utf8');
fs.writeFileSync(path.join(publicDir, 'cancel.html'), cancelHtml, 'utf8');
console.log('Created public/success.html and public/cancel.html');
