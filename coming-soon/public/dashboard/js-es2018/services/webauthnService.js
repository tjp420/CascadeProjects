import { authService, apiBase } from './authService.js?v=20260720pages3';
import { getBridgeFetch, getExtensionBridgeOrigin, hasExtensionBridgeConfigured } from './localAgentService.js?v=20260716cachefix1';

function defaultRpId() {
  if (typeof location === 'undefined') return 'simplebeacon.ai';
  return location.hostname.replace(/^www\./i, '') || 'simplebeacon.ai';
}

function bufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBuffer(base64url) {
  const base64 = String(base64url || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function serializeCredential(credential) {
  const response = credential.response;
  const payload = {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON)
    }
  };
  if (response.attestationObject) {
    payload.response.attestationObject = bufferToBase64url(response.attestationObject);
  }
  if (response.authenticatorData) {
    payload.response.authenticatorData = bufferToBase64url(response.authenticatorData);
  }
  if (response.signature) {
    payload.response.signature = bufferToBase64url(response.signature);
  }
  if (response.userHandle && response.userHandle.byteLength) {
    payload.response.userHandle = bufferToBase64url(response.userHandle);
  }
  return payload;
}

function resolveWebAuthnUrl(path) {
  const bridge = getExtensionBridgeOrigin();
  const hostedHttps = typeof location !== 'undefined' && location.protocol === 'https:';
  if (bridge && hasExtensionBridgeConfigured() && hostedHttps) {
    return `${bridge}/api${path.replace(/^\/api/, '')}`;
  }
  return `${apiBase()}${path}`;
}

async function webAuthnFetch(path, init = {}) {
  const url = resolveWebAuthnUrl(path);
  const doFetch = getBridgeFetch();
  return doFetch(url, init);
}

async function requestChallenge(purpose, extra = {}) {
  const res = await webAuthnFetch('/api/webauthn/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authService.getAuthHeaders() },
    credentials: 'same-origin',
    body: JSON.stringify({ purpose, ...extra })
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 404) {
    throw new Error('Security keys are not enabled on this server yet. Use email/password sign-in for now.');
  }
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || `Challenge failed (${res.status})`);
  }
  return data;
}

export function isWebAuthnSupported() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
}

export async function registerSecurityKey({ email, label = 'Security key' } = {}) {
  if (!isWebAuthnSupported()) {
    throw new Error('Security keys are not supported in this browser.');
  }
  const challengeData = await requestChallenge('register', {
    email: email || authService.getUser()?.email || undefined
  });
  const userIdSource = authService.getUser()?.id || email || 'simplebeacon-user';
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: base64urlToBuffer(challengeData.challenge),
      rp: {
        name: challengeData.rpName || 'SimpleBeacon',
        id: challengeData.rpId || defaultRpId()
      },
      user: {
        id: base64urlToBuffer(bufferToBase64url(new TextEncoder().encode(userIdSource))),
        name: email || authService.getUser()?.email || 'SimpleBeacon user',
        displayName: email || authService.getUser()?.email || 'SimpleBeacon user'
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 }
      ],
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred'
      },
      timeout: 60000,
      attestation: 'none'
    }
  });
  if (!credential) {
    throw new Error('Security key registration was cancelled.');
  }
  const res = await webAuthnFetch('/api/webauthn/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authService.getAuthHeaders() },
    credentials: 'same-origin',
    body: JSON.stringify({
      challengeId: challengeData.challengeId,
      label,
      credential: serializeCredential(credential)
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || `Registration failed (${res.status})`);
  }
  return data;
}

export async function authenticateWithSecurityKey() {
  if (!isWebAuthnSupported()) {
    throw new Error('Security keys are not supported in this browser.');
  }
  const challengeData = await requestChallenge('authenticate');
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: base64urlToBuffer(challengeData.challenge),
      rpId: challengeData.rpId || defaultRpId(),
      timeout: 60000,
      userVerification: 'preferred'
    }
  });
  if (!assertion) {
    throw new Error('Security key sign-in was cancelled.');
  }
  const res = await webAuthnFetch('/api/webauthn/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      challengeId: challengeData.challengeId,
      credential: serializeCredential(assertion)
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success || !data.token) {
    throw new Error(data.error || data.message || `Security key sign-in failed (${res.status})`);
  }
  return data;
}

export async function listSecurityKeys() {
  const res = await webAuthnFetch('/api/webauthn/credentials', {
    headers: authService.getAuthHeaders(),
    credentials: 'same-origin'
  });
  if (res.status === 401) {
    return [];
  }
  if (res.status === 404) {
    return [];
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || `Failed to load security keys (${res.status})`);
  }
  return Array.isArray(data.credentials) ? data.credentials : [];
}

export async function removeSecurityKey(credentialId) {
  const res = await webAuthnFetch(`/api/webauthn/credentials/${encodeURIComponent(credentialId)}`, {
    method: 'DELETE',
    headers: authService.getAuthHeaders(),
    credentials: 'same-origin'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || `Failed to remove security key (${res.status})`);
  }
  return true;
}
