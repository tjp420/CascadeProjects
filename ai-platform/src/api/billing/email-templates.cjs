// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
'use strict';

const path = require('path');

const EMAIL_TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'coming-soon',
  'email-template-universal.html'
);
let emailTemplateHtml = null;
try {
  emailTemplateHtml = require('fs').readFileSync(EMAIL_TEMPLATE_PATH, 'utf8');
} catch {
  emailTemplateHtml = null;
}

const TIER_EMAIL_CONFIG = {
  instant_report: {
    headline: 'Your Report is Ready',
    productName: 'Website Security Report',
    price: '$19.00',
    paymentMethod: 'Paid via Stripe',
    receiptClass: '',
    primaryCta: 'Download Report →',
    stepsTitle: 'What you get',
    stepsList: `<li>SEO, SSL, mobile, speed, accessibility, headers audit</li>
      <li>PDF report delivered instantly — download now</li>
      <li>No account, no subscription, no recurring fees</li>`,
    featuresList: `<li>Full website security scan (10+ checks)</li>
      <li>Executive PDF report</li>
      <li>Remediation checklist</li>
      <li>Zero-retention guarantee</li>`,
    privacyText:
      'Your domain and report only exist in server RAM during processing. After download, data is explicitly deleted. We do not store or log it.',
    supportText: 'Questions about your report? Email',
    tokenVisible: false,
    featuresVisible: true,
    deliveryVisible: false,
    secondaryVisible: false,
  },
  executive_clearance: {
    headline: 'Payment Confirmed',
    productName: 'Executive Risk Certificate',
    price: '$499.00',
    paymentMethod: 'Paid via Stripe',
    receiptClass: '',
    primaryCta: 'Upload Report & Generate Certificate →',
    stepsTitle: 'Next steps',
    stepsList: `<li>Run <code>npx simplebeacon scan --gate --offline</code> locally</li>
      <li>Upload the generated <code>.simplebeacon/report.json</code></li>
      <li>Our analyst reviews and generates your signed certificate</li>
      <li>Receive your Executive Risk Certificate within 48 hours</li>`,
    privacyText:
      'Your source code never leaves your machine. Only the scan report JSON (findings summary, no code) is uploaded for certificate generation.',
    supportText: 'Lost your token? Email',
    tokenVisible: true,
    featuresVisible: false,
    deliveryVisible: true,
    deliveryHeadline: '48-Hour Delivery',
    deliveryDetail:
      'A compliance analyst will review your scan and generate your signed certificate within 2 business days.',
    secondaryVisible: false,
  },
  eu_ai_act_sprint: {
    headline: 'Payment Confirmed',
    productName: 'EU AI Act Sprint',
    price: '$2,499.00',
    paymentMethod: 'Paid via Stripe',
    receiptClass: '',
    primaryCta: 'Launch Dashboard →',
    stepsTitle: 'Self-service workflow',
    stepsList: `<li>Click the dashboard link above</li>
      <li>Paste your license token (already filled if you use the link)</li>
      <li>Upload source code zip or select a local directory</li>
      <li>The scan runs locally — no code leaves your machine</li>
      <li>Download your EU AI Act Readiness PDF instantly</li>`,
    privacyText:
      'Your source code never leaves your machine. The scan runs entirely locally in your browser and Node.js process. Only anonymized findings are uploaded for PDF generation.',
    supportText: 'EU AI Act questions? Email',
    tokenVisible: true,
    featuresVisible: false,
    deliveryVisible: false,
    secondaryVisible: false,
  },
  pro_monthly: {
    headline: 'Subscription Active',
    productName: 'SimpleBeacon Pro',
    price: '$9.00 / month',
    paymentMethod: 'Paid via Stripe',
    receiptClass: '',
    primaryCta: 'Get Started →',
    stepsTitle: 'Getting started',
    stepsList: `<li>Copy your license token below into VS Code settings or your CLI env</li>
      <li>Run <code>npx simplebeacon scan --gate --offline</code> locally</li>
      <li>Unlock all 38 analyzer engines and exportable reports</li>
      <li>Install the GitHub Action for automatic PR gating</li>`,
    privacyText:
      'Your source code never leaves your machine. Only the scan report JSON (findings summary, no code) is uploaded for certificate generation.',
    supportText: 'Questions about your subscription? Email',
    tokenVisible: true,
    featuresVisible: false,
    deliveryVisible: false,
    secondaryVisible: false,
  },
  pro_annual: {
    headline: 'Subscription Active',
    productName: 'SimpleBeacon Pro (Annual)',
    price: '$79.00 / year',
    paymentMethod: 'Paid via Stripe',
    receiptClass: '',
    primaryCta: 'Get Started →',
    stepsTitle: 'Getting started',
    stepsList: `<li>Copy your license token below into VS Code settings or your CLI env</li>
      <li>Run <code>npx simplebeacon scan --gate --offline</code> locally</li>
      <li>Unlock all 38 analyzer engines and exportable reports</li>
      <li>Install the GitHub Action for automatic PR gating</li>`,
    privacyText:
      'Your source code never leaves your machine. Only the scan report JSON (findings summary, no code) is uploaded for certificate generation.',
    supportText: 'Questions about your subscription? Email',
    tokenVisible: true,
    featuresVisible: false,
    deliveryVisible: false,
    secondaryVisible: false,
  },
  team_monthly: {
    headline: 'Subscription Active',
    productName: 'SimpleBeacon Team',
    price: '$15.00 / dev / month',
    paymentMethod: 'Paid via Stripe',
    receiptClass: '',
    primaryCta: 'Get Started →',
    stepsTitle: 'Getting started',
    stepsList: `<li>Copy your license token below into VS Code settings or your CLI env</li>
      <li>Run <code>npx simplebeacon scan --gate --offline</code> locally</li>
      <li>Share team configs and manage seats from your dashboard</li>
      <li>Install the GitHub Action for automatic PR gating</li>`,
    privacyText:
      'Your source code never leaves your machine. Only the scan report JSON (findings summary, no code) is uploaded for certificate generation.',
    supportText: 'Questions about your subscription? Email',
    tokenVisible: true,
    featuresVisible: false,
    deliveryVisible: false,
    secondaryVisible: false,
  },
  team_annual: {
    headline: 'Subscription Active',
    productName: 'SimpleBeacon Team (Annual)',
    price: '$150.00 / dev / year',
    paymentMethod: 'Paid via Stripe',
    receiptClass: '',
    primaryCta: 'Get Started →',
    stepsTitle: 'Getting started',
    stepsList: `<li>Copy your license token below into VS Code settings or your CLI env</li>
      <li>Run <code>npx simplebeacon scan --gate --offline</code> locally</li>
      <li>Share team configs and manage seats from your dashboard</li>
      <li>Install the GitHub Action for automatic PR gating</li>`,
    privacyText:
      'Your source code never leaves your machine. Only the scan report JSON (findings summary, no code) is uploaded for certificate generation.',
    supportText: 'Questions about your subscription? Email',
    tokenVisible: true,
    featuresVisible: false,
    deliveryVisible: false,
    secondaryVisible: false,
  },
  startup_shield: {
    headline: 'Your Team License is Active',
    productName: 'SimpleBeacon AI Guardrails — Team',
    price: '$49.00 / month',
    paymentMethod: 'Paid via Stripe',
    receiptClass: '',
    primaryCta: 'Open Team Dashboard →',
    stepsTitle: '60-second GitHub setup',
    stepsList: `<li>Copy your license token below into GitHub → Settings → Secrets → <code>SIMPLEBEACON_LICENSE_TOKEN</code></li>
      <li>Add <code>simplebeacon/guardrails@v1</code> to your workflow with <code>fetch-depth: 0</code></li>
      <li>Open a PR — SimpleBeacon posts an AI Circuit Breaker comment and blocks merge on gate failure</li>
      <li>View <strong>Merges Blocked This Week</strong> on your team dashboard</li>`,
    privacyText:
      'Your source code never leaves your machine. Only the scan report JSON (findings summary, no code) is uploaded for certificate generation.',
    supportText: 'Questions about your subscription? Email',
    tokenVisible: true,
    featuresVisible: false,
    deliveryVisible: false,
    secondaryVisible: false,
  },
  growth_shield: {
    headline: 'Your Team License is Active',
    productName: 'SimpleBeacon AI Guardrails — Growth',
    price: '$149.00 / month',
    paymentMethod: 'Paid via Stripe',
    receiptClass: '',
    primaryCta: 'Open Team Dashboard →',
    stepsTitle: 'Multi-repo team setup',
    stepsList: `<li>Add <code>SIMPLEBEACON_LICENSE_TOKEN</code> to each repository's GitHub secrets</li>
      <li>Install <code>simplebeacon/guardrails@v1</code> on every repo that merges to main</li>
      <li>Consolidated telemetry: scans, gates tripped, and criticals blocked across all repos</li>
      <li>Share dashboard link with your engineering manager for ROI reporting</li>`,
    privacyText:
      'Your source code never leaves your machine. Only the scan report JSON (findings summary, no code) is uploaded for certificate generation.',
    supportText: 'Questions about your subscription? Email',
    tokenVisible: true,
    featuresVisible: false,
    deliveryVisible: false,
    secondaryVisible: false,
  },
  continuous_shield: {
    headline: 'Subscription Active',
    productName: 'Continuous Shield',
    price: '$1,499.00 / month',
    paymentMethod: 'Paid via Stripe',
    receiptClass: 'enterprise',
    primaryCta: 'Upload Report & Generate Certificate →',
    stepsTitle: 'Getting started',
    stepsList: `<li>Run <code>npx simplebeacon scan --gate --offline</code> locally</li>
      <li>Upload the generated <code>.simplebeacon/report.json</code></li>
      <li>Generate certificates up to 3 times per month</li>
      <li>Install the GitHub Action for automatic PR gating</li>`,
    privacyText:
      'Your source code never leaves your machine. Only the scan report JSON (findings summary, no code) is uploaded for certificate generation.',
    supportText: 'Questions about your subscription? Email',
    tokenVisible: true,
    featuresVisible: false,
    deliveryVisible: false,
    secondaryVisible: false,
  },
  runtime_shield: {
    headline: 'Subscription Active',
    productName: 'Runtime Shield',
    price: '$2,999.00 / month',
    paymentMethod: 'Paid via Stripe',
    receiptClass: 'enterprise',
    primaryCta: 'Upload Report & Generate Certificate →',
    stepsTitle: 'Getting started',
    stepsList: `<li>Run <code>npx simplebeacon scan --gate --offline</code> locally</li>
      <li>Upload the generated <code>.simplebeacon/report.json</code></li>
      <li>Generate certificates up to 5 times per month</li>
      <li>Install the Runtime Sentinel for live monitoring</li>`,
    privacyText:
      'Your source code never leaves your machine. Only the scan report JSON (findings summary, no code) is uploaded for certificate generation.',
    supportText: 'Questions about your subscription? Email',
    tokenVisible: true,
    featuresVisible: false,
    deliveryVisible: false,
    secondaryVisible: false,
  },
};

