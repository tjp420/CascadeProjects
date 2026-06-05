const fs = require('fs');
const storePath = require('path').join(__dirname, '..', '.simplebeacon', 'subscriptions.json');
const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
const rec = store.subscriptions['trevor_punt@live.com'];
if (rec && rec.licenseToken) {
  fs.writeFileSync(require('path').join(__dirname, '..', '.simplebeacon', 'test-token.txt'), rec.licenseToken + '\n');
  console.log('Token saved to .simplebeacon/test-token.txt');
} else {
  console.log('No token found');
}
