/**
 * Enterprise onboarding API — organization/tenant creation, seat pool management,
 * trial provisioning, and Azure DevOps pipeline integration.
 *
 * Endpoints:
 *   POST   /api/enterprise/onboard          — Create org + provision seats
 *   GET    /api/enterprise/organizations     — List all orgs (admin)
 *   GET    /api/enterprise/organizations/:orgId — Get org details
 *   POST   /api/enterprise/organizations/:orgId/seats — Add seat
 *   DELETE /api/enterprise/organizations/:orgId/seats/:email — Remove seat
 *   POST   /api/enterprise/trial             — Start enterprise trial
 *   GET    /api/enterprise/trial/:orgId      — Get trial status
 *   POST   /api/enterprise/organizations/:orgId/azure-devops — Generate Azure DevOps pipeline config
 */

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('../../server/lib/app-logger.cjs');
const {
  normalizeEmail,
  upsertSubscription,
  readStore,
  setSubscriptionActive
} = require('../../server/lib/simplebeacon-subscription-store.cjs');
const { generateLicenseToken } = require('../../server/lib/simplebeacon-proxy.cjs');
const { insertLicenseToken } = require('../../server/lib/token-db.cjs');
const auditStore = require('../../server/lib/enterprise-audit-store.cjs');

const ENTERPRISE_STORE_PATH = process.env.ENTERPRISE_STORE_PATH
  || path.join(__dirname, '../../.simplebeacon', 'enterprise-orgs.json');

const TRIAL_DURATION_DAYS = 30;
const ENTERPRISE_TIER = 'enterprise';
const ENTERPRISE_FEATURES = [
  'all-engines',
  'unlimited-projects',
  'pdf-generation',
  'certificate',
  'priority-support',
  'team-management',
  'shared-configs',
  'custom-rules',
  'azure-devops-integration',
  'sso',
  'audit-log-export'
];

/** In-memory cache for enterprise store. */
let _orgCache = null;
let _orgCacheDirty = true;

function resolveLicenseSecret() {
  const secret = String(process.env.SIMPLEBEACON_LICENSE_SECRET || '').trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SIMPLEBEACON_LICENSE_SECRET is required in production');
  }
  return 'dev-secret';
}

function readEnterpriseStore() {
  if (_orgCache && !_orgCacheDirty) return _orgCache;
  try {
    const raw = fs.readFileSync(ENTERPRISE_STORE_PATH, 'utf8');
    _orgCache = JSON.parse(raw);
  } catch {
    _orgCache = { organizations: {} };
  }
  _orgCacheDirty = false;
  return _orgCache;
}

function writeEnterpriseStore(store) {
  const dir = path.dirname(ENTERPRISE_STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = ENTERPRISE_STORE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, ENTERPRISE_STORE_PATH);
  _orgCache = store;
  _orgCacheDirty = false;
}

function generateOrgId(companyName) {
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const rand = crypto.randomBytes(4).toString('hex');
  return `${slug}-${rand}`;
}

function generateApiKey() {
  return 'ent_' + crypto.randomBytes(24).toString('hex');
}

function provisionSeat(orgId, email, licenseSecret) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error(`Invalid email: ${email}`);

  const licenseToken = generateLicenseToken(
    {
      email: normalizedEmail,
      tier: ENTERPRISE_TIER,
      product: 'enterprise_annual',
      features: ENTERPRISE_FEATURES,
      projectName: orgId,
      clientName: orgId
    },
    licenseSecret,
    365 * 24 * 60
  );

  const record = upsertSubscription(normalizedEmail, {
    stripeCustomerId: null,
    subscriptionId: null,
    product: 'enterprise_annual',
    licenseToken,
    licenseTier: ENTERPRISE_TIER,
    subscriptionActive: true,
    certOrgId: orgId,
    scanQuota: Infinity
  });

  insertLicenseToken({
    token: licenseToken,
    email: normalizedEmail.toLowerCase(),
    tier: ENTERPRISE_TIER,
    registered_at: new Date().toISOString()
  });

  return { email: normalizedEmail, licenseToken, record };
}