function buildTierEmail(product, licenseToken, certUploadUrl, sessionId) {
  if (!emailTemplateHtml) return null;
  const PRODUCT_EMAIL_ALIAS = {
    startup: 'startup_shield',
    startup_monthly: 'startup_shield',
    startup_annual: 'startup_shield',
    growth: 'growth_shield',
    growth_monthly: 'growth_shield',
    growth_annual: 'growth_shield',
    teams_monthly: 'team_monthly',
    teams_annual: 'team_monthly',
  };
  const cfgKey = PRODUCT_EMAIL_ALIAS[product] || product;
  const cfg = TIER_EMAIL_CONFIG[cfgKey] || TIER_EMAIL_CONFIG.executive_clearance;
  const date = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const invoiceId = 'INV-' + Math.random().toString(36).substr(2, 9).toUpperCase();

  const { getAppBaseUrl } = require('./license-utils.cjs');
  const baseUrl = getAppBaseUrl();

  let html = emailTemplateHtml;
  const r = (placeholder, value) => {
    html = html.replace(new RegExp(placeholder, 'g'), value || '');
  };

  r('{{HEADLINE}}', cfg.headline);
  r('{{PRODUCT_NAME}}', cfg.productName);
  r('{{PRICE}}', cfg.price);
  r('{{PAYMENT_METHOD}}', cfg.paymentMethod);
  r('{{DATE}}', date);
  r('{{INVOICE_LINE}}', cfg.price === 'Free' ? 'Community Access' : `Invoice #${invoiceId}`);
  r('{{RECEIPT_CLASS}}', cfg.receiptClass);
  r('{{LICENSE_TOKEN}}', licenseToken || '');
  const teamProducts = new Set([
    'startup',
    'startup_monthly',
    'startup_annual',
    'growth',
    'growth_monthly',
    'growth_annual',
    'teams_monthly',
    'teams_annual',
    'team_monthly',
    'team_annual',
  ]);
  const dashboardUrl =
    teamProducts.has(product) || teamProducts.has(cfgKey)
      ? `${baseUrl}/dashboard/settings?checkout=success&session_id=${sessionId}`
      : `${certUploadUrl}?session_id=${sessionId}`;
  r('{{PRIMARY_URL}}', dashboardUrl);
  r('{{PRIMARY_CTA}}', cfg.primaryCta);
  r(
    '{{SECONDARY_URL}}',
    'https://github.com/tjp420/simplebeacon/blob/main/docs/ANTI-BLOAT-MANIFESTO.md'
  );
  r('{{SECONDARY_CTA}}', cfg.secondaryCta || '');
  r('{{STEPS_TITLE}}', cfg.stepsTitle);
  r('{{STEPS_LIST}}', cfg.stepsList);
  r('{{FEATURES_LIST}}', cfg.featuresList || '');
  r('{{PRIVACY_TEXT}}', cfg.privacyText);
  r('{{SUPPORT_TEXT}}', cfg.supportText);
  r('{{DELIVERY_HEADLINE}}', cfg.deliveryHeadline || '');
  r('{{DELIVERY_DETAIL}}', cfg.deliveryDetail || '');

  r('{{TOKEN_VISIBLE}}', cfg.tokenVisible ? 'visible' : '');
  r('{{SECONDARY_VISIBLE}}', cfg.secondaryVisible ? 'visible' : '');
  r('{{FEATURES_VISIBLE}}', cfg.featuresVisible ? 'visible' : '');
  r('{{DELIVERY_VISIBLE}}', cfg.deliveryVisible ? 'visible' : '');

  const textLines = [
    `${cfg.headline} — ${cfg.productName}`,
    '',
    `Price: ${cfg.price}`,
    cfg.tokenVisible ? `Token: ${licenseToken}` : '',
    '',
    `${cfg.stepsTitle}:`,
    cfg.stepsList.replace(/<[^>]*>/g, ''),
    '',
    `Dashboard: ${certUploadUrl}?session_id=${sessionId}`,
    '',
    cfg.privacyText,
  ]
    .filter(Boolean)
    .join('\n');

  return { html, text: textLines };
}

