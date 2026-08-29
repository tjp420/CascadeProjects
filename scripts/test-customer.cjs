const path = require('path');
const db = require(path.join(__dirname, '..', 'coming-soon', 'lib', 'db.cjs'));
const d = db.getDb();
const schema = d.prepare("SELECT sql FROM sqlite_master WHERE name='customers'").get();
console.log('=== customers schema ===');
console.log(schema.sql);
console.log();
try {
    const c = db.getOrCreateCustomer('test@simplebeacon.ai');
    console.log('getOrCreateCustomer result:', JSON.stringify(c, null, 2));
} catch(e) {
    console.log('getOrCreateCustomer error:', e.message);
}
