'use strict';

/**
 * SSO Authentication Handler — Live OIDC + SAML 2.0 Protocol Flows
 *
 * Implements:
 *   - OIDC Authorization Code flow (redirect → callback → token exchange → userinfo)
 *   - SAML 2.0 Assertion Consumer Service (ACS) endpoint
 *   - PKCE support for OIDC
 *   - State + nonce validation for CSRF protection
 *   - JWT issuance after successful SSO authentication
 *   - Session establishment with redirect to dashboard
 *
 * @module sso-auth-handler
 */

const crypto = require('crypto');
const https = require('https');
const { URL, URLSearchParams } = require('url');
const logger = require('../lib/app-logger.cjs');
const ssoConfigStore = require('../lib/sso-config-store.cjs');
const { generateToken } = require('../lib/auth/token-service.cjs');
const auditStore = require('../lib/enterprise-audit-store.cjs');

// ── Open redirect prevention ────────────────────────────────────────────────

/**
 * Validate that a redirect URL is safe (relative path or HTTPS).
 * Prevents open redirect attacks by ensuring user-controlled input
 * cannot redirect to arbitrary external HTTP URLs.
 */
function isSafeRedirectUrl(target) {
  if (!target || typeof target !== 'string') return false;
  // Relative URLs (e.g. /dashboard) are safe
  if (target.startsWith('/') && !target.startsWith('//')) return true;
  try {
    const parsed = new URL(target);
    // Only HTTPS redirects to external hosts are allowed
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Safe redirect — validates target before redirecting, falls back to /dashboard.
 * Uses res.location + res.status(302).end to avoid passing variables directly
 * to the Express redirect method, ensuring the URL is always validated first.
 */
function safeRedirect(res, target) {
  if (isSafeRedirectUrl(target)) {
    res.location(target);
    return res.status(302).end();
  }
  logger.warn(`[SSO] Blocked unsafe redirect to: ${target}`);
  res.location('/dashboard');
  return res.status(302).end();
}

// ── In-memory state store (for production, use Redis) ───────────────────────

const stateStore = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

function generateState() {
  return crypto.randomBytes(32).toString('hex');
}

function generateNonce() {
  return crypto.randomBytes(32).toString('hex');
}

function generatePKCEVerifier() {
  return crypto.randomBytes(48).toString('base64url');
}

function pkceVerifierToChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function storeState(state, data) {
  stateStore.set(state, { ...data, createdAt: Date.now() });
  setTimeout(() => stateStore.delete(state), STATE_TTL_MS);
}

function consumeState(state) {
  const entry = stateStore.get(state);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > STATE_TTL_MS) {
    stateStore.delete(state);
    return null;
  }
  stateStore.delete(state);
  return entry;
}

// ── HTTP helper for OIDC token exchange and userinfo ────────────────────────

function httpsPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const postData = typeof body === 'string' ? body : new URLSearchParams(body).toString();
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function httpsGet(url, accessToken) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── OIDC Discovery ──────────────────────────────────────────────────────────

const discoveryCache = new Map();

async function fetchOidcDiscovery(issuerUrl) {
  if (discoveryCache.has(issuerUrl)) {
    const cached = discoveryCache.get(issuerUrl);
    if (Date.now() - cached.fetchedAt < 60 * 60 * 1000) return cached.doc;
  }
  const discoveryUrl = issuerUrl.endsWith('/')
    ? issuerUrl + '.well-known/openid-configuration'
    : issuerUrl + '/.well-known/openid-configuration';
  const result = await httpsGet(discoveryUrl, '');
  if (result.status !== 200) {
    throw new Error(`OIDC discovery failed: ${result.status}`);
  }
  discoveryCache.set(issuerUrl, { doc: result.data, fetchedAt: Date.now() });
  return result.data;
}

// ── ID Token Validation ─────────────────────────────────────────────────────

function validateIdToken(idToken, config, expectedNonce) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Invalid ID token format');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

  if (payload.iss && payload.iss !== config.oidc.issuer) {
    throw new Error(`ID token issuer mismatch: ${payload.iss} != ${config.oidc.issuer}`);
  }
  if (payload.aud && payload.aud !== config.oidc.clientId) {
    throw new Error(`ID token audience mismatch: ${payload.aud} != ${config.oidc.clientId}`);
  }
  if (expectedNonce && payload.nonce !== expectedNonce) {
    throw new Error('ID token nonce mismatch — possible replay attack');
  }
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new Error('ID token expired');
  }

  return payload;
}

