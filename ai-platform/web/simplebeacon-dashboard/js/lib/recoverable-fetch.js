export function logRecoverableDashboardError(contextLabel, error) {
  const message = error instanceof Error ? error.message : String(error);
  console.debug(`[Simplebeacon dashboard] ${contextLabel}: ${message}`);
}

export function hasJsonContentType(response) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  return contentType.includes('application/json');
}

export async function readJsonResponseBody(response, fallback = null) {
  if (!hasJsonContentType(response)) return fallback;
  const parsedBody = await response.json().catch((parseError) => {
    logRecoverableDashboardError('JSON response parse', parseError);
    return fallback;
  });
  return parsedBody == null ? fallback : parsedBody;
}

export async function withRecoverableFallback(contextLabel, asyncOperation, fallbackFactory) {
  try {
    return await asyncOperation();
  } catch (error) {
    logRecoverableDashboardError(contextLabel, error);
    return typeof fallbackFactory === 'function' ? fallbackFactory(error) : fallbackFactory;
  }
}
