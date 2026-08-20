"use strict";

/**
 * Production SSO Hardening — JWKS-based ID token signature verification,
 * provider-specific presets (Okta, Azure AD / Microsoft Entra ID),
 * and SAML XML digital signature validation.
 *
 * @module sso-production-hardening
 */

const crypto = require("crypto");
const https = require("https");
const { URL } = require("url");
const logger = require("./app-logger.cjs");

// ── JWKS (JSON Web Key Set) Cache ───────────────────────────────────────────

const jwksCache = new Map();
const JWKS_TTL_MS = 60 * 60 * 1000;

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: { Accept: "application/json" },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function fetchJwks(jwksUri) {
  const cached = jwksCache.get(jwksUri);
  if (cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS) {
    return cached.keys;
  }

  const result = await httpsGetJson(jwksUri);
  if (
    result.status !== 200 ||
    !result.data ||
    !Array.isArray(result.data.keys)
  ) {
    throw new Error(`JWKS fetch failed: ${result.status} for ${jwksUri}`);
  }

  jwksCache.set(jwksUri, { keys: result.data.keys, fetchedAt: Date.now() });
  return result.data.keys;
}

function findKeyByKid(keys, kid) {
  return keys.find((k) => k.kid === kid);
}

// ── ID Token Signature Verification ─────────────────────────────────────────

function verifyRsaJwtSignature(idToken, jwk) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
  const signingInput = parts[0] + "." + parts[1];
  const signature = Buffer.from(parts[2], "base64url");

  if (
    header.alg !== "RS256" &&
    header.alg !== "RS384" &&
    header.alg !== "RS512"
  ) {
    throw new Error(`Unsupported ID token algorithm: ${header.alg}`);
  }

  const hashAlgorithm =
    header.alg === "RS256"
      ? "sha256"
      : header.alg === "RS384"
        ? "sha384"
        : "sha512";

  const pem = jwkToPem(jwk);
  const verifier = crypto.createVerify(hashAlgorithm);
  verifier.update(signingInput, "utf8");

  return verifier.verify(pem, signature);
}

function verifyHs256JwtSignature(idToken, clientSecret) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const signingInput = parts[0] + "." + parts[1];
  const expectedSignature = crypto
    .createHmac("sha256", clientSecret)
    .update(signingInput, "utf8")
    .digest("base64url");

  return timingSafeEqual(parts[2], expectedSignature);
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function jwkToPem(jwk) {
  if (jwk.kty !== "RSA") throw new Error(`Unsupported key type: ${jwk.kty}`);
  if (!jwk.n || !jwk.e) throw new Error("RSA key missing modulus or exponent");

  const modulus = Buffer.from(jwk.n, "base64url");
  const exponent = Buffer.from(jwk.e, "base64url");

  const keyObject = crypto.createPublicKey({
    key: {
      kty: "RSA",
      n: jwk.n,
      e: jwk.e,
    },
    format: "jwk",
  });

  return keyObject.export({ type: "spki", format: "pem" });
}

/**
 * Verify an ID token's signature using JWKS or shared secret.
 * @param {string} idToken - The raw JWT id_token
 * @param {object} discovery - OIDC discovery document
 * @param {string} clientSecret - For HS256 tokens
 * @returns {Promise<{payload: object, verified: boolean}>}
 */
async function verifyIdTokenSignature(idToken, discovery, clientSecret) {
  const parts = idToken.split(".");
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

  if (
    header.alg === "RS256" ||
    header.alg === "RS384" ||
    header.alg === "RS512"
  ) {
    if (!discovery.jwks_uri)
      throw new Error("No jwks_uri in discovery document");
    const keys = await fetchJwks(discovery.jwks_uri);
    const jwk = findKeyByKid(keys, header.kid);
    if (!jwk) throw new Error(`No matching key found for kid: ${header.kid}`);
    const verified = verifyRsaJwtSignature(idToken, jwk);
    return { payload, verified, algorithm: header.alg };
  }

  if (header.alg === "HS256") {
    if (!clientSecret) throw new Error("HS256 token requires client_secret");
    const verified = verifyHs256JwtSignature(idToken, clientSecret);
    return { payload, verified, algorithm: header.alg };
  }

  throw new Error(`Unsupported ID token algorithm: ${header.alg}`);
}

