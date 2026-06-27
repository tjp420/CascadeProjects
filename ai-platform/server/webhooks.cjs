const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { signLicense } = require('../../../sales/license/generator.js');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Load the secure offline-generated private key for live token signing
const PRIVATE_KEY = fs.readFileSync(
    path.join(__dirname, '../../../sales/license/simplebeacon-private-live.pem'),
    'utf8'
);

router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the successful checkout session conversion event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const customerEmail = session.customer_details.email;

        // Extract meta fields defined during product stripe configuration checkout
        const companyId = session.metadata.companyId || customerEmail;
        const tier = session.metadata.tier || 'team';

        // Calculate expiration milestone (1 year rolling license token validity)
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        const expiresStr = expiresAt.toISOString().split('T')[0];

        // Generate the asymmetric cryptographic license token completely offline
        const licenseToken = signLicense(companyId, tier, expiresStr, PRIVATE_KEY);

        // Dispatch fulfillment email via Resend API
        await fetch('https://resend.com', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'licensing@simplebeacon.ai',
                to: customerEmail,
                subject: 'Your SimpleBeacon Enterprise License Key Token',
                html: `<p>Thank you for securing your AI pipeline.</p><p>Your production token is:</p><code>${licenseToken}</code>`
            })
        });
    }

    res.json({ received: true });
});

module.exports = router;
