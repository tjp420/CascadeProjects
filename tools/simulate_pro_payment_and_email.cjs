#!/usr/bin/env node
// Simulate a Pro-tier payment and email the user.
// Usage:
// 1) Dry-run (safe): node tools/simulate_pro_payment_and_email.cjs --email=granny.cee48@hushmail.com --name="Granny Cee"
// 2) Send for real (requires email provider env vars): SEND_EMAIL=true node tools/simulate_pro_payment_and_email.cjs --email=granny.cee48@hushmail.com --name="Granny Cee"

const path = require("path");
const crypto = require("crypto");
const argv = require("minimist")(process.argv.slice(2));
const sendEmail = require(
  path.join(
    __dirname,
    "..",
    "ai-platform",
    "server",
    "lib",
    "email-service.cjs",
  ),
).sendEmail;

// Use the premium license confirmation template
let renderLicenseConfirmation = null;
try {
  renderLicenseConfirmation = require(
    path.join(__dirname, "..", "coming-soon", "services", "email-templates", "license-confirmation-email.cjs"),
  ).renderLicenseConfirmation;
} catch {
  // Template not available — fall back to basic template
}

async function main() {
  const email = argv.email || argv.to;
  const name = argv.name || "Customer";
  const tier = argv.tier || "Pro";
  if (!email) {
    console.error("Error: --email is required");
    process.exit(1);
  }

  // Generate a simulated license token and API key
  const token = crypto.randomBytes(32).toString("hex");
  const apiKey = "sb_" + crypto.randomBytes(16).toString("hex");
  const tierLabel = `SimpleBeacon ${tier}`;

  // Tier-specific features
  const tierFeatures = {
    Pro: [
      "Unlimited scans",
      "CI/CD gate integration",
      "48 analyzer engines",
      "EU AI Act compliance checks",
      "Board-ready certificates",
    ],
    Developer: [
      "Unlimited scans",
      "CI gate",
      "48 analyzer modules",
      "EU AI Act compliance checks",
    ],
    "Team Pro": [
      "Everything in Developer",
      "EU AI Act, SOC 2, board-ready certificates",
      "5 team seats included",
      "Priority support",
    ],
  };
  const features = tierFeatures[tier] || tierFeatures.Pro;

  let subject, text, html;

  if (renderLicenseConfirmation) {
    // Use the premium template
    const rendered = renderLicenseConfirmation({
      tierLabel,
      token,
      apiKey,
      ttlLabel: "30 days",
      customerEmail: email,
      features,
      dashboardUrl: "https://simplebeacon.ai/dashboard/",
      signInUrl: "https://simplebeacon.ai/dashboard/#/signin",
    });
    subject = rendered.subject;
    text = rendered.text;
    html = rendered.html;
  } else {
    // Fallback basic template with login instructions
    const invoiceId = `inv_${Date.now()}`;
    subject = `Your ${tier} subscription is active — SimpleBeacon`;
    text = `Hi ${name},\n\nThanks — we received your payment and your ${tier} subscription is now active.\n\nInvoice: ${invoiceId}\nPlan: ${tier}\nBilling date: ${new Date().toISOString()}\n\nGET STARTED:\n1. Activate your license: https://simplebeacon.ai/dashboard/signin?mode=license&token=${token}\n2. Install the CLI: npx --yes simplebeacon init --starter\n3. Run your first scan: npx simplebeacon scan --gate --offline\n\nLicense Token: ${token}\nAPI Key: ${apiKey}\n\nQuestions? Reply to this email or contact admin@simplebeacon.ai.\n\n— The SimpleBeacon Team`;
    html = `<p>Hi ${name},</p><p>Thanks — we received your payment and your <strong>${tier}</strong> subscription is now active.</p><p><b>Invoice:</b> ${invoiceId}<br/><b>Plan:</b> ${tier}<br/><b>Billing date:</b> ${new Date().toISOString()}</p><h3>Get Started</h3><ol><li><a href="https://simplebeacon.ai/dashboard/signin?mode=license&token=${token}">Activate your license</a> — instant access, no password needed</li><li>Install the CLI: <code>npx --yes simplebeacon init --starter</code></li><li>Run your first scan: <code>npx simplebeacon scan --gate --offline</code></li></ol><p><b>License Token:</b> <code>${token}</code><br/><b>API Key:</b> <code>${apiKey}</code></p><p>Questions? Reply to this email or contact admin@simplebeacon.ai.</p><p>— The SimpleBeacon Team</p>`;
  }

  const dryRun = !(process.env.SEND_EMAIL === "true");
  console.log(
    `Simulating Pro payment for ${email} (name=${name}, tier=${tier})`,
  );
  console.log(
    dryRun
      ? "Dry-run mode: no email will be sent. Set SEND_EMAIL=true to actually send."
      : "SEND_EMAIL=true detected — attempting to send email via configured provider.",
  );

  if (dryRun) {
    console.log("--- Email preview ---");
    console.log("To:", email);
    console.log("Subject:", subject);
    console.log("Text:", text);
    process.exit(0);
  }

  try {
    const result = await sendEmail({ to: email, subject, text, html });
    console.log("Send result:", result);
    if (result.sent) {
      console.log("Email sent successfully.");
    } else if (result.queued) {
      console.log(
        "Email queued to disk:",
        result.queuePath || "(unknown path)",
      );
    } else {
      console.log("Email not sent:", result.error || JSON.stringify(result));
    }
  } catch (err) {
    console.error(
      "Failed to send email:",
      err && err.message ? err.message : String(err),
    );
    process.exit(2);
  }
}

main();