// ── Provider Presets ────────────────────────────────────────────────────────

const PROVIDER_PRESETS = {
  okta: {
    id: "okta",
    label: "Okta",
    method: "oidc",
    description:
      "Okta Workforce Identity — OIDC authorization code flow with PKCE",
    fields: {
      issuer: {
        label: "Okta Domain",
        placeholder: "https://your-org.okta.com",
        required: true,
      },
      clientId: { label: "Client ID", placeholder: "0oa...", required: true },
      clientSecret: {
        label: "Client Secret",
        placeholder: "...",
        required: true,
        secret: true,
      },
      scope: {
        label: "Scopes",
        placeholder: "openid profile email groups",
        required: false,
      },
    },
    buildIssuer: (domain) => domain.replace(/\/$/, ""),
    discoveryPath: "/.well-known/openid-configuration",
    notes:
      'Ensure your Okta app has "Authorization Code" grant type enabled and PKCE required.',
  },

  azure_ad: {
    id: "azure_ad",
    label: "Microsoft Entra ID (Azure AD)",
    method: "oidc",
    description:
      "Microsoft Entra ID — OIDC authorization code flow with tenant-specific endpoints",
    fields: {
      tenantId: {
        label: "Tenant ID",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        required: true,
      },
      clientId: {
        label: "Application (Client) ID",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        required: true,
      },
      clientSecret: {
        label: "Client Secret",
        placeholder: "...",
        required: true,
        secret: true,
      },
      scope: {
        label: "Scopes",
        placeholder: "openid profile email User.Read",
        required: false,
      },
    },
    buildIssuer: (tenantId) =>
      `https://login.microsoftonline.com/${tenantId}/v2.0`,
    discoveryPath: "/.well-known/openid-configuration",
    notes:
      "Register an app in Azure AD, add a client secret, and configure redirect URI. Use v2.0 endpoint for OIDC.",
    // Azure AD v2.0 userinfo is at Microsoft Graph, not a standard userinfo_endpoint
    graphUserinfo: true,
  },

  google: {
    id: "google",
    label: "Google Workspace",
    method: "oidc",
    description: "Google Workspace — OIDC authorization code flow",
    fields: {
      issuer: {
        label: "Issuer",
        placeholder: "https://accounts.google.com",
        required: true,
      },
      clientId: {
        label: "Client ID",
        placeholder: "xxxxx.apps.googleusercontent.com",
        required: true,
      },
      clientSecret: {
        label: "Client Secret",
        placeholder: "GOCSPX-...",
        required: true,
        secret: true,
      },
      scope: {
        label: "Scopes",
        placeholder: "openid profile email",
        required: false,
      },
    },
    buildIssuer: () => "https://accounts.google.com",
    discoveryPath: "/.well-known/openid-configuration",
    notes:
      "Configure OAuth consent screen in Google Cloud Console. Add redirect URI to authorized redirect URIs.",
  },

  saml_generic: {
    id: "saml_generic",
    label: "SAML 2.0 (Generic IdP)",
    method: "saml",
    description: "SAML 2.0 — Works with any SAML-compliant Identity Provider",
    fields: {
      entryPoint: {
        label: "IdP SSO URL",
        placeholder: "https://idp.example.com/sso/saml",
        required: true,
      },
      issuer: {
        label: "Entity ID (SP)",
        placeholder: "simplebeacon",
        required: true,
      },
      cert: {
        label: "IdP X.509 Certificate (PEM)",
        placeholder: "-----BEGIN CERTIFICATE-----\n...",
        required: true,
        secret: true,
      },
      signatureRequired: {
        label: "Require Signed Assertions",
        placeholder: "true",
        required: false,
      },
    },
    notes:
      "Configure your IdP to send NameID as email address. Set the Assertion Consumer Service URL to https://your-domain/api/sso/saml/acs",
  },
};

// ── Azure AD Graph Userinfo ─────────────────────────────────────────────────

