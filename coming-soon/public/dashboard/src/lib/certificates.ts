export type CertificateResponse = {
  id: string;
  downloadUrl: string;
  expiresAt: number;
};

export async function requestCertificate(sessionId?: string): Promise<CertificateResponse> {
  const res = await fetch('/api/certificates/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const json = await res.json();
  return json;
}

export async function downloadCertificate(downloadUrl: string): Promise<void> {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') || '';
  let filename = 'certificate.bin';
  const m = cd.match(/filename="?([^";]+)"?/);
  if (m) filename = m[1];

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function pollUntil<T>(fn: () => Promise<T>, timeoutMs = 15000, interval = 500): Promise<T> {
  const start = Date.now();
  while (true) {
    const result = await fn();
    // consumer decides what constitutes completion
    // If fn resolves without throwing, return it
    return result;
    if (Date.now() - start > timeoutMs) throw new Error('timeout');
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, interval));
  }
}

export default { requestCertificate, downloadCertificate, pollUntil };
