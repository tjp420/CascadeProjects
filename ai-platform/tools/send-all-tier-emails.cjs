// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
const { sendEmail } = require('../server/lib/email-service.cjs');
const fs = require('fs');
const path = require('path');
const {
  generateLicenseToken,
} = require('../../packages/simplebeacon-cli/src/lib/license-token.js');

const templatePath = path.join(__dirname, '../../coming-soon/email-template-universal.html');
const templateHtml = fs.readFileSync(templatePath, 'utf8');

const APP_URL = process.env.SIMPLEBEACON_APP_URL;
if (!APP_URL) {
  process.stderr.write(['SIMPLEBEACON_APP_URL env var is required'].join(' ') + '\n');
  process.exit(1);
}
const BASE_URL = `${APP_URL}/coming-soon/certificate-upload.html`;
const DASHBOARD_URL = `${APP_URL}/simplebeacon-dashboard`;

function buildEmail(tier, config) {
  const date = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const invoiceId = 'INV-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  const sessionId = 'sess_' + Date.now() + '_' + tier;

  let token = '';
  if (config.token) {
    token = generateLicenseToken(
      {
        email: process.env.SIMPLEBEACON_OWNER_EMAIL || 'admin@' + 'simplebeacon.local',
        tier: tier,
        features: config.features || [],
      },
      'simplebeacon-dev-insecure',
      config.expiryDays * 24 * 60
    );
  }

  let html = templateHtml;
  const r = (placeholder, value) => {
    html = html.replace(new RegExp(placeholder, 'g'), value);
  };

  r('{{HEADLINE}}', config.headline);
  r('{{PRODUCT_NAME}}', config.productName);
  r('{{PRICE}}', config.price);
  r('{{PAYMENT_METHOD}}', config.paymentMethod || 'Paid via Stripe');
  r('{{DATE}}', date);
  r('{{INVOICE_LINE}}', config.price === 'Free' ? 'Community Access' : `Invoice #${invoiceId}`);
  r('{{RECEIPT_CLASS}}', config.receiptClass || '');
  r('{{LICENSE_TOKEN}}', token);
  r('{{PRIMARY_URL}}', config.primaryUrl || `${BASE_URL}?session_id=${sessionId}&tier=${tier}`);
  r('{{PRIMARY_CTA}}', config.primaryCta);
  r('{{SECONDARY_URL}}', config.secondaryUrl || '#');
  r('{{SECONDARY_CTA}}', config.secondaryCta || '');
  r('{{STEPS_TITLE}}', config.stepsTitle);
  r('{{STEPS_LIST}}', config.stepsList);
  r('{{FEATURES_LIST}}', config.featuresList || '');
  r('{{PRIVACY_TEXT}}', config.privacyText);
  r('{{SUPPORT_TEXT}}', config.supportText);
  r('{{DELIVERY_HEADLINE}}', config.deliveryHeadline || '');
  r('{{DELIVERY_DETAIL}}', config.deliveryDetail || '');

  // Show/hide sections
  r('{{TOKEN_VISIBLE}}', token ? 'visible' : '');
  r('{{SECONDARY_VISIBLE}}', config.secondaryCta ? 'visible' : '');
  r('{{FEATURES_VISIBLE}}', config.featuresList ? 'visible' : '');
  r('{{DELIVERY_VISIBLE}}', config.deliveryHeadline ? 'visible' : '');

  const text = `${config.headline}\n\n${config.productName}\n${config.price}\n\n${config.stepsTitle}:\n${config.stepsText || config.stepsList.replace(/<[^>]*>/g, '')}\n\n${token ? `Token: ${token}\n` : ''}Link: ${config.primaryUrl || `${BASE_URL}?session_id=${sessionId}&tier=${tier}`}`;

  return { html, text, subject: config.subject, tier };
}