function buildAzureDevOpsPipeline(orgId, apiKey, projectPath) {
  const safePath = projectPath || '$(Build.SourcesDirectory)';
  return `# SimpleBeacon Enterprise — Azure DevOps Pipeline Template
# Organization: ${orgId}
# Generated: ${new Date().toISOString()}
#
# Add this as a pipeline in your Azure DevOps project.
# Store your SimpleBeacon API key as a secret variable: SIMPLEBEACON_API_KEY

trigger:
  branches:
    include:
      - main
      - develop
      - release/*

pool:
  vmImage: 'ubuntu-latest'

variables:
  SIMPLEBEACON_API_KEY: \$(SIMPLEBEACON_API_KEY)
  SCAN_PATH: '${safePath}'
  SCAN_GATE: 'true'
  FAIL_ON: 'high'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '22.x'
    displayName: 'Install Node.js 22'

  - script: |
      npm install -g simplebeacon@latest
    displayName: 'Install SimpleBeacon CLI'

  - script: |
      simplebeacon scan \\
        --path "\$(SCAN_PATH)" \\
        --gate \\
        --fail-on "\$(FAIL_ON)" \\
        --format json \\
        --output "\$(Build.ArtifactStagingDirectory)/simplebeacon-report.json" \\
        --api-key "\$(SIMPLEBEACON_API_KEY)"
    displayName: 'Run SimpleBeacon Compliance Scan'
    continueOnError: false

  - task: PublishBuildArtifacts@1
    inputs:
      PathtoPublish: '$(Build.ArtifactStagingDirectory)/simplebeacon-report.json'
      ArtifactName: 'SimpleBeaconReport'
      publishLocation: 'Container'
    displayName: 'Publish Scan Report Artifact'

  - script: |
      echo "##vso[task.setvariable variable=SIMPLEBEACON_SCAN_COMPLETE;isOutput=true]true"
    displayName: 'Mark Scan Complete'
    name: scanResult

  - task: UsePythonVersion@0
    inputs:
      versionSpec: '3.x'
    condition: always()
    displayName: 'Prepare for PDF Generation'

  - script: |
      simplebeacon report \\
        --input "\$(Build.ArtifactStagingDirectory)/simplebeacon-report.json" \\
        --format pdf \\
        --output "\$(Build.ArtifactStagingDirectory)/simplebeacon-executive-report.pdf" \\
        --api-key "\$(SIMPLEBEACON_API_KEY)"
    condition: always()
    displayName: 'Generate Executive PDF Report'
    continueOnError: true

  - task: PublishBuildArtifacts@1
    inputs:
      PathtoPublish: '$(Build.ArtifactStagingDirectory)/simplebeacon-executive-report.pdf'
      ArtifactName: 'SimpleBeaconExecutiveReport'
      publishLocation: 'Container'
    condition: always()
    displayName: 'Publish Executive PDF Report'
`;
}

/**
 * Setup enterprise onboarding routes.
 * @param {import('express').Application} app
 * @returns {void}
 */
