import * as crypto from 'crypto';

export interface PkceSession {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  provider: string;
  timestamp: number;
  redirectUri?: string;
}

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes
const sessions = new Map<string, PkceSession>();

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function generateCodeVerifier(): string {
  return base64UrlEncode(crypto.randomBytes(32));
}

export function generateCodeChallenge(verifier: string): string {
  return base64UrlEncode(crypto.createHash('sha256').update(verifier).digest());
}

export function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function createSession(provider: string, redirectUri?: string): PkceSession {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const session: PkceSession = {
    state,
    codeVerifier,
    codeChallenge,
    provider,
    timestamp: Date.now(),
    redirectUri,
  };
  sessions.set(state, session);
  return session;
}

export function getSession(state: string): PkceSession | undefined {
  const session = sessions.get(state);
  if (!session) return undefined;
  if (Date.now() - session.timestamp > SESSION_TTL_MS) {
    sessions.delete(state);
    return undefined;
  }
  return session;
}

export function deleteSession(state: string): void {
  sessions.delete(state);
}

export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [state, session] of sessions) {
    if (now - session.timestamp > SESSION_TTL_MS) {
      sessions.delete(state);
    }
  }
}