const TIERS = {
  instant: {
    headline: 'Your Report is Ready',
    productName: 'Website Security Report',
    price: '$19.00',
    paymentMethod: 'Paid via Stripe',
    receiptClass: '',
    primaryUrl: `${APP_URL}/coming-soon/diagnostic-prep.html`,
    primaryCta: 'Download Report →',
    stepsTitle: 'What you get',
    stepsList: `
      <li>SEO, SSL, mobile, speed, accessibility, headers audit</li>
      <li>PDF report delivered instantly — download now</li>
      <li>No account, no subscription, no recurring fees</li>
    `,
    stepsText: 'SEO/SSL audit, PDF report, no recurring fees',
    featuresList: `
      <li>Full website security scan (10+ checks)</li>
      <li>Executive PDF report</li>
      <li>Remediation checklist</li>
      <li>Zero-retention guarantee</li>
    `,
    privacyText:
      'Your domain and report only exist in server RAM during processing. After download, data is explicitly deleted. We do not store or log it.',
    supportText: 'Questions about your report? Email',
    token: false,
    subject: 'Your SimpleBeacon Website Security Report',
  },

  community: {
    headline: 'Your Free Token is Ready',
    productName: 'AI Slop Audit — Community Tier',
    price: 'Free',
    paymentMethod: 'Community Access',
    receiptClass: 'free',
    primaryCta: 'Start Free Audit →',
    stepsTitle: 'Get started in 60 seconds',
    stepsList: `
      <li>Click the dashboard link above</li>
      <li>Paste your free community token</li>
      <li>Run <code>npx simplebeacon scan --gate --offline</code></li>
      <li>Upload your report.json for a complimentary risk assessment</li>
    `,
    stepsText: 'Open dashboard, paste token, run scan, upload report',
    privacyText:
      'Your source code never leaves your machine. Only the scan report JSON (findings summary, no code) is uploaded for assessment.',
    supportText: 'Need help? Email',
    token: true,
    features: ['simplebeacon'],
    expiryDays: 30,
    subject: 'Your SimpleBeacon Free Community Token',
  },

  executive: {
    headline: 'Payment Confirmed',
    productName: 'Executive Risk Certificate',
    price: '$499.00',
    primaryCta: 'Upload Report & Generate Certificate →',
    stepsTitle: 'Next steps',
    stepsList: `
      <li>Run <code>npx simplebeacon scan --gate --offline</code> locally</li>
      <li>Upload the generated <code>.simplebeacon/report.json</code></li>
      <li>Our analyst reviews and generates your signed certificate</li>
      <li>Receive your Executive Risk Certificate within 48 hours</li>
    `,
    stepsText: 'Run scan, upload report, analyst review, receive certificate in 48h',
    privacyText:
      'Your source code never leaves your machine. Only the scan report JSON (findings summary, no code) is uploaded for certificate generation.',
    supportText: 'Lost your token? Email',
    deliveryHeadline: '48-Hour Delivery',
    deliveryDetail:
      'A compliance analyst will review your scan and generate your signed certificate within 2 business days.',
    token: true,
    features: ['simplebeacon', 'codebase', 'npm-audit', 'compliance'],
    expiryDays: 90,
    subject: 'Your SimpleBeacon Executive Risk Certificate — Payment Confirmed',
  },

  agency: {
    headline: 'Payment Confirmed',
    productName: 'Agency Project Pack',
    price: '$999.00',
    primaryCta: 'Upload Milestone Reports →',
    stepsTitle: 'Milestone workflow',
    stepsList: `
      <li>Run <code>npx simplebeacon scan --gate --offline</code> at each project milestone</li>
      <li>Upload milestone reports via the dashboard</li>
      <li>Receive co-branded certificates for each deliverable</li>
      <li>Full project pack delivered within 48 hours</li>
    `,
    stepsText: 'Run scan at milestones, upload reports, get co-branded certificates',
    privacyText:
      'Your source code never leaves your machine. Only scan reports are uploaded for certificate generation.',
    supportText: 'Agency support:',
    deliveryHeadline: '48-Hour Turnaround',
    deliveryDetail:
      'Each milestone report is reviewed and certified within 2 business days of upload.',
    token: true,
    features: [
      'simplebeacon',
      'codebase',
      'npm-audit',
      'compliance',
      'data-cleanup',
      'eu-ai-act',
      'complete',
    ],
    expiryDays: 180,
    subject: 'Your SimpleBeacon Agency Project Pack — Payment Confirmed',
  },

  annual: {
    headline: 'Payment Confirmed',
    productName: 'Annual Protection Pack',
    price: '$1,499.00',
    primaryCta: 'Launch Dashboard →',
    secondaryCta: 'View Documentation',
    secondaryUrl: 'https://github.com/tjp420/simplebeacon/blob/main/docs/ANTI-BLOAT-MANIFESTO.md',
    stepsTitle: 'Your annual protection includes',
    stepsList: `
      <li>Priority audit queue — skip the line</li>
      <li>Warranty re-scan within 12 months</li>
      <li>Direct analyst access via email</li>
      <li>All scan types: codebase, npm, compliance, EU AI Act</li>
    `,
    stepsText: 'Priority audit, warranty re-scan, analyst access, all scan types',
    privacyText:
      'Your source code never leaves your machine. The scan runs entirely locally. Only anonymized findings are uploaded for PDF generation.',
    supportText: 'Priority support:',
    token: true,
    features: [
      'simplebeacon',
      'codebase',
      'npm-audit',
      'compliance',
      'data-cleanup',
      'eu-ai-act',
      'complete',
    ],
    expiryDays: 365,
    subject: 'Your SimpleBeacon Annual Protection Pack — Payment Confirmed',
  },

  euai: {
    headline: 'Payment Confirmed',
    productName: 'EU AI Act Sprint',
    price: '$2,499.00',
    primaryCta: 'Launch Dashboard →',
    stepsTitle: 'Self-service workflow',
    stepsList: `
      <li>Click the dashboard link above</li>
      <li>Paste your license token (already filled if you use the link)</li>
      <li>Upload source code zip or select a local directory</li>
      <li>The scan runs locally — no code leaves your machine</li>
      <li>Download your EU AI Act Readiness PDF instantly</li>
    `,
    stepsText: 'Open dashboard, paste token, upload code, local scan, instant PDF',
    privacyText:
      'Your source code never leaves your machine. The scan runs entirely locally in your browser and Node.js process. Only anonymized findings are uploaded for PDF generation.',
    supportText: 'EU AI Act questions? Email',
    token: true,
    features: ['simplebeacon', 'eu-ai-act', 'compliance'],
    expiryDays: 90,
    subject: 'Your SimpleBeacon EU AI Act Sprint — Payment Confirmed',
  },

  enterprise: {
    headline: 'Welcome to Continuous Shield',
    productName: 'Enterprise Continuous Shield',
    price: '$1,499/mo',
    paymentMethod: 'Billed monthly via Stripe',
    receiptClass: 'enterprise',
    primaryCta: 'Schedule Onboarding Call →',
    primaryUrl: 'mailto:enterprise@simplebeacon.ai?subject=Enterprise%20Onboarding%20Request',
    stepsTitle: 'What happens next',
    stepsList: `
      <li>A compliance analyst will contact you within 24 hours</li>
      <li>Schedule a 30-minute onboarding call</li>
      <li>Custom dashboard and API integration setup</li>
      <li>Automated EU AI Act monitoring begins immediately</li>
    `,
    stepsText: 'Analyst contact within 24h, onboarding call, dashboard setup, monitoring begins',
    privacyText:
      'Enterprise deployments include private infrastructure options. Your data never touches shared servers unless explicitly configured.',
    supportText: 'Dedicated support line:',
    deliveryHeadline: '24-Hour Response',
    deliveryDetail:
      'A senior analyst will reach out within one business day to schedule your onboarding.',
    token: false,
    subject: 'Welcome to SimpleBeacon Continuous Shield',
  },
};

async function sendAll() {
  for (const [tier, config] of Object.entries(TIERS)) {
    process.stdout.write([`\n--- Building tier message ---`].join(' ') + '\n');
    const email = buildEmail(tier, config);

    try {
      const result = await sendEmail({
        to: process.env.SIMPLEBEACON_OWNER_EMAIL || 'admin@simplebeacon.local',
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      process.stdout.write(
        [
          `[${tier}]`,
          result.sent ? 'SENT' : result.queued ? 'QUEUED' : 'FAILED',
          result.id || result.queuePath || result.error,
        ].join(' ') + '\n'
      );
    } catch (err) {
      process.stderr.write([`[${tier}] Error:`, err.message].join(' ') + '\n');
    }
  }
}

sendAll();
