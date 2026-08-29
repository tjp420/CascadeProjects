const path = require('path');
const db = require(path.join(__dirname, '..', 'coming-soon', 'lib', 'db.cjs'));
const d = db.getDb();

// Check email queue
try {
    const emails = d.prepare("SELECT * FROM email_queue ORDER BY rowid DESC LIMIT 5").all();
    console.log('=== email_queue ===');
    emails.forEach(e => {
        console.log(`  To: ${e.to_email} | Subject: ${e.subject} | Status: ${e.status} | Created: ${e.created_at}`);
    });
} catch(e) { console.log('email_queue error:', e.message); }

// Check token chain
try {
    const tokens = d.prepare("SELECT * FROM token_nodes ORDER BY rowid DESC LIMIT 5").all();
    console.log('\n=== token_nodes ===');
    tokens.forEach(t => {
        console.log(`  Email: ${t.email} | Token: ${String(t.token_hash || t.token || '').substring(0, 30)}... | Active: ${t.is_active} | TTL: ${t.ttl_minutes}min`);
    });
} catch(e) { console.log('token_nodes error:', e.message); }

// Check free_tokens
try {
    const free = d.prepare("SELECT * FROM free_tokens ORDER BY rowid DESC LIMIT 5").all();
    console.log('\n=== free_tokens ===');
    free.forEach(f => {
        console.log(`  Email: ${f.email} | Token: ${String(f.token || '').substring(0, 30)}... | Revoked: ${f.revoked}`);
    });
} catch(e) { console.log('free_tokens error:', e.message); }