// ── User Provisioning ───────────────────────────────────────────────────────

function provisionSsoUser(userInfo, config) {
  const email = userInfo.email || userInfo['email'] || userInfo.preferred_username;
  if (!email) throw new Error('No email returned from IdP');

  const name = userInfo.name || `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim() || email;
  const orgId = config.orgId || 'sso';
  const userId = `sso:${orgId}:${crypto.createHash('sha256').update(email).digest('hex').slice(0, 16)}`;

  return {
    id: userId,
    email,
    name,
    trustLevel: 'silver',
    role: 'sso-user',
    tier: 'enterprise',
    features: ['sso', 'enterprise_dashboard', 'compliance_scan'],
    ssoProviderId: config.providerId,
    ssoOrgId: orgId,
  };
}

// ── Route Handler: Initiate OIDC Login ──────────────────────────────────────

async function initiateOidcLogin(req, res) {
  const { providerId } = req.query;
  if (!providerId) return res.status(400).json({ error: 'providerId required' });

  const config = ssoConfigStore.getConfigDecrypted(providerId);
  if (!config || !config.enabled || config.method !== 'oidc') {
    return res.status(404).json({ error: 'OIDC provider not found or disabled' });
  }

  try {
    const discovery = await fetchOidcDiscovery(config.oidc.issuer);
    const state = generateState();
    const nonce = generateNonce();
    const pkceVerifier = generatePKCEVerifier();
    const pkceChallenge = pkceVerifierToChallenge(pkceVerifier);

    const appBaseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${appBaseUrl}/api/sso/oidc/callback`;

    storeState(state, {
      providerId,
      nonce,
      pkceVerifier,
      redirectUri,
      method: 'oidc',
    });

    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: config.oidc.clientId,
      redirect_uri: redirectUri,
      state,
      nonce,
      scope: config.oidc.scope || 'openid profile email',
      code_challenge: pkceChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = discovery.authorization_endpoint + '?' + authParams.toString();
    logger.info(`[SSO] Initiating OIDC login for provider ${providerId}`);
    safeRedirect(res, authUrl);
  } catch (err) {
    logger.error('[SSO] OIDC initiation failed:', err.message);
    res.status(500).json({ error: 'OIDC initiation failed', message: err.message });
  }
}

// ── Route Handler: OIDC Callback (code exchange) ────────────────────────────

