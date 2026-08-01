import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw, Loader2, Send, Eye, Building2, AlertTriangle,
  CheckCircle2, Layers, Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

interface OrgSummary {
  orgId: string;
  totalPolicies: number;
  enabledPolicies: number;
  disabledPolicies: number;
  bySeverity: Record<string, number>;
  byCompliance: Record<string, number>;
}

interface PiiPolicy {
  id: string; orgId: string; name: string; description: string;
  pattern: string; flags: string; replacement: string;
  severity: 'high' | 'medium' | 'low'; enabled: boolean;
  compliance: string[]; isDefault: boolean;
  createdAt: string; updatedAt: string;
}

interface PreviewResult {
  orgId: string; mode: string; sourcePolicyCount: number;
  targetPolicyCount: number; wouldClone: number; wouldSkip: number; wouldRemove: number;
}

interface SyncResult {
  success?: boolean; sourceOrg: string;
  targets: Array<{ orgId: string; success: boolean; cloned: number; skipped: number; removed: number; error?: string }>;
  totalCloned: number; totalSkipped: number; totalRemoved: number;
}

function severityColor(sev: string): string {
  if (sev === 'high') return 'bg-red-500/15 text-red-500 border-red-500/30';
  if (sev === 'medium') return 'bg-orange-500/15 text-orange-500 border-orange-500/30';
  return 'bg-blue-500/15 text-blue-500 border-blue-500/30';
}

