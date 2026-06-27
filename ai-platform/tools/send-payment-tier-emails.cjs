const { sendEmail } = require('../server/lib/email-service.cjs');
const fs = require('fs');
const path = require('path');
const { generateLicenseToken } = require('../server/lib/simplebeacon-proxy.cjs');


const templatePath = path.join(__dirname, '../../coming-soon/email-template-universal.html');
const templateHtml = fs.readFileSync(templatePath, 'utf8');

const APP_URL = process.env.SIMPLEBEACON_APP_URL;
if (!APP_URL) {
  console.error('SIMPLEBEACON_APP_URL env var is required');
  process.exit(1);
}
const BASE_URL = `${APP_URL}/coming-soon/certificate-upload.html`;

function buildEmail(tier, config) {
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const invoiceId = 'INV-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  const sessionId = 'sess_' + Date.now() + '_' + tier;

  const token = generateLicenseToken({
    email: process.env.SIMPLEBEACON_OWNER_EMAIL || 'admin@'+'simplebeacon.local',
    tier: tier,
    features: config.features
  }, 'simplebeacon-dev-insecure', config.expiryDays * 24 * 60);

  let html = templateHtml;
  const r = (placeholder, value) => {
    html = html.replace(new RegExp(placeholder, 'g'), value || '');
  };

  r('{{HEADLINE}}', config.headline);
  r('{{PRODUCT_NAME}}', config.productName);
  r('{{PRICE}}', config.price);
  r('{{PAYMENT_METHOD}}', 'Paid via Stripe');
  r('{{DATE}}', date);
  r('{{INVOICE_LINE}}', `Invoice #${invoiceId}`);
  r('{{RECEIPT_CLASS}}', '');
  r('{{LICENSE_TOKEN}}', token);
  r('{{PRIMARY_URL}}', `${BASE_URL}?session_id=${sessionId}&tier=${tier}`);
  r('{{PRIMARY_CTA}}', config.primaryCta);
  r('{{SECONDARY_URL}}', 'https://github.com/tjp420/simplebeacon/blob/main/docs/ANTI-BLOAT-MANIFESTO.md');
  r('{{SECONDARY_CTA}}', config.secondaryCta || '');
  r('{{STEPS_TITLE}}', config.stepsTitle);
  r('{{STEPS_LIST}}', config.stepsList);
  r('{{FEATURES_LIST}}', config.featuresList || '');
  r('{{PRIVACY_TEXT}}', config.privacyText);
  r('{{SUPPORT_TEXT}}', config.supportText);
  r('{{DELIVERY_HEADLINE}}', config.deliveryHeadline || '');
  r('{{DELIVERY_DETAIL}}', config.deliveryDetail || '');

  r('{{TOKEN_VISIBLE}}', 'visible');
  r('{{SECONDARY_VISIBLE}}', config.secondaryCta ? 'visible' : '');
  r('{{FEATURES_VISIBLE}}', config.featuresList ? 'visible' : '');
  r('{{DELIVERY_VISIBLE}}', config.deliveryHeadline ? 'visible' : '');

  const text = `${config.headline}\n\n${config.productName}\n${config.price}\n\nToken: ${token}\n\n${config.stepsTitle}:\n${config.stepsList.replace(/<[^>]*>/g, '')}\n\nDashboard: ${BASE_URL}?session_id=${sessionId}&tier=${tier}`;

  return { html, text, subject: config.headline + ' — ' + config.productName, tier };
}

const TIERS = {
  instant: {
    headline: 'Your Report is Ready',
    productName: 'Instant Website Report',
    price: '$19.00',
    primaryCta: 'Download Report →',
    stepsTitle: 'What you get',
    stepsList: `<li>SEO, SSL, mobile, speed, accessibility, headers audit</li>
      <li>PDF report delivered instantly — download now</li>
      <li>No account, no subscription, no recurring fees</li>`,
    featuresList: `<li>Full website security scan (10+ checks)</li>
      <li>Executive PDF report</li>
      <li>Remediation checklist</li>
      <li>Zero-retention guarantee</li>`,
    privacyText: 'Your domain and report only exist in server RAM during processing. After download, data is explicitly deleted. We do not store or log it.',
    supportText: 'Questions about your report? Email',
    tokenVisible: false,
    featuresVisible: true,
    deliveryVisible: false,
    features: ['instant-report'],
    expiryDays: 7
  },

  executive: {
    headline: 'Payment Confirmed',
    productName: 'Executive Risk Certificate',
    price: '$499.00',
    primaryCta: 'Upload Report & Generate Certificate →',
    stepsTitle: 'Next steps',
    stepsList: `<li>Run <code>npx simplebeacon scan --gate --offline</code> locally</li>
      <li>Upload the generated <code>.simplebeacon/report.json</code></li>
      <li>Our analyst reviews and generates your signed certificate</li>
      <li>Receive your Executive Risk Certificate within 48 hours</li>`,
    featuresList: `<li>A–F compliance grade with estimated financial liability</li>
      <li>Four-pillar breakdown: Slop, Leaks, Shadow AI, Licensing</li>
      <li>Operator-reviewed gate verdict + developer remediation steps</li>
      <li>One-page cryptographically signed PDF</li>`,
    privacyText: 'Your source code never leaves your machine. Only the scan report JSON (findings summary, no code) is uploaded for certificate generation.',
    supportText: 'Lost your token? Email',
    deliveryHeadline: '48-Hour Turnaround',
    deliveryDetail: 'A compliance analyst will review your scan and generate your signed certificate within 2 business days.',
    secondaryCta: 'View Sample Report',
    tokenVisible: true,
    featuresVisible: true,
    deliveryVisible: true,
    features: ['pdf-generation', 'certificate'],
    expiryDays: 90
  },

  euai: {
    headline: 'Payment Confirmed',
    productName: 'EU AI Act Readiness Sprint',
    price: '$2,499.00',
    primaryCta: 'Launch Dashboard →',
    stepsTitle: 'Self-service workflow',
    stepsList: `<li>Click the dashboard link above</li>
      <li>Paste your license token (already filled if you use the link)</li>
      <li>Upload source code zip or select a local directory</li>
      <li>The scan runs locally — no code leaves your machine</li>
      <li>Download your EU AI Act Readiness PDF instantly</li>`,
    featuresList: `<li>Annex III high-risk AI pattern scan</li>
      <li>Article 50 transparency gap detection</li>
      <li>Documentation completeness checks</li>
      <li>Human oversight & AI logging accountability</li>
      <li>30-day remediation sprint support</li>`,
    privacyText: 'Your source code never leaves your machine. The scan runs entirely locally in your browser and Node.js process. Only anonymized findings are uploaded for PDF generation.',
    supportText: 'EU AI Act questions? Email',
    tokenVisible: true,
    featuresVisible: true,
    deliveryVisible: false,
    features: ['eu-ai-act', 'pdf-generation', 'certificate'],
    expiryDays: 90
  }
};

async function sendAll() {
  for (const [tier, config] of Object.entries(TIERS)) {
    console.log(`\n--- Building tier message ---`);
    const email = buildEmail(tier, config);

    try {
      const result = await sendEmail({
        to: process.env.SIMPLEBEACON_OWNER_EMAIL || 'admin@simplebeacon.local',
        subject: email.subject,
        html: email.html,
        text: email.text
      });
      console.log(`[${tier}]`, result.sent ? 'SENT' : (result.queued ? 'QUEUED' : 'FAILED'), result.id || result.queuePath || result.error);
    } catch (err) {
      console.error(`[${tier}] Error:`, err.message);
    }
  }
}

sendAll();