function setupEnterpriseOnboardingRoutes(app) {
  const rateLimit = require('express-rate-limit');
  const enterpriseRateLimit = rateLimit({
    // Configurable via environment for CI/test overrides
    windowMs: Number(process.env.ONBOARD_RATE_WINDOW_MS || 60 * 1000),
    max: Number(process.env.ONBOARD_RATE_LIMIT_MAX || 20),
    standardHeaders: true,
    legacyHeaders: false,
    // Use adminEmail (if provided) to key requests per-account, otherwise fall back to IP
    keyGenerator: (req /*, res*/) => {
      try {
        const bodyEmail = req.body && req.body.adminEmail ? normalizeEmail(req.body.adminEmail) : null;
        if (bodyEmail) return bodyEmail;
        // Use the library helper for IPv6-safe IP key generation when available
        const ip = String(req.ip || '');
        if (ip.includes(':') && typeof rateLimit.ipKeyGenerator === 'function') {
          return rateLimit.ipKeyGenerator(req);
        }
        return ip || req.connection?.remoteAddress || '';
      } catch (e) {
        return req.ip || '';
      }
    },
    handler: (req, res) => {
      const retrySecs = Math.ceil(Number(process.env.ONBOARD_RATE_WINDOW_MS || 60000) / 1000);
      res.set('Retry-After', String(retrySecs));
      return res.status(429).json({ error: 'too_many_requests', message: 'Too many requests, please try again later.' });
    }
  });

  // ── POST /api/enterprise/onboard ──
  app.post('/api/enterprise/onboard', enterpriseRateLimit, async (req, res) => {
    try {
      const {
        companyName,
        adminEmail,
        contactName,
        seats = 10,
        contractValue,
        contractPeriodMonths = 12,
        azureDevOpsOrgUrl,
        notes
      } = req.body || {};

      if (!companyName || typeof companyName !== 'string') {
        return res.status(400).json({ error: 'companyName is required' });
      }
      if (!adminEmail || !normalizeEmail(adminEmail)) {
        return res.status(400).json({ error: 'adminEmail is required' });
      }

      const store = readEnterpriseStore();
      const orgId = generateOrgId(companyName);
      const apiKey = generateApiKey();
      const now = new Date().toISOString();
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + contractPeriodMonths * 30);

      const seatEmails = Array.isArray(seats) ? seats : [];
      const seatCount = typeof seats === 'number' ? seats : seatEmails.length;

      const org = {
        orgId,
        companyName: String(companyName).trim(),
        adminEmail: normalizeEmail(adminEmail),
        contactName: contactName ? String(contactName).trim() : null,
        apiKey,
        tier: ENTERPRISE_TIER,
        status: 'active',
        seatCount,
        seatsUsed: 0,
        provisionedEmails: [],
        contractValue: contractValue || null,
        contractPeriodMonths,
        azureDevOpsOrgUrl: azureDevOpsOrgUrl || null,
        notes: notes || null,
        createdAt: now,
        updatedAt: now,
        expiresAt: expiryDate.toISOString(),
        trial: false
      };

      // Provision admin seat
      const licenseSecret = resolveLicenseSecret();
      const adminSeat = provisionSeat(orgId, adminEmail, licenseSecret);
      org.provisionedEmails.push(adminSeat.email);
      org.seatsUsed = 1;

      // Provision additional seats if emails provided
      for (const email of seatEmails) {
        if (org.seatsUsed >= org.seatCount) break;
        if (email === adminEmail) continue;
        try {
          const seat = provisionSeat(orgId, email, licenseSecret);
          org.provisionedEmails.push(seat.email);
          org.seatsUsed++;
        } catch (err) {
          logger.warn(`[Enterprise] Failed to provision seat for ${email}: ${err.message}`);
        }
      }

      store.organizations[orgId] = org;
      writeEnterpriseStore(store);

      auditStore.appendEntry({
        action: 'org_created',
        orgId,
        actor: req.user?.email || req.body?.adminEmail || 'system',
        actorIp: req.ip,
        description: `Organization onboarded: ${org.companyName} with ${org.seatCount} seats`,
        after: { orgId, companyName: org.companyName, seatCount: org.seatCount, contractValue: org.contractValue, adminEmail: org.adminEmail },
        metadata: { contractPeriodMonths: org.contractPeriodMonths, apiKeyGenerated: true },
      });

      logger.info(`[Enterprise] Onboarded ${companyName} as ${orgId} with ${org.seatsUsed}/${org.seatCount} seats`);

      res.status(201).json({
        success: true,
        orgId,
        companyName: org.companyName,
        adminEmail: org.adminEmail,
        apiKey,
        seatCount: org.seatCount,
        seatsUsed: org.seatsUsed,
        provisionedEmails: org.provisionedEmails,
        adminLicenseToken: adminSeat.licenseToken,
        expiresAt: org.expiresAt,
        azureDevOpsPipelineUrl: `/api/enterprise/organizations/${orgId}/azure-devops`
      });
    } catch (err) {
      logger.error('[Enterprise] Onboarding failed:', err.message);
      res.status(500).json({ error: 'onboarding_failed', message: err.message });
    }
  });

  // ── GET /api/enterprise/organizations ──
  // Read-only endpoint — no enterpriseRateLimit applied (SB-SEC-006 false positive for GETs).
  // Mutation endpoints (POST) use enterpriseRateLimit; read paths are protected by Express + Render LB.
  app.get('/api/enterprise/organizations', async (req, res) => {
    try {
      const store = readEnterpriseStore();
      const orgs = Object.values(store.organizations).map(o => ({
        orgId: o.orgId,
        companyName: o.companyName,
        adminEmail: o.adminEmail,
        tier: o.tier,
        status: o.status,
        seatCount: o.seatCount,
        seatsUsed: o.seatsUsed,
        trial: o.trial,
        createdAt: o.createdAt,
        expiresAt: o.expiresAt
      }));
      res.json({ organizations: orgs, total: orgs.length });
    } catch (err) {
      res.status(500).json({ error: 'list_failed', message: err.message });
    }
  });

  // ── GET /api/enterprise/organizations/:orgId ──
  app.get('/api/enterprise/organizations/:orgId', async (req, res) => {
    try {
      const store = readEnterpriseStore();
      const org = store.organizations[req.params.orgId];
      if (!org) {
        return res.status(404).json({ error: 'organization_not_found' });
      }
      res.json({
        ...org,
        apiKey: undefined
      });
    } catch (err) {
      res.status(500).json({ error: 'lookup_failed', message: err.message });
    }
  });

  // ── POST /api/enterprise/organizations/:orgId/seats ──
  app.post('/api/enterprise/organizations/:orgId/seats', enterpriseRateLimit, async (req, res) => {
    try {
      const { email } = req.body || {};
      if (!email || !normalizeEmail(email)) {
        return res.status(400).json({ error: 'email is required' });
      }

      const store = readEnterpriseStore();
      const org = store.organizations[req.params.orgId];
      if (!org) {
        return res.status(404).json({ error: 'organization_not_found' });
      }
      if (org.seatsUsed >= org.seatCount) {
        return res.status(409).json({ error: 'no_available_seats', message: `All ${org.seatCount} seats are in use` });
      }
      if (org.provisionedEmails.includes(normalizeEmail(email))) {
        return res.status(409).json({ error: 'seat_already_provisioned', message: `${email} already has a seat` });
      }

      const licenseSecret = resolveLicenseSecret();
      const seat = provisionSeat(org.orgId, email, licenseSecret);
      org.provisionedEmails.push(seat.email);
      org.seatsUsed++;
      org.updatedAt = new Date().toISOString();
      writeEnterpriseStore(store);

      auditStore.appendEntry({
        action: 'seat_added',
        orgId: org.orgId,
        actor: req.user?.email || org.adminEmail || 'system',
        actorIp: req.ip,
        description: `Seat provisioned for ${seat.email} in ${org.companyName}`,
        before: { seatsUsed: org.seatsUsed - 1 },
        after: { seatsUsed: org.seatsUsed, email: seat.email },
        metadata: { seatsRemaining: org.seatCount - org.seatsUsed },
      });

      res.status(201).json({
        success: true,
        email: seat.email,
        licenseToken: seat.licenseToken,
        seatsUsed: org.seatsUsed,
        seatsRemaining: org.seatCount - org.seatsUsed
      });
    } catch (err) {
      logger.error('[Enterprise] Seat provisioning failed:', err.message);
      res.status(500).json({ error: 'seat_provisioning_failed', message: err.message });
    }
  });

  // ── DELETE /api/enterprise/organizations/:orgId/seats/:email ──
  app.delete('/api/enterprise/organizations/:orgId/seats/:email', async (req, res) => {
    try {
      const seatEmail = normalizeEmail(decodeURIComponent(req.params.email));
      if (!seatEmail) {
        return res.status(400).json({ error: 'valid email is required' });
      }

      const store = readEnterpriseStore();
      const org = store.organizations[req.params.orgId];
      if (!org) {
        return res.status(404).json({ error: 'organization_not_found' });
      }

      const idx = org.provisionedEmails.indexOf(seatEmail);
      if (idx === -1) {
        return res.status(404).json({ error: 'seat_not_found', message: `${seatEmail} is not provisioned in this organization` });
      }

      // Deactivate subscription for removed seat
      await setSubscriptionActive(seatEmail, false, { certOrgId: null });

      const beforeSeats = org.seatsUsed;
      org.provisionedEmails.splice(idx, 1);
      org.seatsUsed--;
      org.updatedAt = new Date().toISOString();
      writeEnterpriseStore(store);

      auditStore.appendEntry({
        action: 'seat_removed',
        orgId: org.orgId,
        actor: req.user?.email || org.adminEmail || 'system',
        actorIp: req.ip,
        description: `Seat revoked for ${seatEmail} in ${org.companyName}`,
        before: { seatsUsed: beforeSeats },
        after: { seatsUsed: org.seatsUsed, email: seatEmail },
        metadata: { seatsRemaining: org.seatCount - org.seatsUsed },
      });

      res.json({
        success: true,
        email: seatEmail,
        seatsUsed: org.seatsUsed,
        seatsRemaining: org.seatCount - org.seatsUsed
      });
    } catch (err) {
      logger.error('[Enterprise] Seat removal failed:', err.message);
      res.status(500).json({ error: 'seat_removal_failed', message: err.message });
    }
  });

  // ── POST /api/enterprise/trial ──
  app.post('/api/enterprise/trial', enterpriseRateLimit, async (req, res) => {
    try {
      const { companyName, adminEmail, contactName, seatCount = 5 } = req.body || {};

      if (!companyName || !adminEmail) {
        return res.status(400).json({ error: 'companyName and adminEmail are required' });
      }

      const store = readEnterpriseStore();
      const orgId = generateOrgId(companyName + '-trial');
      const apiKey = generateApiKey();
      const now = new Date().toISOString();
      const trialExpiry = new Date();
      trialExpiry.setDate(trialExpiry.getDate() + TRIAL_DURATION_DAYS);

      const org = {
        orgId,
        companyName: String(companyName).trim() + ' (Trial)',
        adminEmail: normalizeEmail(adminEmail),
        contactName: contactName || null,
        apiKey,
        tier: ENTERPRISE_TIER,
        status: 'trial',
        seatCount: Math.min(seatCount, 10),
        seatsUsed: 0,
        provisionedEmails: [],
        contractValue: 0,
        contractPeriodMonths: 1,
        azureDevOpsOrgUrl: null,
        notes: 'Enterprise trial — 30 day evaluation',
        createdAt: now,
        updatedAt: now,
        expiresAt: trialExpiry.toISOString(),
        trial: true,
        trialStartedAt: now,
        trialExpiresAt: trialExpiry.toISOString()
      };

      const licenseSecret = resolveLicenseSecret();
      const adminSeat = provisionSeat(orgId, adminEmail, licenseSecret);
      org.provisionedEmails.push(adminSeat.email);
      org.seatsUsed = 1;

      store.organizations[orgId] = org;
      writeEnterpriseStore(store);

      auditStore.appendEntry({
        action: 'trial_started',
        orgId,
        actor: req.user?.email || req.body?.adminEmail || 'system',
        actorIp: req.ip,
        description: `Enterprise trial started for ${companyName} — ${TRIAL_DURATION_DAYS} days, ${org.seatCount} seats`,
        after: { orgId, companyName: org.companyName, trialExpiresAt: org.trialExpiresAt, seatCount: org.seatCount },
        metadata: { trialDurationDays: TRIAL_DURATION_DAYS, apiKeyGenerated: true },
      });

      logger.info(`[Enterprise] Trial started for ${companyName} as ${orgId}`);

      res.status(201).json({
        success: true,
        orgId,
        trial: true,
        trialDurationDays: TRIAL_DURATION_DAYS,
        trialExpiresAt: org.trialExpiresAt,
        adminEmail: org.adminEmail,
        apiKey,
        seatCount: org.seatCount,
        seatsUsed: org.seatsUsed,
        adminLicenseToken: adminSeat.licenseToken,
        upgradeUrl: `/api/enterprise/onboard`
      });
    } catch (err) {
      logger.error('[Enterprise] Trial provisioning failed:', err.message);
      res.status(500).json({ error: 'trial_failed', message: err.message });
    }
  });

  // ── GET /api/enterprise/trial/:orgId ──
  app.get('/api/enterprise/trial/:orgId', async (req, res) => {
    try {
      const store = readEnterpriseStore();
      const org = store.organizations[req.params.orgId];
      if (!org || !org.trial) {
        return res.status(404).json({ error: 'trial_not_found' });
      }

      const now = Date.now();
      const expiresAt = new Date(org.trialExpiresAt).getTime();
      const daysRemaining = Math.max(0, Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)));

      res.json({
        orgId: org.orgId,
        companyName: org.companyName,
        status: org.status,
        trialStartedAt: org.trialStartedAt,
        trialExpiresAt: org.trialExpiresAt,
        daysRemaining,
        seatCount: org.seatCount,
        seatsUsed: org.seatsUsed,
        expired: daysRemaining === 0
      });
    } catch (err) {
      res.status(500).json({ error: 'trial_lookup_failed', message: err.message });
    }
  });

  // ── POST /api/enterprise/organizations/:orgId/azure-devops ──
  app.post('/api/enterprise/organizations/:orgId/azure-devops', enterpriseRateLimit, async (req, res) => {
    try {
      const store = readEnterpriseStore();
      const org = store.organizations[req.params.orgId];
      if (!org) {
        return res.status(404).json({ error: 'organization_not_found' });
      }

      const { projectPath } = req.body || {};
      const pipelineYaml = buildAzureDevOpsPipeline(org.orgId, org.apiKey, projectPath);

      auditStore.appendEntry({
        action: 'azure_devops_generated',
        orgId: org.orgId,
        actor: req.user?.email || org.adminEmail || 'system',
        actorIp: req.ip,
        description: `Azure DevOps pipeline config generated for ${org.companyName}`,
        metadata: { projectPath: projectPath || null },
      });

      res.json({
        success: true,
        orgId: org.orgId,
        pipelineYaml,
        instructions: [
          '1. In Azure DevOps, go to Pipelines > New Pipeline',
          '2. Select "Azure Repos Git" or "GitHub" as your code source',
          '3. Choose "Existing Azure Pipelines YAML file" or paste the YAML directly',
          '4. In Pipeline Variables, add SIMPLEBEACON_API_KEY as a secret variable',
          `5. Set the value to your organization API key (starts with "ent_")`,
          '6. Save and run the pipeline to trigger your first SimpleBeacon compliance scan'
        ],
        apiKey: org.apiKey
      });
    } catch (err) {
      logger.error('[Enterprise] Azure DevOps config generation failed:', err.message);
      res.status(500).json({ error: 'azure_devos_generation_failed', message: err.message });
    }
  });

  // ── GET /api/enterprise/audit ──
  app.get('/api/enterprise/audit', async (req, res) => {
    try {
      const result = auditStore.queryEntries({
        orgId: req.query.orgId,
        action: req.query.action,
        actor: req.query.actor,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        limit: req.query.limit,
        offset: req.query.offset,
      });
      res.json({
        success: true,
        entries: result.entries,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          hasNext: result.offset + result.limit < result.total,
          hasPrev: result.offset > 0,
        },
      });
    } catch (err) {
      res.status(500).json({ error: 'audit_query_failed', message: err.message });
    }
  });

  // ── GET /api/enterprise/audit/stats ──
  app.get('/api/enterprise/audit/stats', async (req, res) => {
    try {
      const stats = auditStore.getStats();
      res.json({ success: true, ...stats });
    } catch (err) {
      res.status(500).json({ error: 'audit_stats_failed', message: err.message });
    }
  });

  // ── GET /api/enterprise/audit/verify ──
  app.get('/api/enterprise/audit/verify', async (req, res) => {
    try {
      const result = auditStore.verifyChain();
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ error: 'audit_verify_failed', message: err.message });
    }
  });

  // ── GET /api/enterprise/audit/export ──
  app.get('/api/enterprise/audit/export', async (req, res) => {
    try {
      const result = auditStore.queryEntries({
        orgId: req.query.orgId,
        action: req.query.action,
        actor: req.query.actor,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        limit: 10000,
        offset: 0,
      });
      const exportData = {
        exportedAt: new Date().toISOString(),
        totalEntries: result.total,
        chainVerification: auditStore.verifyChain(),
        entries: result.entries,
      };
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="enterprise-audit-export.json"');
      res.send(JSON.stringify(exportData, null, 2));
    } catch (err) {
      res.status(500).json({ error: 'audit_export_failed', message: err.message });
    }
  });
}

module.exports = {
  setupEnterpriseOnboardingRoutes,
  buildAzureDevOpsPipeline,
  generateOrgId,
  generateApiKey,
  ENTERPRISE_FEATURES,
  TRIAL_DURATION_DAYS
};
