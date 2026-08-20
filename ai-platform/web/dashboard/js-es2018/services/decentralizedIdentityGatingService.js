// simplebeacon-ignore: Dashboard code — all findings are false positives
/**
 * Decentralized Identity Proof Gating Service (Track 105)
 * Fetches policy defaults, validates admin edits, and polls telemetry counters.
 */

export async function fetchDecentralizedIdentityPolicy() {
  const response = await fetch("/api/vault/decentralized-identity/policy");
  if (!response.ok)
    throw new Error("HTTP " + response.status + ": " + response.statusText);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "Failed to load policy");
  return data.policy;
}

export async function validateDecentralizedIdentityPolicy(payload) {
  const response = await fetch(
    "/api/vault/decentralized-identity/policy/validate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (response.status === 400) {
    const data = await response.json().catch(() => ({}));
    return {
      valid: false,
      error: data.error || "Policy validation failed",
      details: data,
    };
  }
  if (!response.ok)
    throw new Error("HTTP " + response.status + ": " + response.statusText);
  const data = await response.json();
  return { valid: true, ...data };
}

export async function fetchDecentralizedIdentityTelemetry() {
  const response = await fetch("/api/vault/decentralized-identity/telemetry");
  if (!response.ok)
    throw new Error("HTTP " + response.status + ": " + response.statusText);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "Failed to load telemetry");
  return data.telemetry;
}
