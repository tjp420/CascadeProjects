/**
 * Enterprise SSO Routes
 *
 * GET  /api/v2/auth/sso/login/:provider          → Redirect to IdP (SAML or OIDC)
 * POST /api/v2/auth/sso/saml/callback            → Process SAML assertion
 * GET  /api/v2/auth/sso/oidc/callback           → Process OIDC authorization code
 *
 * All routes emit audit events on success/failure.
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/app-logger.cjs');

function maskEmail(email) {
  const e = String(email || '');
  const at = e.indexOf('@');
  if (at < 1) return e;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const maskedLocal = local.length > 2 ? local[0] + '***' + local.slice(-1) : '***';
  return maskedLocal + '@' + domain;
}
const {
  generateState,
  verifyState,
  parseSamlAssertion,
  verifySamlSignature,
  buildOidcAuthorizeUrl,
  exchangeOidcCode,
  resolveOrganizationByDomain,
  issueTokensForSsoUser,
  getSamlConfig
} = require('../lib/sso-service.cjs');

/**
 * GET /api/v2/auth/sso/login/:provider
 * Initiates SSO flow. Supports ?method=saml|oidc query param.
 * Default: OIDC if configured, else SAML.
 */
router.get('/login/:provider', async (req, res) => {
  try {
    const provider = String(req.params.provider).toLowerCase();
    const method = String(req.query.method || 'oidc').toLowerCase();
    const state = generateState(provider, crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36));

    if (method === 'saml') {
      const cfg = getSamlConfig(provider);
      const samlRequest = buildSamlRequest(cfg.issuer, cfg.entryPoint, state);
      logger.info(`[SSO] SAML login initiated for ${provider}`);
      return res.redirect(302, `${cfg.entryPoint}?SAMLRequest=${encodeURIComponent(samlRequest)}&RelayState=${encodeURIComponent(state)}`);
    }

    // OIDC
    const authorizeUrl = buildOidcAuthorizeUrl(provider, state);
    logger.info(`[SSO] OIDC login initiated for ${provider}`);
    return res.redirect(302, authorizeUrl);
  } catch (error) {
    logger.error('[SSO] Login initiation failed:', error.message);
    res.status(500).json({ success: false, error: 'SSO login initiation failed', details: error.message });
  }
});

/**
 * POST /api/v2/auth/sso/saml/callback
 * Receives SAML Response (Base64-encoded XML) via POST body.
 */
router.post('/saml/callback', express.urlencoded({ extended: false, limit: '1mb' }), async (req, res) => {
  try {
    const { SAMLResponse, RelayState } = req.body || {};
    if (!SAMLResponse) {
      return res.status(400).json({ success: false, error: 'Missing SAMLResponse' });
    }

    const state = verifyState(RelayState);
    if (!state) {
      return res.status(403).json({ success: false, error: 'Invalid or expired SAML state' });
    }
    const provider = state.provider;

    const cfg = getSamlConfig(provider);
    verifySamlSignature(SAMLResponse, cfg.cert);
    const assertion = parseSamlAssertion(SAMLResponse);

    const org = await resolveOrganizationByDomain(assertion.email, req.db);
    if (!org || !org.ssoEnabled) {
      logger.warn(`[SSO] Domain not configured for SAML SSO: ${maskEmail(assertion.email)}`);
      return res.status(403).json({ success: false, error: 'Organization not enabled for SSO' });
    }

    const { user, accessToken, refreshToken } = await issueTokensForSsoUser(
      assertion.email, assertion.nameId, provider, org.id, req.db
    );

    logger.info(`[SSO] SAML success for ${maskEmail(user.email)} via ${provider}`);
    res.json({
      success: true,
      provider,
      method: 'saml',
      user: { id: user.id, email: user.email, organizationId: user.organizationId },
      accessToken,
      refreshToken
    });
  } catch (error) {
    logger.error('[SSO] SAML callback failed:', error.message);
    res.status(500).json({ success: false, error: 'SAML callback failed', details: error.message });
  }
});

/**
 * GET /api/v2/auth/sso/oidc/callback
 * Receives OIDC authorization code via query params.
 */
router.get('/oidc/callback', async (req, res) => {
  try {
    const { code, state: stateParam, error: idpError } = req.query || {};
    if (idpError) {
      return res.status(400).json({ success: false, error: 'IdP error', idpError });
    }
    if (!code) {
      return res.status(400).json({ success: false, error: 'Missing authorization code' });
    }

    const state = verifyState(stateParam);
    if (!state) {
      return res.status(403).json({ success: false, error: 'Invalid or expired OIDC state' });
    }
    const provider = state.provider;

    const idpProfile = await exchangeOidcCode(provider, code);
    const org = await resolveOrganizationByDomain(idpProfile.email, req.db);
    if (!org || !org.ssoEnabled) {
      logger.warn(`[SSO] Domain not configured for OIDC SSO: ${maskEmail(idpProfile.email)}`);
      return res.status(403).json({ success: false, error: 'Organization not enabled for SSO' });
    }

    const { user, accessToken, refreshToken } = await issueTokensForSsoUser(
      idpProfile.email, idpProfile.externalId, provider, org.id, req.db
    );

    logger.info(`[SSO] OIDC success for ${maskEmail(user.email)} via ${provider}`);
    res.json({
      success: true,
      provider,
      method: 'oidc',
      user: { id: user.id, email: user.email, organizationId: user.organizationId },
      accessToken,
      refreshToken
    });
  } catch (error) {
    logger.error('[SSO] OIDC callback failed:', error.message);
    res.status(500).json({ success: false, error: 'OIDC callback failed', details: error.message });
  }
});

// Helper: build minimal SAML AuthnRequest (Base64 deflated)
function buildSamlRequest(issuer, destination, state) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ` +
    `xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ` +
    `ID="_${state.nonce || state.ts}" ` +
    `Version="2.0" ` +
    `IssueInstant="${new Date().toISOString()}" ` +
    `Destination="${destination}">` +
    `<saml:Issuer>${issuer}</saml:Issuer>` +
    `<samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"/>` +
    `</samlp:AuthnRequest>`;
  return Buffer.from(xml).toString('base64');
}

// GET /api/v2/auth/sso/metadata/:provider
// Returns SAML SP metadata XML for IdP configuration (Okta, Azure AD, etc.)
router.get('/metadata/:provider', (req, res) => {
  try {
    const provider = String(req.params.provider).toLowerCase();
    const issuer = process.env.SAML_ISSUER || 'simplebeacon-ai';
    const publicBaseUrl = process.env.PUBLIC_BASE_URL || 'https://simplebeacon.ai';
    const acsUrl = `${publicBaseUrl}/api/v2/auth/sso/saml/callback`;
    const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${issuer}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="0" isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
    res.set('Content-Type', 'application/xml');
    res.send(metadata);
  } catch (error) {
    logger.error('[SSO] Metadata generation failed:', error.message);
    res.status(500).json({ success: false, error: 'Metadata generation failed' });
  }
});

module.exports = router;