async function oidcCallback(req, res) {
  const { code, state, error, error_description } = req.query;

  if (error) {
    logger.warn(`[SSO] OIDC callback error: ${error} — ${error_description}`);
    const frontendUrl = process.env.DASHBOARD_URL || '/dashboard';
    return safeRedirect(res, `${frontendUrl}?sso_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.status(400).json({ error: 'Missing code or state parameter' });
  }

  const stateData = consumeState(state);
  if (!stateData || stateData.method !== 'oidc') {
    return res.status(400).json({ error: 'Invalid or expired state' });
  }

  const config = ssoConfigStore.getConfigDecrypted(stateData.providerId);
  if (!config) {
    return res.status(404).json({ error: 'SSO provider configuration not found' });
  }

  try {
    const discovery = await fetchOidcDiscovery(config.oidc.issuer);

    // Exchange authorization code for tokens
    const tokenResponse = await httpsPost(discovery.token_endpoint, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: stateData.redirectUri,
      client_id: config.oidc.clientId,
      client_secret: config.oidc._decryptedSecret || '',
      code_verifier: stateData.pkceVerifier,
    });

    if (tokenResponse.status !== 200) {
      throw new Error(`Token exchange failed: ${tokenResponse.status} — ${JSON.stringify(tokenResponse.data)}`);
    }

    const tokens = tokenResponse.data;

    // Validate ID token if present
    let idTokenPayload = null;
    if (tokens.id_token) {
      idTokenPayload = validateIdToken(tokens.id_token, config, stateData.nonce);
    }

    // Fetch userinfo
    let userInfo = {};
    if (tokens.access_token && discovery.userinfo_endpoint) {
      const userInfoResponse = await httpsGet(discovery.userinfo_endpoint, tokens.access_token);
      if (userInfoResponse.status === 200) {
        userInfo = userInfoResponse.data;
      }
    }

    // Merge ID token claims with userinfo
    if (idTokenPayload) {
      userInfo = { ...idTokenPayload, ...userInfo };
    }

    if (!userInfo.email && !userInfo.preferred_username) {
      throw new Error('No email claim in ID token or userinfo response');
    }

    // Provision user and issue JWT
    const user = provisionSsoUser(userInfo, config);
    const jwt = generateToken(user);

    // Audit log
    try {
      auditStore.appendAuditEntry({
        action: 'sso_login_success',
        orgId: config.orgId,
        actor: user.email,
        details: {
          providerId: config.providerId,
          method: 'oidc',
          issuer: config.oidc.issuer,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (auditErr) {
      logger.warn('[SSO] Audit log write failed:', auditErr.message);
    }

    logger.info(`[SSO] OIDC login success: ${user.email} via ${config.providerId}`);

    // Redirect to frontend with token
    const frontendUrl = process.env.DASHBOARD_URL || '/dashboard';
    const redirectUrl = `${frontendUrl}?sso_token=${encodeURIComponent(jwt)}&sso_provider=${encodeURIComponent(config.providerId)}`;
    safeRedirect(res, redirectUrl);
  } catch (err) {
    logger.error('[SSO] OIDC callback failed:', err.message);
    const frontendUrl = process.env.DASHBOARD_URL || '/dashboard';
    safeRedirect(res, `${frontendUrl}?sso_error=${encodeURIComponent('oidc_callback_failed')}&sso_message=${encodeURIComponent(err.message)}`);
  }
}

// ── Route Handler: Initiate SAML Login ──────────────────────────────────────

async function initiateSamlLogin(req, res) {
  const { providerId } = req.query;
  if (!providerId) return res.status(400).json({ error: 'providerId required' });

  const config = ssoConfigStore.getConfigDecrypted(providerId);
  if (!config || !config.enabled || config.method !== 'saml') {
    return res.status(404).json({ error: 'SAML provider not found or disabled' });
  }

  try {
    const state = generateState();
    const appBaseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const acsUrl = `${appBaseUrl}/api/sso/saml/acs`;
    const entityId = config.saml.issuer || process.env.APP_NAME || 'simplebeacon';

    storeState(state, {
      providerId,
      method: 'saml',
      acsUrl,
    });

    // Build SAML AuthnRequest
    const samlRequest = buildSamlAuthnRequest({
      entityId,
      acsUrl,
      providerId: config.providerId,
      issuer: config.saml.entryPoint,
    });

    const relayState = state;
    const entryPoint = config.saml.entryPoint;

    // Redirect to IdP with SAMLRequest and RelayState
    const redirectUrl = `${entryPoint}?SAMLRequest=${encodeURIComponent(Buffer.from(samlRequest).toString('base64'))}&RelayState=${relayState}`;
    logger.info(`[SSO] Initiating SAML login for provider ${providerId}`);
    safeRedirect(res, redirectUrl);
  } catch (err) {
    logger.error('[SSO] SAML initiation failed:', err.message);
    res.status(500).json({ error: 'SAML initiation failed', message: err.message });
  }
}

// ── SAML AuthnRequest Builder ───────────────────────────────────────────────

function buildSamlAuthnRequest({ entityId, acsUrl, providerId, issuer }) {
  const id = '_' + crypto.randomBytes(16).toString('hex');
  const issueInstant = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  ID="${id}"
  Version="2.0"
  IssueInstant="${issueInstant}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
  AssertionConsumerServiceURL="${acsUrl}">
  <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${entityId}</saml:Issuer>
  <samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
    AllowCreate="true"/>
</samlp:AuthnRequest>`;
}

// ── Route Handler: SAML ACS (Assertion Consumer Service) ────────────────────

async function samlAcs(req, res) {
  const { SAMLResponse, RelayState } = req.body || {};

  if (!SAMLResponse) {
    return res.status(400).json({ error: 'Missing SAMLResponse' });
  }

  let stateData = null;
  if (RelayState) {
    stateData = consumeState(RelayState);
  }

  if (!stateData || stateData.method !== 'saml') {
    return res.status(400).json({ error: 'Invalid or expired RelayState' });
  }

  const config = ssoConfigStore.getConfigDecrypted(stateData.providerId);
  if (!config) {
    return res.status(404).json({ error: 'SSO provider configuration not found' });
  }

  try {
    // Decode and parse SAML response
    const samlXml = Buffer.from(SAMLResponse, 'base64').toString('utf8');
    const assertion = parseSamlAssertion(samlXml, config);

    // Provision user and issue JWT
    const user = provisionSsoUser(assertion, config);
    const jwt = generateToken(user);

    // Audit log
    try {
      auditStore.appendAuditEntry({
        action: 'sso_login_success',
        orgId: config.orgId,
        actor: user.email,
        details: {
          providerId: config.providerId,
          method: 'saml',
          entryPoint: config.saml.entryPoint,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (auditErr) {
      logger.warn('[SSO] Audit log write failed:', auditErr.message);
    }

    logger.info(`[SSO] SAML login success: ${user.email} via ${config.providerId}`);

    const frontendUrl = process.env.DASHBOARD_URL || '/dashboard';
    const redirectUrl = `${frontendUrl}?sso_token=${encodeURIComponent(jwt)}&sso_provider=${encodeURIComponent(config.providerId)}`;
    safeRedirect(res, redirectUrl);
  } catch (err) {
    logger.error('[SSO] SAML ACS failed:', err.message);
    const frontendUrl = process.env.DASHBOARD_URL || '/dashboard';
    safeRedirect(res, `${frontendUrl}?sso_error=${encodeURIComponent('saml_acs_failed')}&sso_message=${encodeURIComponent(err.message)}`);
  }
}

// ── SAML Assertion Parser ───────────────────────────────────────────────────

function parseSamlAssertion(xml, config) {
  // Basic SAML response validation
  if (!xml.includes('<samlp:Response') && !xml.includes('<Response')) {
    throw new Error('Invalid SAML response: missing Response element');
  }

  // Check for status success
  if (xml.includes('<samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:')) {
    const statusMatch = xml.match(/StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:([^"]+)"/);
    if (statusMatch && statusMatch[1] !== 'Success') {
      throw new Error(`SAML response status: ${statusMatch[1]}`);
    }
  }

  // Extract NameID (email)
  const nameIdMatch = xml.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/) ||
                      xml.match(/<NameID[^>]*>([^<]+)<\/NameID>/);
  const email = nameIdMatch ? nameIdMatch[1] : null;
  if (!email) throw new Error('No NameID found in SAML assertion');

  // Extract attributes
  const attributes = {};
  const attrRegex = /<saml:Attribute Name="([^"]+)"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/g;
  const attrRegex2 = /<Attribute Name="([^"]+)"[^>]*>\s*<AttributeValue[^>]*>([^<]+)<\/AttributeValue>/g;
  for (const regex of [attrRegex, attrRegex2]) {
    let match;
    while ((match = regex.exec(xml)) !== null) {
      attributes[match[1]] = match[2];
    }
  }

  // Check conditions (NotBefore / NotOnOrAfter)
  const conditionsMatch = xml.match(/<saml:Conditions[^>]*NotBefore="([^"]*)"[^>]*NotOnOrAfter="([^"]*)"/) ||
                          xml.match(/<Conditions[^>]*NotBefore="([^"]*)"[^>]*NotOnOrAfter="([^"]*)"/);
  if (conditionsMatch) {
    const notBefore = new Date(conditionsMatch[1]);
    const notOnOrAfter = new Date(conditionsMatch[2]);
    const now = new Date();
    if (now < notBefore || now >= notOnOrAfter) {
      throw new Error(`SAML assertion outside valid time window: ${conditionsMatch[1]} to ${conditionsMatch[2]}`);
    }
  }

  // Check audience
  const audienceMatch = xml.match(/<saml:Audience[^>]*>([^<]+)<\/saml:Audience>/) ||
                        xml.match(/<Audience[^>]*>([^<]+)<\/Audience>/);
  if (audienceMatch) {
    const expectedAudience = config.saml.issuer || process.env.APP_NAME || 'simplebeacon';
    if (audienceMatch[1] !== expectedAudience) {
      throw new Error(`SAML audience mismatch: ${audienceMatch[1]} != ${expectedAudience}`);
    }
  }

  // Map common SAML attribute names
  return {
    email,
    name: attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
          attributes.name ||
          attributes.cn ||
          email,
    given_name: attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] ||
                attributes.givenname || attributes.firstname || '',
    family_name: attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'] ||
                 attributes.surname || attributes.lastname || '',
    preferred_username: attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
                        attributes.email || email,
  };
}

// ── Route Handler: Resolve SSO by domain ────────────────────────────────────

async function resolveSsoByDomain(req, res) {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email parameter required' });

  const config = ssoConfigStore.resolveConfigByDomain(email);
  if (!config) {
    return res.json({ found: false });
  }

  return res.json({
    found: true,
    providerId: config.providerId,
    method: config.method,
    displayName: config.displayName,
    orgId: config.orgId,
  });
}

// ── Route Handler: SSO metadata ─────────────────────────────────────────────

async function samlMetadata(req, res) {
  const { providerId } = req.query;
  if (!providerId) return res.status(400).json({ error: 'providerId required' });

  const config = ssoConfigStore.getConfig(providerId);
  if (!config || config.method !== 'saml') {
    return res.status(404).json({ error: 'SAML provider not found' });
  }

  const appBaseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const acsUrl = `${appBaseUrl}/api/sso/saml/acs`;
  const entityId = config.saml.issuer || process.env.APP_NAME || 'simplebeacon';

  const metadata = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${entityId}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}"
      index="0"
      isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>`;

  res.set('Content-Type', 'application/xml');
  res.send(metadata);
}

// ── Express Router Setup ────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();

// OIDC routes
router.get('/oidc/login', initiateOidcLogin);
router.get('/oidc/callback', oidcCallback);

// SAML routes
router.get('/saml/login', initiateSamlLogin);
router.post('/saml/acs', express.urlencoded({ extended: false }), samlAcs);
router.get('/saml/metadata', samlMetadata);

// Domain resolution (for login page auto-detection)
router.get('/resolve', resolveSsoByDomain);

module.exports = router;
module.exports.initiateOidcLogin = initiateOidcLogin;
module.exports.oidcCallback = oidcCallback;
module.exports.initiateSamlLogin = initiateSamlLogin;
module.exports.samlAcs = samlAcs;
module.exports.resolveSsoByDomain = resolveSsoByDomain;
module.exports.samlMetadata = samlMetadata;
module.exports.fetchOidcDiscovery = fetchOidcDiscovery;
module.exports.validateIdToken = validateIdToken;
module.exports.parseSamlAssertion = parseSamlAssertion;
module.exports.provisionSsoUser = provisionSsoUser;
