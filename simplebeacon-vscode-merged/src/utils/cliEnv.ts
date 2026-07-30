/**
 * Resolve environment variables for spawning the SimpleBeacon CLI from the IDE.
 * Preserves full policy-gate configuration when present; otherwise disables the
 * gate so local scans work without manual env setup.
 */
export function resolveCliSpawnEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: '0' };

  const hasTrustFingerprint = Boolean(
    env.SIMPLEBEACON_POLICY_TRUST_FINGERPRINT?.trim()
  );
  const hasPublicKey = Boolean(env.SIMPLEBEACON_POLICY_PUBLIC_KEY?.trim());
  const hasPublicKeyPath = Boolean(env.SIMPLEBEACON_POLICY_PUBLIC_KEY_PATH?.trim());
  const policyConfigured = hasTrustFingerprint && (hasPublicKey || hasPublicKeyPath);

  if (!policyConfigured && env.SIMPLEBEACON_DISABLE_POLICY_GATE !== 'true') {
    env.SIMPLEBEACON_DISABLE_POLICY_GATE = 'true';
  }

  return env;
}
