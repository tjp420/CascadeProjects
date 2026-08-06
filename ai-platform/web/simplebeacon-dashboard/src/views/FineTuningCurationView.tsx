// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getApiBase } from '@/config';
import { toast } from 'sonner';
import { Database, Search, ChevronLeft, ChevronRight, Download, Tag } from 'lucide-react';

interface TelemetryEntry {
  eventId: string;
  orgId: string;
  userId: string | null;
  operation: string;
  model: string;
  input: string;
  output: string;
  timestamp: string;
  label: string;
  score: number;
  turns: number;
  rating: number;
}

interface PagedResult {
  success: boolean;
  orgId: string;
  entries: TelemetryEntry[];
  total: number;
  page: number;
  limit: number;
  count: number;
}

interface Dataset {
  filename: string;
  createdAt: string;
  sizeBytes: number;
}

function apiUrl(path: string): string {
  const base = getApiBase();
  return `${base}/api${path}`;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('sb_token') || localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const LABELS = ['include', 'exclude', 'review', 'golden'];
const FORMATS = ['jsonl', 'alpaca', 'chatml'];

export function FineTuningCurationView() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superuser';
  const [orgId, setOrgId] = useState<string>('default');

  const [filters, setFilters] = useState({
    q: '',
    minRating: '',
    minTurns: '',
    label: '',
    operation: '',
    startDate: '',
    endDate: '',
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [result, setResult] = useState<PagedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [exportFormat, setExportFormat] = useState('jsonl');
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const fetchErrorRef = useRef(false);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set('orgId', orgId);
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (filters.q) params.set('q', filters.q);
    if (filters.minRating) params.set('minRating', filters.minRating);
    if (filters.minTurns) params.set('minTurns', filters.minTurns);
    if (filters.label) params.set('label', filters.label);
    if (filters.operation) params.set('operation', filters.operation);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    return params.toString();
  }, [orgId, page, limit, filters]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/telemetry/collect?${buildQuery()}`), {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
      setSelected({});
    } catch (err: any) {
      setError(err.message || 'Failed to load telemetry');
      if (err.message && /HTTP (401|403|404)/.test(err.message)) {
        fetchErrorRef.current = true;
      }
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  const fetchDatasets = useCallback(async () => {
    setLoadingDatasets(true);
    try {
      const res = await fetch(apiUrl(`/telemetry/datasets?orgId=${encodeURIComponent(orgId)}`), {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDatasets(data.datasets || []);
    } catch {
      // non-fatal
    } finally {
      setLoadingDatasets(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (!isAdmin) return;
    if (fetchErrorRef.current) return;
    fetchEntries();
    fetchDatasets();
  }, [isAdmin, fetchEntries, fetchDatasets]);

  const applyFilter = () => {
    setPage(1);
    fetchErrorRef.current = false;
    fetchEntries();
  };

  const labelEntry = async (eventId: string, label: string) => {
    try {
      const res = await fetch(apiUrl('/telemetry/label'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, label }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`Labeled ${eventId.slice(0, 12)} as ${label}`);
      fetchEntries();
    } catch (err: any) {
      toast.error(err.message || 'Label failed');
    }
  };

  const exportDataset = async () => {
    try {
      const body = {
        orgId,
        format: exportFormat,
        filters: {
          minRating: filters.minRating ? Number(filters.minRating) : undefined,
          minTurns: filters.minTurns ? Number(filters.minTurns) : undefined,
          label: filters.label || undefined,
          operation: filters.operation || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          q: filters.q || undefined,
        },
      };
      const res = await fetch(apiUrl('/telemetry/export'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      toast.success(`Exported ${data.rowCount} rows to ${data.filename}`);
      fetchDatasets();
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    }
  };

  const totalPages = result ? Math.max(1, Math.ceil(result.total / limit)) : 1;

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Admin access is required to curate fine-tuning datasets.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Fine-Tuning Curation</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-card">
        <div className="space-y-1">
          <Label htmlFor="ft-org">Org ID</Label>
          <Input id="ft-org" value={orgId} onChange={(e) => setOrgId(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ft-q">Search</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input id="ft-q" className="pl-8" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="keyword..." />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ft-minRating">Min Score</Label>
          <Input id="ft-minRating" type="number" min={0} max={10} value={filters.minRating} onChange={(e) => setFilters((f) => ({ ...f, minRating: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ft-minTurns">Min Turns</Label>
          <Input id="ft-minTurns" type="number" min={1} value={filters.minTurns} onChange={(e) => setFilters((f) => ({ ...f, minTurns: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ft-label">Label</Label>
          <select
            id="ft-label"
            value={filters.label}
            onChange={(e) => setFilters((f) => ({ ...f, label: e.target.value }))}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">any</option>
            {LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ft-operation">Operation</Label>
          <Input id="ft-operation" value={filters.operation} onChange={(e) => setFilters((f) => ({ ...f, operation: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ft-startDate">Start</Label>
          <Input id="ft-startDate" type="date" value={filters.startDate} onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ft-endDate">End</Label>
          <Input id="ft-endDate" type="date" value={filters.endDate} onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))} />
        </div>
        <div className="lg:col-span-4 flex gap-2">
          <Button onClick={applyFilter}>Apply filters</Button>
          <Button variant="outline" onClick={() => { setFilters({ q: '', minRating: '', minTurns: '', label: '', operation: '', startDate: '', endDate: '' }); setPage(1); }}>Reset</Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {result ? `${result.count} of ${result.total} entries (page ${result.page})` : 'Loading...'}
        </div>
        <div className="flex items-center gap-2">
          <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm">
            {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <Button onClick={exportDataset}><Download className="mr-2 h-4 w-4" /> Export</Button>
        </div>
      </div>

      {error && <div className="p-4 border border-destructive text-destructive rounded">{error}</div>}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading entries...</div>
      ) : (
        <div className="border rounded-lg overflow-x-auto bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left">Score</th>
                <th className="p-2 text-left">Turns</th>
                <th className="p-2 text-left">Label</th>
                <th className="p-2 text-left">Model</th>
                <th className="p-2 text-left">Input</th>
                <th className="p-2 text-left">Output</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {result?.entries?.length ? result.entries.map((e) => (
                <tr key={e.eventId} className="border-t hover:bg-muted/50">
                  <td className="p-2">{e.score}</td>
                  <td className="p-2">{e.turns}</td>
                  <td className="p-2 capitalize">{e.label}</td>
                  <td className="p-2">{e.model}</td>
                  <td className="p-2 max-w-xs truncate" title={e.input}>{e.input}</td>
                  <td className="p-2 max-w-xs truncate" title={e.output}>{e.output}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      <select
                        value={selected[e.eventId] || e.label}
                        onChange={(ev) => setSelected((s) => ({ ...s, [e.eventId]: ev.target.value }))}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                      <Button size="sm" variant="ghost" onClick={() => labelEntry(e.eventId, selected[e.eventId] || e.label)}>
                        <Tag className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No entries found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" /></Button>
        <Input type="number" min={1} max={totalPages} value={page} onChange={(e) => setPage(Math.max(1, Math.min(totalPages, Number(e.target.value))))} className="w-20" />
        <span className="text-sm text-muted-foreground">of {totalPages}</span>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRight className="h-4 w-4" /></Button>
        <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm">
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Exported Datasets</h2>
        {loadingDatasets ? (
          <div className="text-sm text-muted-foreground">Loading datasets...</div>
        ) : datasets.length ? (
          <ul className="space-y-1 text-sm">
            {datasets.map((d) => (
              <li key={d.filename} className="flex justify-between p-2 border rounded bg-card">
                <span>{d.filename}</span>
                <span className="text-muted-foreground">{new Date(d.createdAt).toLocaleString()} · {(d.sizeBytes / 1024).toFixed(1)} KB</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-muted-foreground">No datasets exported yet.</div>
        )}
      </div>
    </div>
  );
}
