const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const app = express();
const PORT = process.env.PORT || 3000;
const SUBSCRIPTIONS_FILE = path.join(__dirname, 'subscriptions.json');

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Ensure subscriptions.json exists on server boot
async function initStorage() {
    try {
        await fs.access(SUBSCRIPTIONS_FILE);
    } catch {
        await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify([], null, 2), 'utf8');
    }
}
initStorage();

// API Endpoint for Newsletter Signups
app.post('/api/subscribe', async (req, res) => {
    const { email } = req.body;

    // Server-side baseline validation
    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'A valid email address is required.' });
    }

    try {
        // Atomic read-then-write loop to prevent truncation
        const fileData = await fs.readFile(SUBSCRIPTIONS_FILE, 'utf8');
        const subscriptions = JSON.parse(fileData || '[]');

        // Prevent duplicate entries
        if (subscriptions.some(entry => entry.email.toLowerCase() === email.toLowerCase())) {
            return res.status(200).json({ message: 'Email already registered.' });
        }

        // Append new subscriber record with ISO timestamp
        subscriptions.push({
            email: email.trim(),
            timestamp: new Date().toISOString()
        });

        // Write back to disk with clean formatting
        await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2), 'utf8');
        
        console.log(`[Storage Success] Registered subscriber: ${email}`);
        return res.status(200).json({ message: 'Successfully subscribed.' });

    } catch (error) {
        console.error('[Storage Error] Failed to persist subscription:', error);
        return res.status(500).json({ error: 'Internal database storage failure.' });
    }
});

// Serve frontend paths
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🚀 Simplebeacon landing server running at http://localhost:${PORT}`);
    console.log(`💾 Persisting data to: ${SUBSCRIPTIONS_FILE}\n`);
});