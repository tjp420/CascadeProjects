/**
 * Marketing-site auth at the edge (audit page sign-in / register).
 * Stores accounts in LICENSE_STORE KV so simplebeacon.ai works without
 * Render Postgres or enabled self-serve registration on the dashboard API.
 */

const PBKDF2_ITERATIONS = 100000;
const SESSION_HOURS = 24;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function userKvKey(email) {
  return `site-user:${normalizeEmail(email)}`;
}

function json(data, status, corsOrigin) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
  if (corsOrigin) {
    headers['Access-Control-Allow-Origin'] = corsOrigin;
    headers.Vary = 'Origin';
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function getSigningSecret(env) {
  return String(env.SIMPLEBEACON_LICENSE_SECRET || env.STRIPE_WEBHOOK_SECRET || env.SIMPLEBEACON_SIGNING_PRIVATE_KEY || '');
}

function b64url(obj) {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  return JSON.parse(atob(padded));
}

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function signJwt(payload, env) {
  const secret = getSigningSecret(env);
  if (!secret) throw new Error('Server misconfigured — no signing secret');
  const enc = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = b64url(header);
  const payloadB64 = b64url(payload);
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signingInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${signingInput}.${sigB64}`;
}

async function verifySignedToken(token, env) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const secret = getSigningSecret(env);
  if (!secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const enc = new TextEncoder();
  const signingInput = `${parts[0]}.${parts[1]}`;
  try {
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const ok = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(signingInput));
    if (!ok) return null;
    const payload = b64urlDecode(parts[1]);
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

async function mintSessionToken(user, env) {
  const now = Math.floor(Date.now() / 1000);
  const tier = user.tier || 'community';
  return signJwt({
    email: user.email,
    tier,
    type: 'session',
    features: tier === 'admin' ? ['all_modules'] : ['gate'],
    clientName: user.name || user.email.split('@')[0],
    projectName: 'Browser-Audit',
    iat: now,
    exp: now + SESSION_HOURS * 60 * 60
  }, env);
}

async function mintLicenseToken(user, env, guestPayload) {
  const now = Math.floor(Date.now() / 1000);
  const tier = user.tier || 'community';
  return signJwt({
    email: user.email,
    tier,
    type: 'license',
    guestId: guestPayload && guestPayload.guestId,
    upgradedFrom: guestPayload ? 'guest' : undefined,
    features: ['gate'],
    clientName: user.name || user.email.split('@')[0],
    projectName: 'Browser-Audit',
    iat: now,
    exp: now + 14 * 24 * 60 * 60
  }, env);
}

async function readUser(env, email) {
  if (!env.LICENSE_STORE) return null;
  try {
    const raw = await env.LICENSE_STORE.get(userKvKey(email));
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

async function writeUser(env, user) {
  if (!env.LICENSE_STORE) throw new Error('Account storage unavailable');
  await env.LICENSE_STORE.put(userKvKey(user.email), JSON.stringify(user));
}

function buildAuthResponse(user, sessionToken, licenseToken, options) {
  const opts = options || {};
  return {
    success: true,
    token: sessionToken,
    licenseToken: licenseToken || undefined,
    guestTokenClaimed: !!opts.guestTokenClaimed,
    user: {
      email: user.email,
      name: user.name || user.email.split('@')[0],
      tier: user.tier || 'community'
    },
    email: user.email,
    tier: user.tier || 'community',
    expiresInHours: SESSION_HOURS,
    message: opts.message || 'Login successful'
  };
}

export async function handleSiteAuthRegister(request, env, corsOrigin) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': corsOrigin || '',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }
  if (!env.LICENSE_STORE) {
    return json({ error: 'registration_unavailable', message: 'Account storage is not configured.' }, 503, corsOrigin);
  }
  let body = {};
  try { body = await request.json(); } catch (_) {
    return json({ error: 'invalid_json', message: 'Invalid JSON body' }, 400, corsOrigin);
  }
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const guestToken = typeof body.guestToken === 'string' ? body.guestToken.trim() : '';
  if (!email || !email.includes('@')) {
    return json({ error: 'invalid_email', message: 'Enter a valid email address.' }, 400, corsOrigin);
  }
  if (!password || password.length < 8) {
    return json({ error: 'weak_password', message: 'Password must be at least 8 characters.' }, 400, corsOrigin);
  }
  const existing = await readUser(env, email);
  if (existing) {
    return json({ error: 'Email already registered', message: 'An account with this email already exists. Sign in instead.' }, 409, corsOrigin);
  }
  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  const user = {
    email,
    name: email.split('@')[0],
    tier: 'community',
    salt,
    passwordHash,
    createdAt: new Date().toISOString()
  };
  await writeUser(env, user);
  let licenseToken = null;
  let guestTokenClaimed = false;
  if (guestToken) {
    const guestPayload = await verifySignedToken(guestToken, env);
    if (guestPayload && (guestPayload.tier === 'guest' || guestPayload.guestId)) {
      licenseToken = await mintLicenseToken(user, env, guestPayload);
      guestTokenClaimed = true;
    }
  }
  const sessionToken = await mintSessionToken(user, env);
  return json(buildAuthResponse(user, sessionToken, licenseToken, {
    guestTokenClaimed,
    message: guestTokenClaimed
      ? 'Account created — your guest pass is now your personal license token.'
      : 'Account created successfully'
  }), 201, corsOrigin);
}

/**
 * @returns {Promise<Response|null>} Response when handled at edge; null → proxy to Render for dashboard accounts.
 */
export async function handleSiteAuthLogin(request, env, corsOrigin) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': corsOrigin || '',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }
  let body = {};
  try { body = await request.json(); } catch (_) {
    return json({ error: 'invalid_json', message: 'Invalid JSON body' }, 400, corsOrigin);
  }
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const guestToken = typeof body.guestToken === 'string' ? body.guestToken.trim() : '';
  if (!email || !password) {
    return json({ error: 'missing_fields', message: 'Email and password required' }, 400, corsOrigin);
  }
  const stored = await readUser(env, email);
  if (!stored) {
    return null;
  }
  const passwordHash = await hashPassword(password, stored.salt);
  if (passwordHash !== stored.passwordHash) {
    return json({ error: 'Authentication failed', message: 'Invalid email or password' }, 401, corsOrigin);
  }
  let licenseToken = null;
  let guestTokenClaimed = false;
  if (guestToken) {
    const guestPayload = await verifySignedToken(guestToken, env);
    if (guestPayload && (guestPayload.tier === 'guest' || guestPayload.guestId)) {
      licenseToken = await mintLicenseToken(stored, env, guestPayload);
      guestTokenClaimed = true;
    }
  }
  const sessionToken = await mintSessionToken(stored, env);
  return json(buildAuthResponse(stored, sessionToken, licenseToken, {
    guestTokenClaimed,
    message: guestTokenClaimed
      ? 'Signed in — your guest pass is now linked to this account.'
      : 'Login successful'
  }), 200, corsOrigin);
}

export {
  normalizeEmail,
  hashPassword,
  randomSalt,
  verifySignedToken,
  mintSessionToken,
  readUser,
  writeUser,
  userKvKey
};
