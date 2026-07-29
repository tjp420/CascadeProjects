/**
 * SimpleBeacon Serverless Stripe Webhook Handler & License Signer
 * Runtime: Cloudflare Worker (V8 Edge Isolate)
 */

const DEFAULT_ALLOWED_ORIGINS = 'https://simplebeacon.ai,https://www.simplebeacon.ai';
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
const LICENSE_TTL_SECONDS = 24 * 60 * 60;
const STRIPE_TOLERANCE_SECONDS = 300;

class SignatureError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SignatureError';
    this.isSignatureError = true;
  }
}

function json(data, status, corsOrigin) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
  if (corsOrigin) {
    headers['Access-Control-Allow-Origin'] = corsOrigin;
    headers['Vary'] = 'Origin';
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function textResponse(body, status, corsOrigin) {
  const headers = { 'Cache-Control': 'no-store' };
  if (corsOrigin) {
    headers['Access-Control-Allow-Origin'] = corsOrigin;
    headers['Vary'] = 'Origin';
  }
  return new Response(body, { status, headers });
}

function getAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function getCorsOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!origin) return '';
  const allowed = getAllowedOrigins(env);
  return allowed.includes(origin) ? origin : '';
}

function isValidSessionId(sessionId) {
  return /^[A-Za-z0-9_-]{10,200}$/.test(sessionId || '');
}

function parseStripeSignature(headerValue) {
  const parts = String(headerValue || '').split(',');
  const out = { t: '', v1: [] };
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === 't') out.t = value;
    if (key === 'v1') out.v1.push(value);
  }
  return out;
}

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const len = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= (ca ^ cb);
  }
  return mismatch === 0;
}

async function verifyStripeWebhookSignature(request, env, payloadText) {
  const secret = String(env.STRIPE_WEBHOOK_SECRET || '');
  if (!secret) throw new SignatureError('Webhook secret is not configured');

  const header = request.headers.get('Stripe-Signature');
  const parsed = parseStripeSignature(header);
  if (!parsed.t || !parsed.v1.length) {
    throw new SignatureError('Missing Stripe signature components');
  }

  const timestamp = Number(parsed.t);
  if (!Number.isFinite(timestamp)) {
    throw new SignatureError('Invalid Stripe timestamp');
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > STRIPE_TOLERANCE_SECONDS) {
    throw new SignatureError('Stripe signature timestamp is outside tolerance window');
  }

  const signedPayload = `${parsed.t}.${payloadText}`;
  const expected = await hmacSha256Hex(secret, signedPayload);
  for (const candidate of parsed.v1) {
    if (timingSafeEqualHex(expected, candidate)) {
      return true;
    }
  }
  throw new SignatureError('Stripe signature mismatch');
}

