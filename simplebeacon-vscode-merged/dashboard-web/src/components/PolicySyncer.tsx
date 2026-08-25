import { useState, useEffect, useCallback } from 'react';
import { Shield, RefreshCw, AlertTriangle, CheckCircle, Ban, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl, authHeaders } from '@/config';

interface PolicyRule {
  ruleId: string;
  axis: string;
  effect: 'ALLOW' | 'DENY' | 'ENFORCE' | 'DISABLED';
  condition: {
    field: string;
    operator: string;
    value: unknown;
  };
  remediation: string;
}

interface TenantPolicy {
  policyId: string;
  version: string;
  updatedAt?: string;
  rules: PolicyRule[];
}

interface PiiPolicy {
  id: string;
  orgId: string;
  name: string;
  description: string;
  pattern: string;
  flags: string;
  replacement: string;
  severity: 'high' | 'medium' | 'low';
  enabled: boolean;
  compliance: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AuditLogResult {
  total: number;
  entries: unknown[];
}

export function PolicySyncer() {
  const [policy, setPolicy] = useState<TenantPolicy | null>(null);
  const [blocked, setBlocked] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const orgsResp = await fetch(apiUrl('/api/audit/pii/orgs'), { headers: authHeaders(), credentials: 'include' });
      if (!orgsResp.ok) throw new Error(`Orgs request failed: ${orgsResp.status}`);
      const orgsJson = await orgsResp.json();
      const org = (orgsJson.orgs || [])[0];
      const orgId = org?.orgId || 'org-source';

      const polResp = await fetch(apiUrl(`/api/audit/pii/policies/${encodeURIComponent(orgId)}`), {
        headers: authHeaders(),
        credentials: 'include',
      });
      if (!polResp.ok) throw new Error(`Policy request failed: ${polResp.status}`);
      const polJson = await polResp.json();
      const policies: PiiPolicy[] = polJson.policies || [];

      const rules: PolicyRule[] = policies.map((p) => ({
        ruleId: p.id,
        axis: p.compliance?.length ? p.compliance.join(', ') : p.name,
        effect: p.enabled ? 'ENFORCE' : 'DISABLED',
        condition: {
          field: 'req.headers.x-dlp-token',
          operator: 'EXISTS',
          value: p.enabled,
        },
        remediation: p.description || `Enforce ${p.name} for ${p.compliance?.join(', ') || 'compliance'}`,
      }));

      setPolicy({
        policyId: `pol_${orgId}`,
        version: '1.4.2',
        updatedAt: new Date().toISOString(),
        rules,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown fetch error';
      setError(message);
      toast.error(`Policy sync error: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBlockedCount = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/api/audit/log?action=compliance_policy_violation&limit=1&offset=0'), {
        headers: authHeaders(),
        credentials: 'include',
      });
      if (!resp.ok) return;
      const json: AuditLogResult = await resp.json();
      setBlocked(json.total || 0);
    } catch {
      /* non-critical counter */
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    void fetchBlockedCount();
    const id = setInterval(fetchBlockedCount, 5000);
    return () => clearInterval(id);
  }, [fetchBlockedCount]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl mt-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div>
          <h3 className="text-md font-bold text-white flex items-center tracking-wide">
            <Shield className="w-4 h-4 mr-2 text-indigo-500" />
            Information Governance & Policy Syncer Status
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Tenant-scoped operational compliance guidelines, rule sets, and access barriers.
          </p>
        </div>
        <button
          onClick={() => {
            void fetchData();
            void fetchBlockedCount();
          }}
          disabled={loading}
          className="p-2 border border-slate-800 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/40 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </button>
      </div>

      {error && (
        <div className="bg-red-950/20 border border-red-900/40 p-4 rounded-lg text-xs text-red-400 mb-6 flex items-center">
          <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
          <span>
            <strong>Sync Error:</strong> {error}
          </span>
        </div>
      )}

      {policy ? (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800/60 font-mono">
              <span className="text-slate-500 block mb-1 uppercase tracking-wider text-[10px]">
                Active Blueprint ID
              </span>
              <span className="text-slate-200 font-semibold">{policy.policyId}</span>
            </div>
            <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800/60 font-mono">
              <span className="text-slate-500 block mb-1 uppercase tracking-wider text-[10px]">Framework Version</span>
              <span className="text-indigo-400 font-semibold">{policy.version}</span>
            </div>
            <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800/60 font-mono">
              <span className="text-slate-500 block mb-1 uppercase tracking-wider text-[10px]">Enforcement State</span>
              <span className="text-emerald-400 font-semibold flex items-center">
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                ACTIVE
              </span>
            </div>
            <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800/60 font-mono">
              <span className="text-slate-500 block mb-1 uppercase tracking-wider text-[10px]">Blocked Requests</span>
              <span className="text-amber-400 font-semibold flex items-center">
                <Ban className="w-3.5 h-3.5 mr-1" />
                {blocked.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="mt-6">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block mb-3 font-mono">
              Active Policy Interception Matrix
            </span>
            <div className="overflow-x-auto border border-slate-800 rounded-lg bg-slate-950/20">
              <table className="w-full text-left border-collapse font-mono">
                <thead>
                  <tr className="bg-slate-950/60 text-slate-400 font-medium border-b border-slate-800">
                    <th className="p-3">Rule Identifier</th>
                    <th className="p-3">Interception Axis</th>
                    <th className="p-3">Effect</th>
                    <th className="p-3">Remediation Attestation Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {policy.rules.map((rule) => (
                    <tr key={rule.ruleId} className="hover:bg-slate-950/10">
                      <td className="p-3 font-semibold text-slate-200">{rule.ruleId}</td>
                      <td className="p-3 text-slate-400">{rule.axis}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            rule.effect === 'DENY' || rule.effect === 'DISABLED'
                              ? 'bg-red-950 text-red-400 border-red-900/40'
                              : 'bg-emerald-950 text-emerald-400 border-emerald-900/40'
                          }`}
                        >
                          {rule.effect}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 font-sans">{rule.remediation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        !loading && (
          <div className="text-slate-500 font-mono text-center py-6">No policy blueprints currently mapped.</div>
        )
      )}
    </div>
  );
}
