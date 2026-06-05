/**
 * Operator deliverable workspaces — shared by CLI and /api/operator/deliverable.
 *
 * EU AI Act Documentation Marker:
 * - This service integrates with artificial intelligence providers for report generation (OpenAI API).
 * - Article 50: Transparency — users are informed when AI-generated content is included in deliverables.
 * - Article 12: Audit logging — AI inference decisions and model outputs are logged via the
 *   ai-inference-audit-logger module for accountability and traceability.
 * - Risk Level: Limited risk (human-reviewed deliverables)
 */

const fs = require('fs');
const path = require('path');
const { readJsonFileCached } = require('./json-file-cache.cjs');

const PRODUCTS = {
  moneyPrinter19: {
    label: 'Money Printer Tier ($19)',
    sku: 'moneyPrinter19',
    price: 19,
    clock: '60 seconds — instant delivery',
    clientSends: 'Domain name only — no source code upload',
    vaultSteps: [
      'Receive domain via Stripe checkout webhook',
      'Run instant security audit (SEO, SSL, speed, accessibility, headers)',
      'Generate PDF report via OpenAI API',
      'Download instantly — data wiped from RAM after download'
    ],
    notIncluded: 'Source code scan, gate attestation, milestone certificates'
  },
  clearance499: {
    label: 'Executive clearance PDF ($499)',
    sku: 'clearance499',
    price: 499,
    clock: '48 business hours from gate JSON received',
    clientSends: '`.simplebeacon/report.json` from `scan --gate --offline` (no source zip required)',
    vaultSteps: [
      'Unlock vault → /app → Analyze',
      'Load client report or project path; confirm gate blockingCount',
      'Download audit PDF (print-to-PDF)',
      'Email PDF to billing contact; log pdf_delivered_at on booking'
    ],
    notIncluded: 'Hosted dashboard, milestone certificates, EU legal certification'
  },
  agency999: {
    label: 'Agency Project Pack ($999)',
    sku: 'agency999',
    price: 999,
    clock: '48 business hours per milestone',
    clientSends: 'Gate JSON per milestone + agency logo for co-branding',
    vaultSteps: [
      'Confirm project_id in .simplebeacon/agency-projects.json (project_pack tokens)',
      'Analyze → complete scan → Agency certificate export for alpha / beta / release',
      'Mark milestone token used after each export'
    ],
    notIncluded: 'Single $499 PDF replaces three certificates'
  },
  agency1499: {
    label: 'Agency Growth Pack ($1,499)',
    sku: 'agency1499',
    price: 1499,
    clock: '24-hour priority per milestone',
    clientSends: 'Same as Project Pack + Slack for launch window',
    vaultSteps: [
      'Same as agency999 plus hotfix + warranty tokens',
      'Create private Slack sb-{agency}-{project}; pin project_id',
      'Use warranty token for included re-scan (do not bill $199 separately)'
    ],
    notIncluded: 'Cloud Teams subscription'
  },
  euai2499: {
    label: 'EU AI Act Readiness Sprint ($2,499)',
    sku: 'euai2499',
    price: 2499,
    clock: 'Contracted (target 48 business hours)',
    clientSends: 'Gate JSON + optional repo context for EU pattern scan',
    vaultSteps: [
      'Run: npx simplebeacon scan --gate --offline --checklist eu-ai-act',
      'Run: npx simplebeacon compliance --checklist eu-ai-act',
      'Vault Analyze + executive PDF; attach technical remediation list',
      'Disclaimer: technical readiness, not legal conformity'
    ],
    notIncluded: 'Legal conformity certification'
  },
  warranty199: {
    label: 'Post-handoff re-scan ($199)',
    sku: 'warranty199',
    price: 199,
    clock: '48 business hours from new gate JSON',
    clientSends: 'Fresh gate report ~30 days post-release',
    vaultSteps: [
      'Confirm Growth pack warranty token not already consumed',
      'Same PDF workflow as clearance499 with re-attestation cover letter',
      'Log warranty_delivered_at on agency project when applicable'
    ],
    notIncluded: 'Free CLI re-run without operator review'
  }
};

function slugify(text) {
  return String(text || 'client')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'client';
}

function readJsonSafe(filePath) {
  return readJsonFileCached(filePath);
}

function inferProductFromBooking(booking = {}) {
  const explicit = String(booking.productSku || booking.product || '').trim().toLowerCase();
  if (explicit && PRODUCTS[explicit]) return explicit;

  const source = String(booking.source || '').toLowerCase();
  const notes = String(booking.notes || '').toLowerCase();
  const combined = `${source} ${notes}`;

  if (/money.?printer|instant.?audit|19/.test(combined)) return 'moneyPrinter19';
  if (/eu[\s-]?ai|euai|2499|readiness sprint/.test(combined)) return 'euai2499';
  if (/growth|1499|priority slack/.test(combined)) return 'agency1499';
  if (/project pack|agency pack|999|milestone certificate/.test(combined)) return 'agency999';
  if (/warranty|re-scan|re scan|199/.test(combined)) return 'warranty199';

  return 'clearance499';
}