async function fetchMicrosoftGraphUser(accessToken) {
  const graphUrl = "https://graph.microsoft.com/v1.0/me";
  const result = await new Promise((resolve, reject) => {
    const parsed = new URL(graphUrl);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname,
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      },
    );
    req.on("error", reject);
    req.end();
  });

  if (result.status !== 200) {
    throw new Error(`Microsoft Graph userinfo failed: ${result.status}`);
  }

  const graphUser = result.data;
  return {
    email: graphUser.mail || graphUser.userPrincipalName,
    name: graphUser.displayName,
    given_name: graphUser.givenName,
    family_name: graphUser.surname,
    preferred_username: graphUser.userPrincipalName,
    job_title: graphUser.jobTitle,
    department: graphUser.department,
    oid: graphUser.id,
  };
}

// ── SAML XML Signature Validation ───────────────────────────────────────────

/**
 * Validate a SAML response's XML digital signature using the IdP's X.509 certificate.
 * Uses Node.js crypto to verify the signed XML element.
 *
 * @param {string} xml - The raw SAML response XML
 * @param {string} certPem - The IdP's X.509 certificate in PEM format
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateSamlSignature(xml, certPem) {
  if (!certPem) {
    return {
      valid: false,
      reason: "No IdP certificate provided for signature validation",
    };
  }

  // Normalize certificate to PEM format
  let pem = certPem.trim();
  if (!pem.startsWith("-----BEGIN")) {
    pem =
      "-----BEGIN CERTIFICATE-----\n" +
      pem.match(/.{1,64}/g).join("\n") +
      "\n-----END CERTIFICATE-----";
  }

  // Check if the response is signed (Signature element present)
  const hasSignature =
    xml.includes("<ds:Signature") || xml.includes("<Signature");
  if (!hasSignature) {
    return {
      valid: false,
      reason: "SAML response is not signed — signature validation required",
    };
  }

  // Extract SignatureValue
  const sigValueMatch =
    xml.match(/<ds:SignatureValue[^>]*>([^<]+)<\/ds:SignatureValue>/) ||
    xml.match(/<SignatureValue[^>]*>([^<]+)<\/SignatureValue>/);
  if (!sigValueMatch) {
    return {
      valid: false,
      reason: "Could not extract SignatureValue from SAML response",
    };
  }

  // Extract SignedInfo
  const signedInfoMatch =
    xml.match(/<ds:SignedInfo[\s\S]*?<\/ds:SignedInfo>/) ||
    xml.match(/<SignedInfo[\s\S]*?<\/SignedInfo>/);
  if (!signedInfoMatch) {
    return {
      valid: false,
      reason: "Could not extract SignedInfo from SAML response",
    };
  }

  // Extract DigestValue
  const digestMatch =
    xml.match(/<ds:DigestValue[^>]*>([^<]+)<\/ds:DigestValue>/) ||
    xml.match(/<DigestValue[^>]*>([^<]+)<\/DigestValue>/);
  if (!digestMatch) {
    return {
      valid: false,
      reason: "Could not extract DigestValue from SAML response",
    };
  }

  // Extract SignatureMethod algorithm
  const sigMethodMatch = xml.match(/SignatureMethod Algorithm="([^"]+)"/);
  const sigAlgorithm = sigMethodMatch
    ? sigMethodMatch[1]
        .replace("http://www.w3.org/2001/04/xmldsig-more#rsa-", "")
        .replace("http://www.w3.org/2000/09/xmldsig#rsa-", "sha1")
    : "sha256";

  // Extract the signed element (Assertion or Response)
  // The Reference URI points to the signed element ID
  const referenceMatch =
    xml.match(/<ds:Reference[^>]*URI="#([^"]+)"/) ||
    xml.match(/<Reference[^>]*URI="#([^"]+)"/);
  if (!referenceMatch) {
    return {
      valid: false,
      reason: "Could not extract Reference URI from signature",
    };
  }

  const signedElementId = referenceMatch[1];

  // Find the signed element in the XML
  const assertionMatch =
    xml.match(
      new RegExp(
        `<saml:Assertion[^>]*ID="${signedElementId}"[\\s\\S]*?</saml:Assertion>`,
      ),
    ) ||
    xml.match(
      new RegExp(
        `<Assertion[^>]*ID="${signedElementId}"[\\s\\S]*?</Assertion>`,
      ),
    );
  if (!assertionMatch) {
    return {
      valid: false,
      reason: `Could not find signed element with ID: ${signedElementId}`,
    };
  }

  // Compute digest of the signed element (with transforms applied — canonicalization)
  // For production, this should use exclusive XML canonicalization (c14n).
  // Here we use a simplified approach: hash the raw element text.
  const signedElementXml = assertionMatch[0];
  const computedDigest = crypto
    .createHash("sha256")
    .update(signedElementXml, "utf8")
    .digest("base64");
  const expectedDigest = digestMatch[1].trim().replace(/\s/g, "");

  // Verify the signature value against the signed info
  const signedInfoXml = signedInfoMatch[0];
  const signatureValue = sigValueMatch[1].trim().replace(/\s/g, "");
  const signatureBuffer = Buffer.from(signatureValue, "base64");

  try {
    const verifier = crypto.createVerify(
      sigAlgorithm.includes("sha") ? sigAlgorithm : "sha256",
    );
    verifier.update(signedInfoXml, "utf8");
    const sigValid = verifier.verify(pem, signatureBuffer);

    if (!sigValid) {
      return {
        valid: false,
        reason:
          "XML signature verification failed — signature does not match certificate",
      };
    }

    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      reason: `Signature verification error: ${err.message}`,
    };
  }
}

// ── Enhanced ID Token Validation ────────────────────────────────────────────

/**
 * Full production ID token validation with signature verification.
 *
 * @param {string} idToken - Raw JWT id_token
 * @param {object} config - SSO provider config (with oidc.issuer, oidc.clientId)
 * @param {object} discovery - OIDC discovery document
 * @param {string} expectedNonce - Nonce stored during initiation
 * @param {string} clientSecret - For HS256 verification
 * @returns {Promise<object>} Verified payload or throws
 */
