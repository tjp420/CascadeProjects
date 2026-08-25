#!/usr/bin/env node
// Simple verification script for required production environment variables.
const required = [
  { name: "STRIPE_SECRET_KEY", hint: "should start with sk_live_" },
  { name: "STRIPE_WEBHOOK_SECRET", hint: "should start with whsec_" },
  { name: "RESEND_API_KEY", hint: "should start with re_" },
  { name: "RESEND_FROM", hint: "e.g. noreply@yourdomain.com" },
];

function check() {
  const missing = [];
  const invalid = [];
  for (const v of required) {
    const val = process.env[v.name];
    if (!val) {
      missing.push(v.name);
      continue;
    }
    if (v.name === "STRIPE_SECRET_KEY" && !val.startsWith("sk_live_"))
      invalid.push(`${v.name} (expected sk_live_)`);
    if (v.name === "STRIPE_WEBHOOK_SECRET" && !val.startsWith("whsec_"))
      invalid.push(`${v.name} (expected whsec_)`);
    if (v.name === "RESEND_API_KEY" && !val.startsWith("re_"))
      invalid.push(`${v.name} (expected re_)`);
  }

  if (missing.length || invalid.length) {
    console.error("Production environment validation failed");
    if (missing.length) console.error("Missing vars:", missing.join(", "));
    if (invalid.length) console.error("Invalid format:", invalid.join(", "));
    process.exit(2);
  }

  console.log("All required production environment variables are present.");
}

check();
