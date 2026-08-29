const path = require('path');
const db = require(path.join(__dirname, '..', 'coming-soon', 'lib', 'db.cjs'));
const d = db.getDb();

const tables = d.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name).join(', '));

try {
    const subs = d.prepare('SELECT * FROM paid_subscriptions ORDER BY rowid DESC LIMIT 5').all();
    console.log('\n=== paid_subscriptions ===');
    console.log(JSON.stringify(subs, null, 2));
} catch(e) { console.log('No paid_subscriptions table:', e.message); }

try {
    const customers = d.prepare('SELECT * FROM customers ORDER BY rowid DESC LIMIT 5').all();
    console.log('\n=== customers ===');
    console.log(JSON.stringify(customers, null, 2));
} catch(e) { console.log('No customers table:', e.message); }

try {
    const events = d.prepare('SELECT * FROM webhook_events ORDER BY rowid DESC LIMIT 5').all();
    console.log('\n=== webhook_events ===');
    console.log(JSON.stringify(events, null, 2));
} catch(e) { console.log('No webhook_events table:', e.message); }