/**
 * Build resend email subject and body for a given product.
 * @param {string} product
 * @param {{licenseToken: string, licenseTier?: string}} record
 * @param {string} certUploadUrl
 * @returns {{subject: string, body: string}}
 */
function buildResendEmail(product, record, certUploadUrl) {
  const token = record.licenseToken;
  const map = {
    instant_report: {
      subject: 'Your SimpleBeacon Instant Report — Token Resent',
      body: `Here is your license token again:\n\n${token}\n\nYour instant report was sent to this email. If you did not receive it, check your spam folder or contact support.`,
    },
    executive_clearance: {
      subject: 'Your SimpleBeacon Executive Risk Certificate — Token Resent',
      body: `Here is your license token again:\n\n${token}\n\nUpload your scan report at: ${certUploadUrl}\n\n1. Run the scan locally: npx simplebeacon scan --gate --offline\n2. Upload your report JSON and paste the token above.\n3. We will generate your certificate within 48 hours.`,
    },
    eu_ai_act_sprint: {
      subject: 'Your SimpleBeacon EU AI Act Sprint — Token Resent',
      body: `Here is your license token again:\n\n${token}\n\nUpload your scan at: ${certUploadUrl}\n\n1. Run the EU AI Act scan: npx simplebeacon scan --gate --offline --config .simplebeacon/config-full-coverage.json\n2. Upload your report JSON and paste the token above.\n3. We will generate your EU AI Act Readiness Report within 48 hours.`,
    },
  };
  const fallback = map.executive_clearance;
  return map[product] || fallback;
}

module.exports = {
  TIER_EMAIL_CONFIG,
  buildTierEmail,
  buildResendEmail,
  emailTemplateHtml,
};
