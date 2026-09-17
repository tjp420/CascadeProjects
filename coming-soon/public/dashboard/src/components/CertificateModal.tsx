import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { requestCertificate, downloadCertificate } from '@/lib/certificates';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string | undefined;
};

export default function CertificateModal({ isOpen, onClose, sessionId }: Props) {
  const [status, setStatus] = useState<'idle'|'pending'|'success'|'error'>('idle');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && dialogRef.current) dialogRef.current.focus();
  }, [isOpen]);

  async function handleGenerate() {
    setStatus('pending');
    setError(null);
    try {
      const resp = await requestCertificate(sessionId);
      setDownloadUrl(resp.downloadUrl);
      setStatus('success');
    } catch (err: any) {
      setError(err?.message || 'failed');
      setStatus('error');
    }
  }

  async function handleDownload() {
    if (!downloadUrl) return;
    try {
      await downloadCertificate(downloadUrl);
    } catch (e) {
      // show non-blocking error
      setError((e as Error).message || 'download failed');
    }
  }

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Certificate generation dialog" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div ref={dialogRef} tabIndex={-1} className="bg-white rounded shadow-lg max-w-lg w-full p-6 relative">
        <h2 className="text-lg font-semibold">Generate certificate</h2>
        <p className="text-sm text-muted-foreground mt-2">Generate a signed certificate for your executive checkout or compliance record.</p>

        <div className="mt-4">
          {status === 'idle' && <p className="text-sm">Click generate to create a certificate.</p>}
          {status === 'pending' && <p className="text-sm">Generating…</p>}
          {status === 'success' && <p className="text-sm text-green-600">Ready — click download to save the certificate.</p>}
          {status === 'error' && <p className="text-sm text-red-600">Error: {error}</p>}
        </div>

        <div className="mt-6 flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {status !== 'success' && <Button onClick={handleGenerate}>Generate</Button>}
          {status === 'success' && <Button onClick={handleDownload}>Download</Button>}
        </div>
      </div>
    </div>
  );
}
