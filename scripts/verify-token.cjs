const path = require('path');
const db = require(path.join(__dirname, '..', 'coming-soon', 'lib', 'db.cjs'));
const { validateLicenseToken } = require(path.join(__dirname, '..', 'packages', 'simplebeacon-cli', 'src', 'lib', 'license-token.js'));

const d = db.getDb();

// Get the token from the token chain
const tokenNode = d.prepare("SELECT * FROM token_nodes ORDER BY rowid DESC LIMIT 1").get();
console.log('=== Token node ===');
console.log('Email:', tokenNode.email);
console.log('Token hash:', tokenNode.token_hash);
console.log('Token (first 50):', String(tokenNode.token_hash || '').substring(0, 50));

// The server stored a hash, not the raw token. The raw token was sent via email.
// Let's check if we can find it in the email queue
const emails = d.prepare("SELECT * FROM email_queue ORDER BY rowid DESC LIMIT 3").all();
console.log('\n=== Recent emails ===');
emails.forEach(e => {
    console.log('Subject:', e.subject);
    console.log('Status:', e.status);
    console.log('Body (first 500):', String(e.body || e.html_body || '').substring(0, 500));
    console.log('---');
});