function validateGateReport(reportPath) {
  const payload = readJsonSafe(reportPath);
  if (!payload) {
    return { ok: false, error: 'Report file missing or invalid JSON' };
  }
  const gate = payload.gate || payload.results?.simplebeacon?.gate;
  const summary = payload.summary || payload.results?.simplebeacon?.summary;
  const blocking = gate?.blockingCount ?? summary?.blockingCount;
  const pass = gate?.pass ?? summary?.simplebeaconGatePass;
  return {
    ok: true,
    pass: pass === true,
    blockingCount: blocking != null ? Number(blocking) : null,
    issueCount: payload.issueCount ?? payload.results?.simplebeacon?.issueCount ?? null,
    generatedAt: payload.generatedAt || payload.results?.simplebeacon?.generatedAt || null
  };
}

function resolveReportPath(inputPath, projectRoot) {
  if (!inputPath) return null;
  const resolved = path.resolve(projectRoot, inputPath);
  const root = path.resolve(projectRoot);
  if (!resolved.startsWith(root)) return null;
  if (!fs.existsSync(resolved)) return null;
  return resolved;
}

function loadVaultPassword(projectRoot) {
  const envPath = path.join(projectRoot, '.env.v1-internal');
  if (!fs.existsSync(envPath)) return null;
  const text = fs.readFileSync(envPath, 'utf8');
  const match = text.match(/^DASHBOARD_VAULT_PASSWORD=(.+)$/m);
  if (!match) return null;
  return match[1].trim().replace(/^["']|["']$/g, '');
}

function vaultUrls(projectRoot, options = {}) {
  const port = options.port || process.env.PORT || 54355;
  const password = options.vaultPassword ?? loadVaultPassword(projectRoot);
  const base = process.env.OPERATOR_DASHBOARD_BASE_URL
    || process.env.PUBLIC_APP_URL
    || `http://127.0.0.1:${port}`;
  const q = password ? `?password=${encodeURIComponent(password)}` : '';
  return {
    vault: `${base}/private-dashboard-vault${q}`,
    analyze: `${base}/app#/analyze`,
    bookings: `${base}/operator/bookings`,
    sampleReport: `${base}/sample-report`,
    handoffGuide: 'https://simplebeacon.ai/downloads/repo-handoff.html',
    runbook: 'docs/operator-client-deliverables-from-vault.md'
  };
}

function loadAgencyProject(projectRoot, projectId) {
  const storePath = path.join(projectRoot, '.simplebeacon', 'agency-projects.json');
  const store = readJsonSafe(storePath);
  if (!store) return null;
  const projects = store.projects || store;
  return projects[projectId] || null;
}

function buildOutboundMd(product, ctx) {
  const lines = [
    `# Outbound — ${product.label}`,
    '',
    `- **SKU:** ${product.sku}`,
    `- **SLA:** ${product.clock}`,
    `- **Workspace:** ${ctx.workspaceDir}`,
    ''
  ];
  if (ctx.booking) {
    lines.push('## Booking', '');
    lines.push(`- Email: ${ctx.booking.contactEmail || '—'}`);
    lines.push(`- Company: ${ctx.booking.company || '—'}`);
    lines.push(`- Repository: ${ctx.booking.repository || '—'}`);
    lines.push(`- Branch: ${ctx.booking.branch || '—'}`);
    lines.push(`- Handoff date: ${ctx.booking.handoffDate || '—'}`);
    if (ctx.booking.notes) lines.push(`- Notes: ${ctx.booking.notes}`);
    lines.push('');
  }
  if (ctx.gate) {
    lines.push('## Gate report', '');
    lines.push(`- Pass: **${ctx.gate.pass ? 'YES' : 'NO'}**`);
    if (ctx.gate.blockingCount != null) lines.push(`- Blocking: **${ctx.gate.blockingCount}**`);
    if (ctx.gate.generatedAt) lines.push(`- Generated: ${ctx.gate.generatedAt}`);
    lines.push('');
  }
  if (ctx.project) {
    lines.push('## Agency project', '');
    lines.push(`- project_id: \`${ctx.project.project_id}\``);
    lines.push(`- pack: ${ctx.project.pack_label || ctx.project.pack_type}`);
    lines.push(`- client: ${ctx.project.client_name || '—'}`);
    lines.push('');
    lines.push('### Tokens', '');
    for (const [name, tok] of Object.entries(ctx.project.tokens || {})) {
      lines.push(`- ${name}: ${tok.used ? 'used' : 'available'}`);
    }
    lines.push('');
  }
  lines.push('## Vault checklist', '');
  product.vaultSteps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
  lines.push('', '## Email bullets', '');
  lines.push(`- Deliverable: ${product.label}`);
  lines.push('- We reviewed your local SimpleBeacon gate report (deterministic rules, not LLM scoring).');
  if (product.sku === 'clearance499' || product.sku === 'warranty199') {
    lines.push('- Attached: executive PDF with gate verdict and developer remediations.');
  }
  if (product.sku.startsWith('agency')) {
    lines.push('- Attached: co-branded hygiene certificate for this milestone.');
  }
  if (product.sku === 'euai2499') {
    lines.push('- Attached: EU AI Act technical readiness summary (not legal conformity certification).');
  }
  lines.push('', `*Not included: ${product.notIncluded}*`);
  return lines.join('\n');
}

function enrichBooking(row) {
  const sku = inferProductFromBooking(row);
  const product = PRODUCTS[sku];
  return {
    ...row,
    bookingKey: row.receivedAt || null,
    inferredProduct: sku,
    inferredProductLabel: product ? product.label : sku
  };
}

async function updateBookingDeliverable(projectRoot, bookingKey, patch, options = {}) {
  const file = options.bookingsPath || path.join(projectRoot, 'data', 'audit-bookings.json');
  let rows;
  try {
    rows = JSON.parse(await fs.promises.readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
  if (!Array.isArray(rows)) return false;
  const idx = rows.findIndex((r) => r.receivedAt === bookingKey);
  if (idx < 0) return false;
  rows[idx] = { ...rows[idx], ...patch };
  await fs.promises.writeFile(file, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  return true;
}

async function createDeliverableWorkspace(input, options = {}) {
  const projectRoot = path.resolve(options.projectRoot || path.join(__dirname, '../..'));
  const deliverablesRoot = path.join(projectRoot, 'deliverables', 'clients');

  const productKey = String(input.product || inferProductFromBooking(input.booking || {})).toLowerCase();
  const product = PRODUCTS[productKey];
  if (!product) {
    return { ok: false, error: 'unknown_product', message: `Unknown product "${productKey}"` };
  }

  const booking = input.booking || null;
  const milestone = String(input.milestone || '').toLowerCase();
  const projectId = String(input.projectId || '').trim();

  let gate = null;
  const reportPath = resolveReportPath(
    input.reportPath || input.report,
    projectRoot
  );
  if (reportPath) {
    gate = validateGateReport(reportPath);
    if (!gate.ok) {
      return { ok: false, error: 'invalid_report', message: gate.error };
    }
  }

  let agencyProject = null;
  if (projectId) {
    agencyProject = loadAgencyProject(projectRoot, projectId);
    if (!agencyProject) {
      return { ok: false, error: 'project_not_found', message: projectId };
    }
    if (milestone && !agencyProject.tokens?.[milestone]) {
      return {
        ok: false,
        error: 'invalid_milestone',
        message: `Available: ${Object.keys(agencyProject.tokens || {}).join(', ')}`
      };
    }
  }

  const slugBase = input.company
    || booking?.company
    || agencyProject?.client_name
    || input.client
    || 'client';
  const slug = `${slugify(slugBase)}${milestone ? `-${milestone}` : ''}-${new Date().toISOString().slice(0, 10)}`;
  const workspaceDir = path.join(deliverablesRoot, slug);
  const exportsDir = path.join(workspaceDir, 'exports');

  await fs.promises.mkdir(exportsDir, { recursive: true });

  const urls = vaultUrls(projectRoot, options);
  const intake = {
    createdAt: new Date().toISOString(),
    product: product.sku,
    label: product.label,
    bookingEmail: booking?.contactEmail || input.bookingEmail || null,
    booking,
    projectId: projectId || null,
    milestone: milestone || null,
    reportPath: reportPath || null,
    gate,
    vaultUrls: urls
  };

  await fs.promises.writeFile(
    path.join(workspaceDir, 'intake.json'),
    `${JSON.stringify(intake, null, 2)}\n`,
    'utf8'
  );
  if (reportPath) {
    await fs.promises.copyFile(reportPath, path.join(workspaceDir, 'report.json'));
  }
  await fs.promises.writeFile(
    path.join(workspaceDir, 'OUTBOUND.md'),
    `${buildOutboundMd(product, { workspaceDir, gate, project: agencyProject, booking, milestone })}\n`,
    'utf8'
  );

  if (booking?.receivedAt) {
    await updateBookingDeliverable(projectRoot, booking.receivedAt, {
      deliverableWorkspace: path.relative(projectRoot, workspaceDir).replace(/\\/g, '/'),
      deliverableProduct: product.sku,
      deliverableStartedAt: new Date().toISOString()
    }, options);
  }

  return {
    ok: true,
    product,
    workspaceDir,
    workspaceRelative: path.relative(projectRoot, workspaceDir).replace(/\\/g, '/'),
    gate,
    urls,
    intake,
    gateWarning: gate && gate.pass === false
  };
}

function listProducts() {
  return Object.values(PRODUCTS).map((p) => ({
    sku: p.sku,
    price: p.price,
    label: p.label
  }));
}

module.exports = {
  PRODUCTS,
  inferProductFromBooking,
  enrichBooking,
  validateGateReport,
  createDeliverableWorkspace,
  vaultUrls,
  listProducts,
  buildOutboundMd
};