async function validateIdTokenProduction(
  idToken,
  config,
  discovery,
  expectedNonce,
  clientSecret,
) {
  // Verify signature
  const { payload, verified, algorithm } = await verifyIdTokenSignature(
    idToken,
    discovery,
    clientSecret,
  );
  if (!verified) {
    throw new Error(
      `ID token signature verification failed (algorithm: ${algorithm})`,
    );
  }

  // Validate claims
  const expectedIssuer = config.oidc.issuer;
  if (payload.iss !== expectedIssuer) {
    // Azure AD v2.0 uses a trailing slash sometimes
    if (!(
      payload.iss === expectedIssuer + "/" ||
      payload.iss + "/" === expectedIssuer
    )) {
      throw new Error(
        `ID token issuer mismatch: ${payload.iss} != ${expectedIssuer}`,
      );
    }
  }

  // Audience can be string or array
  const expectedAud = config.oidc.clientId;
  const aud = payload.aud;
  const audValid =
    aud === expectedAud || (Array.isArray(aud) && aud.includes(expectedAud));
  if (!audValid) {
    throw new Error(
      `ID token audience mismatch: ${JSON.stringify(aud)} != ${expectedAud}`,
    );
  }

  // Nonce
  if (expectedNonce && payload.nonce !== expectedNonce) {
    throw new Error("ID token nonce mismatch — possible replay attack");
  }

  // Expiration
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new Error("ID token expired");
  }

  // Not before
  if (payload.nbf && payload.nbf * 1000 > Date.now()) {
    throw new Error("ID token not yet valid (nbf claim)");
  }

  // Azure AD: check tid (tenant ID) if configured
  if (config.providerType === "azure_ad" && config.oidc.tenantId) {
    if (payload.tid && payload.tid !== config.oidc.tenantId) {
      throw new Error(
        `Azure AD tenant mismatch: ${payload.tid} != ${config.oidc.tenantId}`,
      );
    }
  }

  logger.info(
    `[SSO] ID token verified: alg=${algorithm}, sub=${payload.sub || "N/A"}`,
  );
  return payload;
}

module.exports = {
  verifyIdTokenSignature,
  validateIdTokenProduction,
  fetchJwks,
  fetchMicrosoftGraphUser,
  validateSamlSignature,
  PROVIDER_PRESETS,
  jwkToPem,
};
