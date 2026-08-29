const path = require('path');
const db = require(path.join(__dirname, '..', 'coming-soon', 'lib', 'db.cjs'));
const d = db.getDb();
const events = d.prepare("SELECT event_type, received_at FROM webhook_events ORDER BY received_at DESC LIMIT 20").all();
console.log('=== All webhook events received ===');
events.forEach(e => console.log(`  ${e.received_at}  ${e.event_type}`));