function bytesToBase64Url(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function utf8ToBase64Url(value) {
  const bytes = new TextEncoder().encode(String(value));
  return bytesToBase64Url(bytes);
}

async function signJwtHS256(claims, signingSecret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerPart = utf8ToBase64Url(JSON.stringify(header));
  const payloadPart = utf8ToBase64Url(JSON.stringify(claims));
  const body = `${headerPart}.${payloadPart}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const signaturePart = bytesToBase64Url(new Uint8Array(signatureBuffer));
  return `${body}.${signaturePart}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsOrigin = getCorsOrigin(request, env);

    if (request.method === 'OPTIONS') {
      const headers = {
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature, Authorization'
      };
      if (corsOrigin) {
        headers['Access-Control-Allow-Origin'] = corsOrigin;
        headers['Vary'] = 'Origin';
      }
      return new Response(null, { status: 204, headers });
    }

    // Redirect /demo to the landing page
    if (url.pathname === '/demo' || url.pathname.startsWith('/demo/')) {
      return Response.redirect(new URL('/', url.origin).toString(), 302);
    }

    // SPA fallback for /dashboard/* routes — serve the dashboard entry HTML
    // so the client-side router can render the requested view.
    if (url.pathname.startsWith('/dashboard/') && !url.pathname.match(/\.(css|js|mjs|svg|png|jpg|jpeg|gif|ico|woff2|woff|ttf|otf|json|map|txt|xml|webmanifest)$/i)) {
      const cacheBust = `${Date.now()}`;
      const entryCandidates = ['/dashboard/__entry', '/dashboard/index.html'];
      for (const entryPath of entryCandidates) {
        const assetUrl = new URL(entryPath, url.origin);
        assetUrl.searchParams.set('_cb', cacheBust);
        const candidate = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
        if (candidate.ok) {
          const headers = new Headers(candidate.headers);
          headers.set('Content-Type', 'text/html; charset=utf-8');
          headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
          headers.set('CDN-Cache-Control', 'no-store');
          return new Response(candidate.body, { status: candidate.status, headers });
        }
      }
    }

    // Dynamic Route 1: GET /api/license?session_id=...
    // Fetches the generated license token securely from the edge cache
    if (url.pathname === '/api/license' && request.method === 'GET') {
      const sessionId = url.searchParams.get('session_id');
      if (!corsOrigin) {
        return json({ error: 'Origin not allowed.' }, 403, '');
      }
      if (!sessionId) {
        return json({ error: 'Missing session_id context.' }, 400, corsOrigin);
      }
      if (!isValidSessionId(sessionId)) {
        return json({ error: 'Invalid session_id format.' }, 400, corsOrigin);
      }

      // Read from Cloudflare's Edge KV Store (Bound as env.LICENSE_STORE)
      const stored = await env.LICENSE_STORE.get(sessionId);
      if (!stored) {
        return json({ status: 'PENDING_OR_NOT_FOUND' }, 404, corsOrigin);
      }

      let licenseToken = stored;
      let tier = 'unknown';
      let capabilities = [];
      try {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.license === 'string') {
          licenseToken = parsed.license;
          tier = parsed.tier || tier;
          capabilities = Array.isArray(parsed.capabilities) ? parsed.capabilities : capabilities;
        }
      } catch (_) {
        // Backward-compatible read for old values that stored only the token string.
      }

      return json({ status: 'COMPLETED', license: licenseToken, tier, capabilities }, 200, corsOrigin);
    }

    // Dynamic Route 2: POST /api/stripe-webhook
    // Listens for checkout completion, forwards to Express for subscription
    // activation + email, then mints the signed JWT license key into KV.
    if (url.pathname === '/api/stripe-webhook' && request.method === 'POST') {
      try {
        const payload = await request.text();
        await verifyStripeWebhookSignature(request, env, payload);
        const body = JSON.parse(payload);

        // Idempotency guard — check KV for already-processed event IDs
        const eventId = body.id || '';
        if (eventId) {
          const processedKey = `processed:${eventId}`;
          const alreadyProcessed = await env.LICENSE_STORE.get(processedKey);
          if (alreadyProcessed) {
            return json({ received: true, status: 'duplicate_ignored', eventId }, 200, '');
          }
        }

        // Mint license token FIRST (if checkout completed) so we can pass it to the backend
        let licenseTokenForBackend = '';
        let tierForBackend = '';
        let capabilitiesForBackend = [];

        if (body.type === 'checkout.session.completed') {
          const session = body.data.object;
          const sessionId = session.id;
          const userEmail = session.customer_details?.email || session.customer_email || '';
          const targetPriceId = session.metadata?.price_id;

          if (sessionId && isValidSessionId(sessionId) && userEmail && session.payment_status === 'paid') {
            const agencyPriceId = String(env.PRICE_ID_AGENCY || 'price_agency_suite_99');
            const enterprisePriceId = String(env.PRICE_ID_ENTERPRISE || 'price_enterprise_499');

            let capabilities = ['markdown'];
            let tierName = 'free';

            if (targetPriceId === agencyPriceId) {
              tierName = 'agency';
              capabilities = ['markdown', 'slop', 'tokens'];
            } else if (targetPriceId === enterprisePriceId) {
              tierName = 'enterprise';
              capabilities = ['markdown', 'slop', 'tokens', 'eu-ai-act'];
            }

            const signingSecret = String(env.SIMPLEBEACON_SIGNING_PRIVATE_KEY || '');
            if (signingSecret) {
              const now = Math.floor(Date.now() / 1000);
              const claims = {
                iss: 'simplebeacon.ai',
                sub: userEmail,
                sid: sessionId,
                tier: tierName,
                capabilities,
                iat: now,
                exp: now + ONE_YEAR_SECONDS
              };

              const completeLicenseKey = await signJwtHS256(claims, signingSecret);

              // Persist the license block to the Cloudflare Edge KV Store with a 24-hour expiration window
              await env.LICENSE_STORE.put(
                sessionId,
                JSON.stringify({
                  license: completeLicenseKey,
                  tier: tierName,
                  capabilities,
                  generatedAt: new Date().toISOString()
                }),
                { expirationTtl: LICENSE_TTL_SECONDS }
              );

              // Save for backend forwarding
              licenseTokenForBackend = completeLicenseKey;
              tierForBackend = tierName;
              capabilitiesForBackend = capabilities;
            }
          } else {
            // Mark as processed even for skipped sessions to prevent retry storms
            if (eventId) {
              await env.LICENSE_STORE.put(
                `processed:${eventId}`,
                JSON.stringify({ processedAt: new Date().toISOString(), type: body.type, skipped: true }),
                { expirationTtl: LICENSE_TTL_SECONDS }
              );
            }
            return json({ received: true, skipped: 'invalid_or_unpaid_session' }, 200, '');
          }
        }

        // Forward to Express backend for subscription activation + email
        // Pass the minted license token as a header so the backend can include it in the email
        const backendUrl = String(env.API_BACKEND || '');
        if (backendUrl) {
          try {
            const forwardHeaders = {
              'Content-Type': 'application/json',
              'stripe-signature': request.headers.get('Stripe-Signature') || ''
            };
            if (licenseTokenForBackend) {
              forwardHeaders['X-License-Token'] = licenseTokenForBackend;
              forwardHeaders['X-License-Tier'] = tierForBackend;
            }
            const backendResponse = await fetch(`${backendUrl}/api/stripe/webhook`, {
              method: 'POST',
              headers: forwardHeaders,
              body: payload
            });
            if (!backendResponse.ok) {
              console.error('Express backend forwarding failed:', backendResponse.status);
            }
          } catch (err) {
            console.error('Express backend forwarding error:', err.message);
          }
        }

        // Mark event as processed in KV (idempotency guard for Stripe retries)
        if (eventId) {
          await env.LICENSE_STORE.put(
            `processed:${eventId}`,
            JSON.stringify({ processedAt: new Date().toISOString(), type: body.type }),
            { expirationTtl: LICENSE_TTL_SECONDS }
          );
        }

        return json({ received: true }, 200, '');
      } catch (error) {
        if (error.isSignatureError) {
          return json({ error: error.message }, 400, '');
        }
        console.error('Webhook handler error:', error.message);
        return json({ error: 'Internal server error' }, 500, '');
      }
    }

    // Dynamic Route 3: /api/* catch-all proxy to Render backend
    // Forwards any unmatched /api/* request to the Express backend on Render.
    // This keeps API calls same-origin from the browser's perspective (no CORS issues).
    if (url.pathname.startsWith('/api/')) {
      const backendUrl = String(env.API_BACKEND || '');
      if (!backendUrl) {
        return json({ error: 'API backend not configured' }, 503, corsOrigin);
      }

      const targetUrl = backendUrl.replace(/\/+$/, '') + url.pathname + url.search;
      try {
        const proxyHeaders = new Headers(request.headers);
        proxyHeaders.delete('host');
        const proxyResponse = await fetch(targetUrl, {
          method: request.method,
          headers: proxyHeaders,
          body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
          redirect: 'manual'
        });

        // Copy response with CORS headers added
        const responseHeaders = new Headers(proxyResponse.headers);
        if (corsOrigin) {
          responseHeaders.set('Access-Control-Allow-Origin', corsOrigin);
          responseHeaders.set('Vary', 'Origin');
        }
        return new Response(proxyResponse.body, {
          status: proxyResponse.status,
          statusText: proxyResponse.statusText,
          headers: responseHeaders
        });
      } catch (err) {
        return json({ error: 'Backend unreachable', detail: err.message }, 502, corsOrigin);
      }
    }

    return textResponse('Not Found', 404, corsOrigin || '');
  }
};