export function PolicySyncer() {
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [frameworks, setFrameworks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceOrgId, setSourceOrgId] = useState<string | null>(null);
  const [sourcePolicies, setSourcePolicies] = useState<PiiPolicy[]>([]);
  const [loadingSourcePolicies, setLoadingSourcePolicies] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());
  const [syncMode, setSyncMode] = useState<'merge' | 'replace'>('merge');
  const [complianceFilter, setComplianceFilter] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<Set<string>>(new Set());
  const [defaultOnly, setDefaultOnly] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewResult[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const fetchOrgs = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/api/audit/pii/orgs'), { headers: authHeaders(), credentials: 'include' });
      if (!resp.ok) { const b = await resp.json().catch(() => ({})); throw new Error(b.message || 'HTTP ' + resp.status); }
      const json = await resp.json();
      setOrgs(json.orgs || []);
    } catch (err) { console.warn('[PolicySyncer] fetch orgs failed:', err); }
    finally { setLoading(false); }
  }, []);

  const fetchFrameworks = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/api/audit/pii/frameworks'), { headers: authHeaders(), credentials: 'include' });
      if (!resp.ok) return;
      const json = await resp.json();
      setFrameworks(json.frameworks || []);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { void fetchOrgs(); void fetchFrameworks(); }, [fetchOrgs, fetchFrameworks]);

  useEffect(() => {
    if (!sourceOrgId) { setSourcePolicies([]); return; }
    setLoadingSourcePolicies(true); setPreview(null); setSyncResult(null);
    (async () => {
      try {
        const resp = await fetch(apiUrl('/api/audit/pii/policies/' + encodeURIComponent(sourceOrgId)), { headers: authHeaders(), credentials: 'include' });
        if (!resp.ok) { const b = await resp.json().catch(() => ({})); throw new Error(b.message || 'HTTP ' + resp.status); }
        const json = await resp.json();
        setSourcePolicies(json.policies || []);
      } catch (err) { toast.error('Failed to load source policies: ' + (err instanceof Error ? err.message : 'Unknown')); setSourcePolicies([]); }
      finally { setLoadingSourcePolicies(false); }
    })();
  }, [sourceOrgId]);

  const filteredSourcePolicies = sourcePolicies.filter((p) => {
    if (defaultOnly && !p.isDefault) return false;
    if (severityFilter.size > 0 && !severityFilter.has(p.severity)) return false;
    if (complianceFilter.size > 0 && !p.compliance.some((c) => complianceFilter.has(c))) return false;
    return true;
  });

  const targetOrgs = orgs.filter((o) => o.orgId !== sourceOrgId);

  const toggleTarget = useCallback((orgId: string) => {
    setSelectedTargets((prev) => { const n = new Set(prev); if (n.has(orgId)) n.delete(orgId); else n.add(orgId); return n; });
  }, []);
  const selectAllTargets = useCallback(() => setSelectedTargets(new Set(targetOrgs.map((o) => o.orgId))), [targetOrgs]);
  const clearTargets = useCallback(() => setSelectedTargets(new Set()), []);
  const toggleComplianceFilter = useCallback((fw: string) => {
    setComplianceFilter((prev) => { const n = new Set(prev); if (n.has(fw)) n.delete(fw); else n.add(fw); return n; });
  }, []);
  const toggleSeverityFilter = useCallback((sev: string) => {
    setSeverityFilter((prev) => { const n = new Set(prev); if (n.has(sev)) n.delete(sev); else n.add(sev); return n; });
  }, []);

  const buildBody = useCallback(() => {
    const body: Record<string, unknown> = { sourceOrgId, mode: syncMode };
    if (selectedTargets.size > 0) body.targetOrgIds = [...selectedTargets];
    if (complianceFilter.size > 0) body.compliance = [...complianceFilter];
    if (severityFilter.size > 0) body.severity = [...severityFilter];
    if (defaultOnly) body.isDefault = true;
    return body;
  }, [sourceOrgId, selectedTargets, syncMode, complianceFilter, severityFilter, defaultOnly]);

  const handlePreview = useCallback(async () => {
    if (!sourceOrgId) return;
    setPreviewing(true); setPreview(null);
    try {
      const resp = await fetch(apiUrl('/api/audit/pii/sync-preview'), { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, credentials: 'include', body: JSON.stringify(buildBody()) });
      if (!resp.ok) { const b = await resp.json().catch(() => ({})); throw new Error(b.message || 'HTTP ' + resp.status); }
      const json = await resp.json();
      setPreview(json.previews || []);
      toast.success('Preview generated for ' + json.targetCount + ' target org(s)');
    } catch (err) { toast.error('Preview failed: ' + (err instanceof Error ? err.message : 'Unknown')); }
    finally { setPreviewing(false); }
  }, [sourceOrgId, buildBody]);

  const handleSync = useCallback(async () => {
    if (!sourceOrgId) return;
    if (confirmText !== 'SYNC') { toast.error('Please type SYNC to confirm'); return; }
    setSyncing(true); setShowConfirmModal(false); setConfirmText(''); setSyncResult(null);
    try {
      const resp = await fetch(apiUrl('/api/audit/pii/sync'), { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, credentials: 'include', body: JSON.stringify(buildBody()) });
      if (!resp.ok) { const b = await resp.json().catch(() => ({})); throw new Error(b.message || 'HTTP ' + resp.status); }
      const json = await resp.json();
      setSyncResult(json);
      toast.success('Sync complete: ' + json.totalCloned + ' cloned, ' + json.totalSkipped + ' skipped, ' + json.totalRemoved + ' removed');
      void fetchOrgs();
    } catch (err) { toast.error('Sync failed: ' + (err instanceof Error ? err.message : 'Unknown')); }
    finally { setSyncing(false); }
  }, [sourceOrgId, buildBody, confirmText, fetchOrgs]);

  if (loading) return (<Card><CardContent className="flex flex-col items-center gap-3 py-12"><Loader2 className="h-6 w-6 text-foreground-muted animate-spin" /><p className="text-sm text-foreground-muted">Loading organization policies...</p></CardContent></Card>);
  if (orgs.length === 0) return (<Card><CardContent className="flex flex-col items-center gap-3 py-12"><Building2 className="h-8 w-8 text-foreground-muted" /><p className="text-sm text-foreground-muted">No organizations with PII policies found</p><Button size="sm" variant="outline" onClick={() => void fetchOrgs()}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button></CardContent></Card>);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle className="text-lg flex items-center gap-2"><Layers className="h-5 w-5" />Multi-Tenant Policy Syncer</CardTitle><CardDescription className="mt-1">Push PII redaction policies across all organization nodes</CardDescription></div>
            <Button size="sm" variant="outline" onClick={() => void fetchOrgs()}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Source Org */}
          <div className="space-y-2">
            <label className="text-sm font-semibold"><span className="text-foreground-muted">Step 1:</span> Select Source Organization</label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {orgs.map((org) => (
                <div key={org.orgId} className={'rounded-lg border p-3 cursor-pointer transition-colors ' + (sourceOrgId === org.orgId ? 'border-primary bg-primary/5' : 'hover:bg-muted/30')} onClick={() => { setSourceOrgId(org.orgId); setSelectedTargets(new Set()); setPreview(null); setSyncResult(null); }}>
                  <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-foreground-muted flex-shrink-0" /><span className="text-sm font-mono truncate">{org.orgId}</span></div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-foreground-muted"><span>{org.totalPolicies} policies</span><span>{org.enabledPolicies} enabled</span></div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 2: Filters */}
          {sourceOrgId && (
            <div className="space-y-3">
              <div className="border-t pt-3" />
              <label className="text-sm font-semibold"><span className="text-foreground-muted">Step 2:</span> Review Source Policies & Filters</label>
              {loadingSourcePolicies ? (<div className="flex items-center gap-2 py-4"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm text-foreground-muted">Loading policies...</span></div>) : (
                <>
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                    <div className="flex items-center gap-1.5"><Filter className="h-4 w-4 text-foreground-muted" /><span className="text-xs font-semibold">Filters:</span></div>
                    <div className="flex items-center gap-1">{['high','medium','low'].map((sev) => (<button key={sev} className={'px-2 py-0.5 rounded text-xs border transition-colors ' + (severityFilter.has(sev) ? severityColor(sev) : 'border-border text-foreground-muted hover:bg-muted/30')} onClick={() => toggleSeverityFilter(sev)}>{sev}</button>))}</div>
                    {frameworks.length > 0 && (<div className="flex items-center gap-1">{frameworks.map((fw) => (<button key={fw} className={'px-2 py-0.5 rounded text-xs border transition-colors ' + (complianceFilter.has(fw) ? 'bg-primary/15 text-primary border-primary/30' : 'border-border text-foreground-muted hover:bg-muted/30')} onClick={() => toggleComplianceFilter(fw)}>{fw}</button>))}</div>)}
                    <button className={'px-2 py-0.5 rounded text-xs border transition-colors ' + (defaultOnly ? 'bg-primary/15 text-primary border-primary/30' : 'border-border text-foreground-muted hover:bg-muted/30')} onClick={() => setDefaultOnly((v) => !v)}>Default only</button>
                    {(severityFilter.size > 0 || complianceFilter.size > 0 || defaultOnly) && (<button className="text-xs text-foreground-muted hover:text-foreground" onClick={() => { setSeverityFilter(new Set()); setComplianceFilter(new Set()); setDefaultOnly(false); }}>Clear filters</button>)}
                  </div>
                  <div className="text-sm text-foreground-muted">Showing <span className="font-semibold text-foreground">{filteredSourcePolicies.length}</span> of <span className="font-semibold text-foreground">{sourcePolicies.length}</span> source policies</div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {filteredSourcePolicies.map((p) => (<div key={p.id} className="flex items-center gap-2 rounded border px-3 py-1.5 text-xs"><Badge variant="outline" className={'text-[10px] py-0 ' + severityColor(p.severity)}>{p.severity}</Badge><span className="font-medium">{p.name}</span>{p.isDefault && <Badge variant="outline" className="text-[10px] py-0">default</Badge>}{p.compliance.map((c) => <Badge key={c} variant="outline" className="text-[10px] py-0">{c}</Badge>)}{!p.enabled && <span className="text-foreground-muted">(disabled)</span>}</div>))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Targets */}
          {sourceOrgId && !loadingSourcePolicies && (
            <div className="space-y-3">
              <div className="border-t pt-3" />
              <div className="flex items-center justify-between"><label className="text-sm font-semibold"><span className="text-foreground-muted">Step 3:</span> Select Target Organizations</label><div className="flex items-center gap-2"><Button size="sm" variant="ghost" onClick={selectAllTargets}>Select all</Button><Button size="sm" variant="ghost" onClick={clearTargets}>Clear</Button></div></div>
              <div className="flex items-center gap-2"><span className="text-xs text-foreground-muted">Mode:</span><button className={'px-3 py-1 rounded text-xs border transition-colors ' + (syncMode === 'merge' ? 'bg-primary/15 text-primary border-primary/30' : 'border-border hover:bg-muted/30')} onClick={() => setSyncMode('merge')}>Merge (add to existing)</button><button className={'px-3 py-1 rounded text-xs border transition-colors ' + (syncMode === 'replace' ? 'bg-red-500/15 text-red-500 border-red-500/30' : 'border-border hover:bg-muted/30')} onClick={() => setSyncMode('replace')}>Replace (wipe & overwrite)</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {targetOrgs.map((org) => (<div key={org.orgId} className={'rounded-lg border p-2.5 cursor-pointer transition-colors ' + (selectedTargets.has(org.orgId) ? 'border-primary bg-primary/5' : 'hover:bg-muted/30')} onClick={() => toggleTarget(org.orgId)}><div className="flex items-center gap-2"><input type="checkbox" checked={selectedTargets.has(org.orgId)} readOnly className="h-3.5 w-3.5" /><span className="text-sm font-mono truncate">{org.orgId}</span></div><div className="text-xs text-foreground-muted mt-0.5 ml-5">{org.totalPolicies} existing policies</div></div>))}
              </div>
              {targetOrgs.length === 0 && <p className="text-sm text-foreground-muted">No other organizations available to sync to.</p>}
            </div>
          )}

          {/* Step 4: Preview + Sync */}
          {sourceOrgId && targetOrgs.length > 0 && (
            <div className="space-y-3">
              <div className="border-t pt-3" />
              <label className="text-sm font-semibold"><span className="text-foreground-muted">Step 4:</span> Preview & Execute</label>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => void handlePreview()} disabled={previewing}>{previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Dry Run Preview</Button>
                <Button size="sm" variant="default" onClick={() => setShowConfirmModal(true)} disabled={syncing}>{syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Execute Sync</Button>
                <span className="text-xs text-foreground-muted">{selectedTargets.size > 0 ? '-> ' + selectedTargets.size + ' target(s) selected' : '-> all ' + targetOrgs.length + ' target(s) will be synced'}</span>
              </div>
              {preview && (<div className="rounded-lg border p-3 space-y-2"><h4 className="text-sm font-semibold flex items-center gap-1"><Eye className="h-4 w-4" /> Preview Results</h4><div className="space-y-1.5 max-h-64 overflow-y-auto">{preview.map((p) => (<div key={p.orgId} className="flex items-center gap-3 text-xs border-b pb-1.5 last:border-0"><span className="font-mono flex-1 truncate">{p.orgId}</span>{p.wouldRemove > 0 && <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px]">-{p.wouldRemove} remove</Badge>}{p.wouldClone > 0 && <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px]">+{p.wouldClone} clone</Badge>}{p.wouldSkip > 0 && <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20 text-[10px]">{p.wouldSkip} skip</Badge>}{p.wouldClone === 0 && p.wouldSkip === 0 && p.wouldRemove === 0 && <span className="text-foreground-muted">no changes</span>}</div>))}</div></div>)}
              {syncResult && (<div className="rounded-lg border p-3 space-y-2"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-500" /><h4 className="text-sm font-semibold">Sync Complete</h4></div><div className="grid grid-cols-3 gap-2 text-center"><div className="rounded border p-2"><p className="text-lg font-bold text-green-500">{syncResult.totalCloned}</p><p className="text-xs text-foreground-muted">Cloned</p></div><div className="rounded border p-2"><p className="text-lg font-bold text-gray-500">{syncResult.totalSkipped}</p><p className="text-xs text-foreground-muted">Skipped</p></div><div className="rounded border p-2"><p className="text-lg font-bold text-red-500">{syncResult.totalRemoved}</p><p className="text-xs text-foreground-muted">Removed</p></div></div>{syncResult.targets.some((t) => !t.success) && (<div className="space-y-1"><p className="text-xs font-semibold text-red-500">Failed targets:</p>{syncResult.targets.filter((t) => !t.success).map((t) => <div key={t.orgId} className="text-xs text-red-500">{t.orgId}: {t.error}</div>)}</div>)}</div>)}
            </div>
          )}
        </CardContent>
      </Card>
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowConfirmModal(false)}>
          <div className="w-full max-w-md bg-background border rounded-lg shadow-xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-500" /><h3 className="text-lg font-semibold">Confirm Policy Sync</h3></div>
            <p className="text-sm text-foreground-muted">You are about to {syncMode === 'replace' ? 'REPLACE all policies in' : 'merge policies into'} {selectedTargets.size > 0 ? selectedTargets.size : targetOrgs.length} organization(s) from source <span className="font-mono">{sourceOrgId}</span>.{syncMode === 'replace' && <span className="block mt-2 text-red-500 font-medium">Replace mode will permanently delete all existing policies in target orgs before cloning.</span>}</p>
            <div><label className="text-xs text-foreground-muted block mb-1">Type <strong>SYNC</strong> to confirm:</label><input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type SYNC to confirm" className="w-full px-3 py-2 border rounded text-sm" autoFocus /></div>
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => { setShowConfirmModal(false); setConfirmText(''); }}>Cancel</Button><Button variant="default" onClick={() => void handleSync()} disabled={confirmText !== 'SYNC' || syncing}>{syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Confirm Sync</Button></div>
          </div>
        </div>
      )}
    </>
  );
}
