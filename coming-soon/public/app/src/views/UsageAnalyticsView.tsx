import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from 'recharts';
import {
  RefreshCw, TrendingUp, TrendingDown, FileCode, AlertTriangle,
  Shield, Activity, Building2, Gauge, Calendar, Download, FileJson,
  ChevronDown, ChevronRight, Wrench, Copy, Check, Ticket, Link2, X, Clock, Send, Settings,
  ShieldCheck, ScrollText, FlaskConical,
} from 'lucide-react';
import { apiUrl, authHeaders } from '@/config';
import { toast } from 'sonner';

type GlobalStats = {
  totalOrgs: number;
  totalScans: number;
  totalFilesAnalyzed: number;
  totalFindings: number;
  severityTotals: { critical: number; high: number; medium: number; low: number; info: number };
  avgPostureScore: number;
  languageBreakdown: Record<string, number>;
  categoryBreakdown: Record<string, number>;
  orgIds: string[];
};

type TrendPoint = {
  period: string;
  scans: number;
  filesAnalyzed: number;
  totalFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  avgPosture: number;
};

type HeatmapEntry = {
  category: string;
  totalFindings: number;
  scanCount: number;
};

type RepositoryEntry = {
  name: string;
  scans: number;
  findings: number;
  lastScanAt: string | null;
};

type RemediationGuidance = {
  strategy: string;
  priority: string;
  description: string;
  steps: string[];
};

type ViolationRow = {
  scanId: string;
  orgId: string;
  timestamp: string;
  repository: string;
  branch: string;
  commitSha: string;
  triggeredBy: string;
  category: string;
  count: number;
  postureScore: number;
  gateStatus: string;
  remediation: RemediationGuidance;
  ticketed: boolean;
  ticketRef: string | null;
  ticketTarget: string | null;
  ticketMarkedAt: string | null;
  daysOpen: number;
  slaLimit: number;
  slaBreached: boolean;
  slaDaysOver: number;
};

type TicketStatus = {
  scanId: string;
  category: string;
  ticketRef: string;
  ticketTarget: string;
  status: string;
  markedAt: string;
};

type CategorySummary = {
  category: string;
  total: number;
  ticketed: number;
  unticketed: number;
  coverage: number;
  slaBreached: number;
};

type ViolationSummary = {
  totalViolations: number;
  ticketedViolations: number;
  unticketedViolations: number;
  slaBreachedCount: number;
  coverage: number;
  categories: CategorySummary[];
};

type WebhookConfig = {
  target: string;
  apiUrl: string;
  authToken: string;
  projectKey: string;
  teamId: string;
  repoOwner: string;
  repoName: string;
  updatedAt: string;
};

type ReportSchedule = {
  id: string;
  name: string;
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek: number;
  dayOfMonth: number;
  hour: number;
  minute: number;
  format: 'csv' | 'json';
  recipients: string[];
  filters: Record<string, string>;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunError: string | null;
  createdAt: string;
  updatedAt: string;
};

const SEVERITY_COLORS = {
  critical: '#FF0000',
  high: '#FF6600',
  medium: '#FFAA00',
  low: '#36A64F',
  info: '#4A90D9',
};

const LANGUAGE_COLORS = ['#4A90D9', '#F1E05A', '#3178C6', '#A371F7', '#E34C26', '#89E051', '#DB5855', '#563D7C', '#0DBFED', '#f34b7d'];

export function UsageAnalyticsView() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([]);
  const [repositories, setRepositories] = useState<RepositoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');
  const [days, setDays] = useState<number>(90);
  const [repoFilter, setRepoFilter] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [repoOptions, setRepoOptions] = useState<string[]>([]);
  const [branchOptions, setBranchOptions] = useState<string[]>([]);
  const [violations, setViolations] = useState<ViolationRow[]>([]);
  const [violationsTotal, setViolationsTotal] = useState(0);
  const [violationsPage, setViolationsPage] = useState(0);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [ticketTarget, setTicketTarget] = useState<'jira' | 'linear' | 'github'>('jira');
  const [ticketLoading, setTicketLoading] = useState<string | null>(null);
  const [ticketPayload, setTicketPayload] = useState<Record<string, unknown> | null>(null);
  const [ticketRowKey, setTicketRowKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ticketStatuses, setTicketStatuses] = useState<Record<string, TicketStatus>>({});
  const [ticketRefInput, setTicketRefInput] = useState<string>('');
  const [markingRow, setMarkingRow] = useState<string | null>(null);
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | 'ticketed' | 'unticketed'>('all');
  const [ticketTargetFilter, setTicketTargetFilter] = useState<string>('');
  const [violationSummary, setViolationSummary] = useState<ViolationSummary | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkTicketRef, setBulkTicketRef] = useState<string>('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [slaBreachedFilter, setSlaBreachedFilter] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [webhookConfigs, setWebhookConfigs] = useState<Record<string, WebhookConfig>>({});
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);
  const [webhookForm, setWebhookForm] = useState({ target: 'jira', apiUrl: '', authToken: '', projectKey: '', teamId: '', repoOwner: '', repoName: '' });
  const [dispatchingRow, setDispatchingRow] = useState<string | null>(null);
  const [reportSchedules, setReportSchedules] = useState<Record<string, ReportSchedule>>({});
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [gatePolicy, setGatePolicy] = useState<Record<string, any>>({});
  const [gateHistory, setGateHistory] = useState<any[]>([]);
  const [gateEvaluating, setGateEvaluating] = useState(false);
  const [gateEvalRepo, setGateEvalRepo] = useState('');
  const [gateEvalResult, setGateEvalResult] = useState<any>(null);
  const [showGatePolicyModal, setShowGatePolicyModal] = useState(false);
  const [gatePolicyForm, setGatePolicyForm] = useState({ minPostureScore: 70, maxCritical: 0, maxHigh: 5, maxMedium: 20, maxLow: 50, blockOnGateFail: true, blockOnSlaBreached: false, blockOnUnticketedCritical: false });
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [auditStats, setAuditStats] = useState<any>(null);
  const [auditFilter, setAuditFilter] = useState('');
  const [evalSuites, setEvalSuites] = useState<Record<string, any>>({});
  const [evalRuns, setEvalRuns] = useState<any[]>([]);
  const [evalStats, setEvalStats] = useState<any>(null);
  const [evalRunning, setEvalRunning] = useState(false);
  const [evalProvider, setEvalProvider] = useState('openai');
  const [evalSuiteId, setEvalSuiteId] = useState('default');
  const [evalRunDetail, setEvalRunDetail] = useState<any>(null);
  const [scheduleForm, setScheduleForm] = useState({
    id: '', name: '', enabled: true, frequency: 'weekly' as 'daily' | 'weekly' | 'monthly',
    dayOfWeek: 1, dayOfMonth: 1, hour: 8, minute: 0, format: 'csv' as 'csv' | 'json',
    recipients: '', filters: '',
  });
  const [scheduleRunning, setScheduleRunning] = useState<string | null>(null);
  const violationsPageSize = 10;

  const fetchFilters = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (repoFilter) params.set('repository', repoFilter);
      const resp = await fetch(apiUrl(`/enterprise/analytics/filters?${params}`), { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        setRepoOptions(data.repositories || []);
        setBranchOptions(data.branches || []);
      }
    } catch {
      // silent — filters are optional
    }
  }, [repoFilter]);

  useEffect(() => { fetchFilters(); }, [fetchFilters]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('days', String(days));
      if (repoFilter) params.set('repository', repoFilter);
      if (branchFilter) params.set('branch', branchFilter);
      const resp = await fetch(apiUrl(`/enterprise/analytics?${params}`), { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        if (data.stats) setStats(data.stats);
        if (data.trend) setTrend(data.trend || []);
        if (data.heatmap) setHeatmap(data.heatmap || []);
        if (data.repositories) setRepositories(data.repositories || []);
      } else {
        throw new Error('analytics_request_failed');
      }
    } catch {
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [granularity, days, repoFilter, branchFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchViolations = useCallback(async (page: number) => {
    try {
      const params = new URLSearchParams();
      params.set('limit', String(violationsPageSize));
      params.set('offset', String(page * violationsPageSize));
      if (repoFilter) params.set('repository', repoFilter);
      if (branchFilter) params.set('branch', branchFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (ticketStatusFilter !== 'all') params.set('ticketStatus', ticketStatusFilter);
      if (ticketTargetFilter) params.set('ticketTarget', ticketTargetFilter);
      if (slaBreachedFilter) params.set('slaBreached', 'true');
      const resp = await fetch(apiUrl(`/analytics/violations?${params}`), { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        setViolations(data.violations || []);
        setViolationsTotal(data.pagination?.total || 0);
      }
    } catch {
      // silent — violations table is supplementary
    }
  }, [repoFilter, branchFilter, categoryFilter, ticketStatusFilter, ticketTargetFilter, slaBreachedFilter]);

  useEffect(() => { fetchViolations(violationsPage); }, [fetchViolations, violationsPage]);

  const fetchTicketStatuses = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/analytics/violations/ticket-statuses'), { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        const map: Record<string, TicketStatus> = {};
        for (const [key, val] of Object.entries(data.statuses || {})) {
          map[key] = val as TicketStatus;
        }
        setTicketStatuses(map);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { fetchTicketStatuses(); }, [fetchTicketStatuses]);

  const fetchViolationSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (repoFilter) params.set('repository', repoFilter);
      if (branchFilter) params.set('branch', branchFilter);
      const resp = await fetch(apiUrl(`/analytics/violations/summary?${params}`), { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        setViolationSummary(data.summary || null);
      }
    } catch {
      // silent
    }
  }, [repoFilter, branchFilter]);

  useEffect(() => { fetchViolationSummary(); }, [fetchViolationSummary]);

  const markTicketed = useCallback(async (scanId: string, category: string, ticketRef: string, target: string) => {
    const rowKey = `${scanId}-${category}`;
    setMarkingRow(rowKey);
    try {
      const resp = await fetch(apiUrl('/analytics/violations/mark-ticketed'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId, category, ticketRef, ticketTarget: target }),
      });
      if (!resp.ok) throw new Error('mark_failed');
      await fetchTicketStatuses();
      await fetchViolationSummary();
      setTicketRefInput('');
      toast.success('Violation marked as ticketed');
    } catch {
      toast.error('Failed to mark as ticketed');
    } finally {
      setMarkingRow(null);
    }
  }, [fetchTicketStatuses, fetchViolationSummary]);

  const unmarkTicketed = useCallback(async (scanId: string, category: string) => {
    try {
      const resp = await fetch(apiUrl('/analytics/violations/unmark-ticketed'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId, category }),
      });
      if (!resp.ok) throw new Error('unmark_failed');
      await fetchTicketStatuses();
      await fetchViolationSummary();
      toast.success('Ticket status removed');
    } catch {
      toast.error('Failed to remove ticket status');
    }
  }, [fetchTicketStatuses, fetchViolationSummary]);

  const bulkMarkTicketed = useCallback(async () => {
    if (!bulkTicketRef.trim() || selectedRows.size === 0) return;
    setBulkLoading(true);
    try {
      const violations = Array.from(selectedRows).map(key => {
        const [scanId, category] = key.split('::');
        return { scanId, category };
      });
      const resp = await fetch(apiUrl('/analytics/violations/bulk-mark-ticketed'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ violations, ticketRef: bulkTicketRef.trim(), ticketTarget }),
      });
      if (!resp.ok) throw new Error('bulk_mark_failed');
      const data = await resp.json();
      await fetchTicketStatuses();
      await fetchViolationSummary();
      await fetchViolations(violationsPage);
      setSelectedRows(new Set());
      setBulkTicketRef('');
      toast.success(`Marked ${data.succeeded} of ${data.total} violations as ticketed`);
    } catch {
      toast.error('Failed to bulk mark violations');
    } finally {
      setBulkLoading(false);
    }
  }, [bulkTicketRef, selectedRows, ticketTarget, fetchTicketStatuses, fetchViolationSummary, fetchViolations, violationsPage]);

  const bulkUnmarkTicketed = useCallback(async () => {
    if (selectedRows.size === 0) return;
    setBulkLoading(true);
    try {
      const violations = Array.from(selectedRows).map(key => {
        const [scanId, category] = key.split('::');
        return { scanId, category };
      });
      const resp = await fetch(apiUrl('/analytics/violations/bulk-unmark-ticketed'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ violations }),
      });
      if (!resp.ok) throw new Error('bulk_unmark_failed');
      const data = await resp.json();
      await fetchTicketStatuses();
      await fetchViolationSummary();
      await fetchViolations(violationsPage);
      setSelectedRows(new Set());
      toast.success(`Removed ticket status from ${data.succeeded} of ${data.total} violations`);
    } catch {
      toast.error('Failed to bulk unmark violations');
    } finally {
      setBulkLoading(false);
    }
  }, [selectedRows, fetchTicketStatuses, fetchViolationSummary, fetchViolations, violationsPage]);

  const toggleRowSelection = useCallback((rowKey: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedRows(prev => {
      if (prev.size === violations.length) return new Set();
      const next = new Set<string>();
      for (const v of violations) {
        next.add(`${v.scanId}::${v.category}`);
      }
      return next;
    });
  }, [violations]);

  const fetchWebhookConfigs = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/analytics/webhook/configs'), { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        setWebhookConfigs(data.configs || {});
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { fetchWebhookConfigs(); }, [fetchWebhookConfigs]);

  const saveWebhookConfig = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/analytics/webhook/configs'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookForm),
      });
      if (!resp.ok) throw new Error('save_failed');
      await fetchWebhookConfigs();
      toast.success(`Webhook configuration saved for ${webhookForm.target}`);
    } catch {
      toast.error('Failed to save webhook configuration');
    }
  }, [webhookForm, fetchWebhookConfigs]);

  const deleteWebhookConfig = useCallback(async (target: string) => {
    try {
      const resp = await fetch(apiUrl(`/analytics/webhook/configs/${target}`), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!resp.ok) throw new Error('delete_failed');
      await fetchWebhookConfigs();
      toast.success(`Webhook configuration deleted for ${target}`);
    } catch {
      toast.error('Failed to delete webhook configuration');
    }
  }, [fetchWebhookConfigs]);

  const dispatchTicket = useCallback(async (scanId: string, category: string, target: 'jira' | 'linear' | 'github') => {
    const rowKey = `${scanId}-${category}`;
    setDispatchingRow(rowKey);
    try {
      const resp = await fetch(apiUrl('/analytics/violations/dispatch-ticket'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId, category, target }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        if (data.error === 'webhook_not_configured') {
          setShowWebhookConfig(true);
          setWebhookForm(prev => ({ ...prev, target }));
          toast.error(`No webhook configured for ${target}. Please configure it first.`);
        } else {
          throw new Error(data.message || 'dispatch_failed');
        }
        return;
      }
      await fetchTicketStatuses();
      await fetchViolationSummary();
      await fetchViolations(violationsPage);
      toast.success(`Ticket dispatched to ${target}${data.ticketRef ? ': ' + data.ticketRef : ''}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to dispatch ticket');
    } finally {
      setDispatchingRow(null);
    }
  }, [fetchTicketStatuses, fetchViolationSummary, fetchViolations, violationsPage]);

  const fetchReportSchedules = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/analytics/report/schedules'), { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        setReportSchedules(data.schedules || {});
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { fetchReportSchedules(); }, [fetchReportSchedules]);

  const saveReportSchedule = useCallback(async () => {
    const recipients = scheduleForm.recipients.split(',').map(s => s.trim()).filter(Boolean);
    if (!scheduleForm.id.trim() || recipients.length === 0) {
      toast.error('Schedule ID and at least one recipient are required');
      return;
    }
    try {
      const filters: Record<string, string> = {};
      if (scheduleForm.filters) {
        scheduleForm.filters.split(',').forEach(pair => {
          const [k, v] = pair.split(':').map(s => s.trim());
          if (k && v) filters[k] = v;
        });
      }
      const resp = await fetch(apiUrl('/analytics/report/schedules'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: scheduleForm.id.trim(),
          name: scheduleForm.name.trim() || scheduleForm.id.trim(),
          enabled: scheduleForm.enabled,
          frequency: scheduleForm.frequency,
          dayOfWeek: scheduleForm.dayOfWeek,
          dayOfMonth: scheduleForm.dayOfMonth,
          hour: scheduleForm.hour,
          minute: scheduleForm.minute,
          format: scheduleForm.format,
          recipients,
          filters,
        }),
      });
      if (!resp.ok) throw new Error('save_failed');
      await fetchReportSchedules();
      toast.success(`Report schedule "${scheduleForm.id}" saved`);
      setShowScheduleModal(false);
    } catch {
      toast.error('Failed to save report schedule');
    }
  }, [scheduleForm, fetchReportSchedules]);

  const deleteReportSchedule = useCallback(async (id: string) => {
    try {
      const resp = await fetch(apiUrl(`/analytics/report/schedules/${id}`), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!resp.ok) throw new Error('delete_failed');
      await fetchReportSchedules();
      toast.success(`Report schedule "${id}" deleted`);
    } catch {
      toast.error('Failed to delete report schedule');
    }
  }, [fetchReportSchedules]);

  const runReportSchedule = useCallback(async (id: string) => {
    setScheduleRunning(id);
    try {
      const resp = await fetch(apiUrl(`/analytics/report/schedules/${id}/run`), {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'run_failed');
      await fetchReportSchedules();
      toast.success(`Report generated and dispatched for "${id}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to run report schedule');
    } finally {
      setScheduleRunning(null);
    }
  }, [fetchReportSchedules]);

  // ── Deployment Gate ───────────────────────────────────────────────────────
  const fetchGatePolicy = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/deployment-gate/policy'), { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        setGatePolicy(data.policy || {});
        setGatePolicyForm({
          minPostureScore: data.policy?.minPostureScore ?? 70,
          maxCritical: data.policy?.maxCritical ?? 0,
          maxHigh: data.policy?.maxHigh ?? 5,
          maxMedium: data.policy?.maxMedium ?? 20,
          maxLow: data.policy?.maxLow ?? 50,
          blockOnGateFail: data.policy?.blockOnGateFail ?? true,
          blockOnSlaBreached: data.policy?.blockOnSlaBreached ?? false,
          blockOnUnticketedCritical: data.policy?.blockOnUnticketedCritical ?? false,
        });
      }
    } catch { /* silent */ }
  }, []);

  const fetchGateHistory = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/deployment-gate/history?limit=20'), { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        setGateHistory(data.history || []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchGatePolicy(); fetchGateHistory(); }, [fetchGatePolicy, fetchGateHistory]);

  const saveGatePolicy = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/deployment-gate/policy'), {
        method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(gatePolicyForm),
      });
      if (resp.ok) {
        const data = await resp.json();
        setGatePolicy(data.policy);
        setShowGatePolicyModal(false);
        toast.success('Deployment gate policy saved');
      } else { toast.error('Failed to save gate policy'); }
    } catch { toast.error('Failed to save gate policy'); }
  }, [gatePolicyForm]);

  const evaluateGate = useCallback(async () => {
    if (!gateEvalRepo.trim()) { toast.error('Repository is required'); return; }
    setGateEvaluating(true);
    setGateEvalResult(null);
    try {
      const params = new URLSearchParams();
      params.set('repository', gateEvalRepo.trim());
      if (branchFilter) params.set('branch', branchFilter);
      params.set('triggeredBy', 'dashboard');
      const resp = await fetch(apiUrl(`/deployment-gate/evaluate?${params}`), { headers: authHeaders() });
      const data = await resp.json();
      setGateEvalResult({ status: resp.status, ...data });
      fetchGateHistory();
      if (resp.ok) toast.success(`Gate PASSED for ${gateEvalRepo}`);
      else toast.error(`Gate FAILED for ${gateEvalRepo}`);
    } catch {
      toast.error('Failed to evaluate deployment gate');
    } finally {
      setGateEvaluating(false);
    }
  }, [gateEvalRepo, branchFilter, fetchGateHistory]);

  // ── Audit Trail ───────────────────────────────────────────────────────────
  const fetchAuditLog = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (auditFilter) params.set('entity', auditFilter);
      const resp = await fetch(apiUrl(`/audit/log?${params}`), { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        setAuditLog(data.entries || []);
      }
    } catch { /* silent */ }
  }, [auditFilter]);

  const fetchAuditStats = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/audit/stats'), { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        setAuditStats(data.stats);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchAuditStats(); }, [fetchAuditStats]);
  useEffect(() => { fetchAuditLog(); }, [fetchAuditLog]);

  const exportAuditLog = useCallback(async (format: 'csv' | 'json') => {
    try {
      const resp = await fetch(apiUrl(`/audit/export?format=${format}`), { headers: authHeaders() });
      if (resp.ok) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Audit log exported as ${format.toUpperCase()}`);
      }
    } catch { toast.error('Failed to export audit log'); }
  }, []);

  // ── Model Evaluation ──────────────────────────────────────────────────────
  const fetchEvalSuites = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/model-eval/suites'), { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        setEvalSuites(data.suites || {});
      }
    } catch { /* silent */ }
  }, []);

  const fetchEvalRuns = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/model-eval/runs?limit=20'), { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        setEvalRuns(data.runs || []);
      }
    } catch { /* silent */ }
  }, []);

  const fetchEvalStats = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl('/model-eval/stats'), { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        setEvalStats(data.stats);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchEvalSuites(); fetchEvalRuns(); fetchEvalStats(); }, [fetchEvalSuites, fetchEvalRuns, fetchEvalStats]);

  const runEvaluation = useCallback(async () => {
    setEvalRunning(true);
    setEvalRunDetail(null);
    try {
      const resp = await fetch(apiUrl('/model-eval/run'), {
        method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ suiteId: evalSuiteId, provider: evalProvider }),
      });
      const data = await resp.json();
      if (resp.ok && data.run) {
        setEvalRunDetail(data.run);
        fetchEvalRuns();
        fetchEvalStats();
        toast.success(`Evaluation complete: ${data.run.passed}/${data.run.totalTests} passed`);
      } else {
        toast.error(data.error || 'Evaluation failed');
      }
    } catch {
      toast.error('Failed to run evaluation');
    } finally {
      setEvalRunning(false);
    }
  }, [evalSuiteId, evalProvider, fetchEvalRuns, fetchEvalStats]);

  const fetchRunDetail = useCallback(async (runId: string) => {
    try {
      const resp = await fetch(apiUrl(`/model-eval/runs/${runId}`), { headers: authHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        setEvalRunDetail(data.run);
      }
    } catch { /* silent */ }
  }, []);

  const exportLedger = useCallback(async (format: 'csv' | 'json') => {
    try {
      const params = new URLSearchParams();
      params.set('format', format);
      if (repoFilter) params.set('repository', repoFilter);
      if (branchFilter) params.set('branch', branchFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (ticketStatusFilter !== 'all') params.set('ticketStatus', ticketStatusFilter);
      if (ticketTargetFilter) params.set('ticketTarget', ticketTargetFilter);
      if (slaBreachedFilter) params.set('slaBreached', 'true');
      const resp = await fetch(apiUrl(`/analytics/violations/export?${params}`), { headers: authHeaders() });
      if (!resp.ok) throw new Error('export_failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-ledger-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Compliance ledger exported as ${format.toUpperCase()}`);
    } catch {
      toast.error('Failed to export compliance ledger');
    }
  }, [repoFilter, branchFilter, categoryFilter, ticketStatusFilter, ticketTargetFilter, slaBreachedFilter]);

  const generateTicket = useCallback(async (scanId: string, category: string, target: 'jira' | 'linear' | 'github') => {
    const rowKey = `${scanId}-${category}`;
    setTicketLoading(rowKey);
    setTicketPayload(null);
    setTicketRowKey(rowKey);
    try {
      const resp = await fetch(apiUrl('/analytics/violations/ticket-payload'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId, category, target }),
      });
      if (!resp.ok) throw new Error('ticket_failed');
      const data = await resp.json();
      setTicketPayload(data.payload);
      toast.success(`${target.charAt(0).toUpperCase() + target.slice(1)} ticket payload generated`);
    } catch {
      toast.error('Failed to generate ticket payload');
    } finally {
      setTicketLoading(null);
    }
  }, []);

  const copyTicketPayload = useCallback(() => {
    if (!ticketPayload) return;
    navigator.clipboard.writeText(JSON.stringify(ticketPayload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Ticket payload copied to clipboard');
  }, [ticketPayload]);

  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    try {
      const params = new URLSearchParams();
      params.set('format', format);
      params.set('days', String(days));
      if (repoFilter) params.set('repository', repoFilter);
      if (branchFilter) params.set('branch', branchFilter);
      const resp = await fetch(apiUrl(`/analytics/export?${params}`), { headers: authHeaders() });
      if (!resp.ok) throw new Error('export_failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-export-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error(`Failed to export ${format.toUpperCase()}`);
    }
  }, [days, repoFilter, branchFilter]);

  const severityData = stats ? [
    { name: 'Critical', value: stats.severityTotals.critical, fill: SEVERITY_COLORS.critical },
    { name: 'High', value: stats.severityTotals.high, fill: SEVERITY_COLORS.high },
    { name: 'Medium', value: stats.severityTotals.medium, fill: SEVERITY_COLORS.medium },
    { name: 'Low', value: stats.severityTotals.low, fill: SEVERITY_COLORS.low },
  ].filter(d => d.value > 0) : [];

  const languageData = stats ? Object.entries(stats.languageBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value })) : [];

  const heatmapData = heatmap.slice(0, 10).map(h => ({
    category: h.category.length > 20 ? h.category.slice(0, 18) + '...' : h.category,
    fullName: h.category,
    findings: h.totalFindings,
  }));

  const avgPosture = stats?.avgPostureScore ?? 0;
  const postureColor = avgPosture >= 80 ? '#36A64F'
    : avgPosture >= 60 ? '#FFAA00'
    : avgPosture >= 40 ? '#FF6600'
    : '#FF0000';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Usage Analytics</h3>
          <p className="text-sm text-muted-foreground">
            Scan volumes, violation trends, and compliance posture across all tenants
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={repoFilter}
            onChange={(e) => { setRepoFilter(e.target.value); setBranchFilter(''); }}
          >
            <option value="">All Repositories</option>
            {repoOptions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            disabled={!repoFilter && branchOptions.length === 0}
          >
            <option value="">All Branches</option>
            {branchOptions.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as any)}
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={loading}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('json')} disabled={loading}>
            <FileJson className="h-4 w-4" /> JSON
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalScans ?? '—'}</div>
            <p className="text-xs text-muted-foreground">{stats?.totalOrgs ?? 0} organizations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Files Analyzed</CardTitle>
            <FileCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalFilesAnalyzed != null
                ? stats.totalFilesAnalyzed.toLocaleString()
                : '—'}
            </div>
            <p className="text-xs text-muted-foreground">across all scans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Findings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalFindings != null
                ? stats.totalFindings.toLocaleString()
                : '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.severityTotals.critical ?? 0} critical, {stats?.severityTotals.high ?? 0} high
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Posture Score</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: postureColor }}>
              {stats?.avgPostureScore ?? '—'}
            </div>
            <p className="text-xs text-muted-foreground">out of 100</p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scan Activity Over Time</CardTitle>
            <CardDescription>Files analyzed and findings per {granularity}</CardDescription>
          </CardHeader>
          <CardContent>
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="filesAnalyzed" stroke="#4A90D9" fill="#4A90D9" fillOpacity={0.3} name="Files" />
                  <Area type="monotone" dataKey="totalFindings" stroke="#FF6600" fill="#FF6600" fillOpacity={0.3} name="Findings" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compliance Posture Trend</CardTitle>
            <CardDescription>Average posture score per {granularity}</CardDescription>
          </CardHeader>
          <CardContent>
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avgPosture" stroke="#36A64F" strokeWidth={2} name="Posture Score" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
                No posture data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Severity & Language Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Severity Distribution</CardTitle>
            <CardDescription>Findings by severity level</CardDescription>
          </CardHeader>
          <CardContent>
            {severityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={severityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {severityData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[220px] items-center justify-center text-muted-foreground text-sm">
                No severity data
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Language Breakdown</CardTitle>
            <CardDescription>Files analyzed by programming language</CardDescription>
          </CardHeader>
          <CardContent>
            {languageData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={languageData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#4A90D9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[220px] items-center justify-center text-muted-foreground text-sm">
                No language data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Violation Heatmap & Top Repositories */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Violation Heatmap by Category</CardTitle>
            <CardDescription>Top categories by total findings</CardDescription>
          </CardHeader>
          <CardContent>
            {heatmapData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={heatmapData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="findings" fill="#FF6600" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
                No heatmap data
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Repositories</CardTitle>
            <CardDescription>Most frequently scanned repositories</CardDescription>
          </CardHeader>
          <CardContent>
            {repositories.length > 0 ? (
              <div className="space-y-2">
                {repositories.map((repo, i) => (
                  <div key={repo.name} className="flex items-center justify-between rounded-md border p-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{i + 1}</Badge>
                      <span className="text-sm font-medium truncate max-w-[200px]">{repo.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{repo.scans} scans</span>
                      <span>{repo.findings.toLocaleString()} findings</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
                No repository data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Violations Table with Remediation Guidance */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4" /> Violations & Remediation Guidance
              </CardTitle>
              <CardDescription>
                {violationsTotal > 0
                  ? `${violationsTotal} violation entries — click a row to expand remediation steps`
                  : 'No violation data available'}
              </CardDescription>
            </div>
            {violationsTotal > 0 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => exportLedger('csv')}>
                  <Download className="h-3 w-3" /> Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportLedger('json')}>
                  <FileJson className="h-3 w-3" /> Export JSON
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Remediation Summary Panel */}
          {violationSummary && violationSummary.totalViolations > 0 && (
            <div className="mb-4 p-4 rounded-lg border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Remediation Coverage</span>
                <span className={`text-2xl font-bold ${violationSummary.coverage >= 75 ? 'text-green-600' : violationSummary.coverage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {violationSummary.coverage}%
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">Ticketed: <span className="font-medium text-foreground">{violationSummary.ticketedViolations}</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-orange-400" />
                  <span className="text-muted-foreground">Unticketed: <span className="font-medium text-foreground">{violationSummary.unticketedViolations}</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-blue-400" />
                  <span className="text-muted-foreground">Total: <span className="font-medium text-foreground">{violationSummary.totalViolations}</span></span>
                </div>
                {violationSummary.slaBreachedCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-muted-foreground">SLA Breached: <span className="font-medium text-red-600 dark:text-red-400">{violationSummary.slaBreachedCount}</span></span>
                  </div>
                )}
              </div>
              {/* Overall progress bar */}
              <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                <div className="bg-green-500 h-full" style={{ width: `${violationSummary.coverage}%` }} />
                <div className="bg-orange-400 h-full flex-1" />
              </div>
              {/* Per-category breakdown */}
              {violationSummary.categories.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Per-Category Coverage</span>
                    {categoryFilter && (
                      <button
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        onClick={() => { setCategoryFilter(''); setViolationsPage(0); }}
                      >
                        Clear category filter ({categoryFilter}) ×
                      </button>
                    )}
                    {!categoryFilter && (
                      <span className="text-xs text-muted-foreground italic">Click a category to filter the table below</span>
                    )}
                  </div>
                  {violationSummary.categories.slice(0, 8).map((cat) => {
                    const isActive = categoryFilter === cat.category;
                    return (
                    <div
                      key={cat.category}
                      className={`flex items-center gap-2 text-xs cursor-pointer rounded px-1 py-0.5 transition-colors ${isActive ? 'bg-blue-500/10 ring-1 ring-blue-500/30' : 'hover:bg-muted/50'}`}
                      onClick={() => {
                        setCategoryFilter(isActive ? '' : cat.category);
                        setViolationsPage(0);
                      }}
                    >
                      <span className={`w-48 truncate ${isActive ? 'font-medium text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`} title={cat.category}>{cat.category}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden flex">
                        <div className="bg-green-500 h-full" style={{ width: `${cat.coverage}%` }} />
                      </div>
                      <span className="w-20 text-right tabular-nums text-muted-foreground">
                        {cat.ticketed}/{cat.total} ({cat.coverage}%)
                      </span>
                      {cat.slaBreached > 0 && (
                        <span className="text-xs text-red-600 dark:text-red-400 font-medium" title="SLA breached violations">
                          ⚠{cat.slaBreached}
                        </span>
                      )}
                    </div>
                    );
                  })}
                  {violationSummary.categories.length > 8 && (
                    <span className="text-xs text-muted-foreground italic">+{violationSummary.categories.length - 8} more categories...</span>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Ticket Status Filters */}
          <div className="flex items-center gap-3 pb-3 mb-2 border-b flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">Status:</label>
              <select
                className="flex h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                value={ticketStatusFilter}
                onChange={(e) => { setTicketStatusFilter(e.target.value as any); setViolationsPage(0); }}
              >
                <option value="all">All Violations</option>
                <option value="unticketed">Unticketed Only</option>
                <option value="ticketed">Ticketed Only</option>
              </select>
            </div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded"
                checked={slaBreachedFilter}
                onChange={(e) => { setSlaBreachedFilter(e.target.checked); setViolationsPage(0); }}
              />
              <Clock className="h-3 w-3" /> SLA Breached Only
            </label>
            {ticketStatusFilter === 'ticketed' && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">Target:</label>
                <select
                  className="flex h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                  value={ticketTargetFilter}
                  onChange={(e) => { setTicketTargetFilter(e.target.value); setViolationsPage(0); }}
                >
                  <option value="">All Targets</option>
                  <option value="jira">Jira</option>
                  <option value="linear">Linear</option>
                  <option value="github">GitHub</option>
                </select>
              </div>
            )}
          </div>
          {/* Bulk Action Bar */}
          {selectedRows.size > 0 && (
            <div className="flex items-center gap-3 p-3 mb-2 rounded-lg border bg-primary/5">
              <span className="text-sm font-medium">{selectedRows.size} selected</span>
              <input
                type="text"
                placeholder="Paste shared ticket URL or ID..."
                value={bulkTicketRef}
                onChange={(e) => setBulkTicketRef(e.target.value)}
                className="flex h-8 w-64 rounded-md border border-input bg-transparent px-2 py-1 text-xs"
              />
              <Button
                variant="default"
                size="sm"
                disabled={!bulkTicketRef.trim() || bulkLoading}
                onClick={bulkMarkTicketed}
              >
                {bulkLoading ? 'Processing...' : 'Bulk Mark Ticketed'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={bulkLoading}
                onClick={bulkUnmarkTicketed}
              >
                Bulk Remove Ticket Status
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRows(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          )}
          {violations.length > 0 ? (
            <div className="space-y-1">
              {/* Header row */}
              <div className="grid grid-cols-[auto_auto_1fr_auto_auto_auto] gap-3 text-xs font-medium text-muted-foreground pb-2 border-b items-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded"
                  checked={selectedRows.size === violations.length && violations.length > 0}
                  onChange={toggleSelectAll}
                />
                <span className="w-6" />
                <span>Category</span>
                <span className="text-right">Count</span>
                <span className="text-center">Priority</span>
                <span className="text-right">Posture</span>
              </div>
              {violations.map((v) => {
                const rowKey = `${v.scanId}-${v.category}`;
                const isExpanded = expandedRow === rowKey;
                const priorityColor = v.remediation.priority === 'critical' ? 'bg-red-500'
                  : v.remediation.priority === 'high' ? 'bg-orange-500'
                  : v.remediation.priority === 'medium' ? 'bg-yellow-500'
                  : 'bg-blue-500';
                const isTicketed = v.ticketed;
                const ticketKey = `${v.scanId}::${v.category}`;
                const isSelected = selectedRows.has(ticketKey);
                const isSlaBreached = v.slaBreached;
                return (
                  <div key={rowKey} className={`rounded-md ${isTicketed ? 'bg-green-500/5 border border-green-500/20' : ''} ${isSlaBreached ? 'bg-red-500/5 border border-red-500/20' : ''} ${isSelected ? 'ring-2 ring-primary/30' : ''}`}>
                    <div
                      className="grid grid-cols-[auto_auto_1fr_auto_auto_auto] gap-3 items-center py-2 px-2 rounded-md hover:bg-muted/50 cursor-pointer text-sm"
                      onClick={() => setExpandedRow(isExpanded ? null : rowKey)}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded"
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleRowSelection(ticketKey)}
                      />
                      <span className="w-6 flex items-center justify-center">
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{v.category}</span>
                          {isTicketed && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                              <Ticket className="h-3 w-3" /> Ticketed
                            </span>
                          )}
                          {isSlaBreached && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400" title={`SLA breached by ${v.slaDaysOver} day${v.slaDaysOver !== 1 ? 's' : ''} (limit: ${v.slaLimit}d for ${v.remediation.priority})`}>
                              <Clock className="h-3 w-3" /> SLA +{v.slaDaysOver}d
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {v.repository} · {v.branch} · {new Date(v.timestamp).toLocaleDateString()}
                          <span className="ml-1 text-muted-foreground/70">· {v.daysOpen}d open</span>
                          {isTicketed && v.ticketRef && (
                            <span className="ml-2 text-green-600 dark:text-green-400">
                              · <a href={v.ticketRef} target="_blank" rel="noopener noreferrer" className="underline">{v.ticketRef}</a>
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-right font-medium tabular-nums">{v.count}</span>
                      <span className="flex justify-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white ${priorityColor}`}>
                          {v.remediation.priority}
                        </span>
                      </span>
                      <span className="text-right tabular-nums text-muted-foreground">{v.postureScore}</span>
                    </div>
                    {isExpanded && (
                      <div className="ml-9 mr-2 mb-2 p-3 rounded-md bg-muted/30 border text-sm space-y-2">
                        <div>
                          <span className="font-medium">Strategy: </span>
                          <Badge variant="outline" className="ml-1">{v.remediation.strategy}</Badge>
                        </div>
                        <p className="text-muted-foreground">{v.remediation.description}</p>
                        <div>
                          <span className="font-medium text-xs">Remediation Steps:</span>
                          <ol className="list-decimal list-inside mt-1 space-y-1 text-xs text-muted-foreground">
                            {v.remediation.steps.map((step, i) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ol>
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground pt-1 border-t">
                          <span>Scan: <code className="font-mono">{v.scanId}</code></span>
                          <span>Commit: <code className="font-mono">{v.commitSha}</code></span>
                          <span>Trigger: {v.triggeredBy}</span>
                          <span>Gate: {v.gateStatus}</span>
                        </div>
                        {/* Ticket Integration */}
                        <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
                          <Ticket className="h-4 w-4 text-muted-foreground" />
                          <select
                            className="flex h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                            value={ticketTarget}
                            onChange={(e) => { setTicketTarget(e.target.value as any); setTicketPayload(null); }}
                          >
                            <option value="jira">Jira</option>
                            <option value="linear">Linear</option>
                            <option value="github">GitHub Issue</option>
                          </select>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={ticketLoading === rowKey}
                            onClick={() => generateTicket(v.scanId, v.category, ticketTarget)}
                          >
                            {ticketLoading === rowKey ? 'Generating...' : 'Generate Ticket'}
                          </Button>
                          {ticketPayload && ticketRowKey === rowKey && (
                            <>
                              <Button variant="outline" size="sm" onClick={copyTicketPayload}>
                                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                {copied ? 'Copied!' : 'Copy JSON'}
                              </Button>
                            </>
                          )}
                          <div className="flex items-center gap-2 ml-auto">
                            <Button
                              variant="default"
                              size="sm"
                              disabled={dispatchingRow === rowKey}
                              onClick={() => dispatchTicket(v.scanId, v.category, ticketTarget)}
                            >
                              {dispatchingRow === rowKey ? 'Dispatching...' : (<><Send className="h-3 w-3" /> Dispatch</>)}
                            </Button>
                            {webhookConfigs[ticketTarget] ? (
                              <span className="text-xs text-green-600 dark:text-green-400" title={webhookConfigs[ticketTarget].apiUrl}>
                                ● Configured
                              </span>
                            ) : (
                              <Button variant="ghost" size="sm" onClick={() => { setShowWebhookConfig(true); setWebhookForm(prev => ({ ...prev, target: ticketTarget })); }}>
                                <Settings className="h-3 w-3" /> Configure
                              </Button>
                            )}
                          </div>
                        </div>
                        {ticketPayload && ticketRowKey === rowKey && (
                          <pre className="text-xs bg-muted/50 rounded-md p-2 overflow-x-auto max-h-48 border">
                            {JSON.stringify(ticketPayload, null, 2)}
                          </pre>
                        )}
                        {/* Mark as Ticketed */}
                        <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
                          {isTicketed ? (
                            <>
                              <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">
                                <Ticket className="h-3 w-3 mr-1" /> {v.ticketTarget} · {v.ticketMarkedAt?.slice(0, 10)}
                              </Badge>
                              <Button variant="outline" size="sm" onClick={() => unmarkTicketed(v.scanId, v.category)}>
                                <X className="h-3 w-3" /> Remove Ticket Status
                              </Button>
                            </>
                          ) : (
                            <>
                              <Link2 className="h-4 w-4 text-muted-foreground" />
                              <input
                                type="text"
                                placeholder="Paste ticket URL or ID..."
                                value={ticketRefInput}
                                onChange={(e) => setTicketRefInput(e.target.value)}
                                className="flex h-8 w-64 rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!ticketRefInput.trim() || markingRow === rowKey}
                                onClick={() => markTicketed(v.scanId, v.category, ticketRefInput.trim(), ticketTarget)}
                              >
                                {markingRow === rowKey ? 'Marking...' : 'Mark as Ticketed'}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Webhook Configuration Modal */}
              {showWebhookConfig && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowWebhookConfig(false)}>
                  <div className="bg-background rounded-lg border shadow-lg p-6 w-full max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-medium">Webhook Configuration</h3>
                      <Button variant="ghost" size="sm" onClick={() => setShowWebhookConfig(false)}><X className="h-4 w-4" /></Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Configure the API endpoint and credentials for direct ticket dispatch. Auth tokens are stored locally and masked in API responses.</p>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Target Platform</label>
                        <select
                          className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1"
                          value={webhookForm.target}
                          onChange={(e) => setWebhookForm(prev => ({ ...prev, target: e.target.value }))}
                        >
                          <option value="jira">Jira</option>
                          <option value="linear">Linear</option>
                          <option value="github">GitHub Issues</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">API URL</label>
                        <input
                          type="text"
                          placeholder={webhookForm.target === 'jira' ? 'https://yourorg.atlassian.net/rest/api/2/issue' : webhookForm.target === 'linear' ? 'https://api.linear.app/graphql' : 'https://api.github.com/repos/{owner}/{repo}/issues'}
                          value={webhookForm.apiUrl}
                          onChange={(e) => setWebhookForm(prev => ({ ...prev, apiUrl: e.target.value }))}
                          className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Auth Token / API Key</label>
                        <input
                          type="password"
                          placeholder="Paste your API token or PAT..."
                          value={webhookForm.authToken}
                          onChange={(e) => setWebhookForm(prev => ({ ...prev, authToken: e.target.value }))}
                          className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1"
                        />
                      </div>
                      {webhookForm.target === 'jira' && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Project Key (e.g. SEC)</label>
                          <input
                            type="text"
                            placeholder="SEC"
                            value={webhookForm.projectKey}
                            onChange={(e) => setWebhookForm(prev => ({ ...prev, projectKey: e.target.value }))}
                            className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1"
                          />
                        </div>
                      )}
                      {webhookForm.target === 'linear' && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Team ID (optional)</label>
                          <input
                            type="text"
                            placeholder="team-uuid"
                            value={webhookForm.teamId}
                            onChange={(e) => setWebhookForm(prev => ({ ...prev, teamId: e.target.value }))}
                            className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1"
                          />
                        </div>
                      )}
                      {webhookForm.target === 'github' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Repo Owner</label>
                            <input
                              type="text"
                              placeholder="org-name"
                              value={webhookForm.repoOwner}
                              onChange={(e) => setWebhookForm(prev => ({ ...prev, repoOwner: e.target.value }))}
                              className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Repo Name</label>
                            <input
                              type="text"
                              placeholder="repo-name"
                              value={webhookForm.repoName}
                              onChange={(e) => setWebhookForm(prev => ({ ...prev, repoName: e.target.value }))}
                              className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex gap-2">
                        {webhookConfigs[webhookForm.target] && (
                          <Button variant="outline" size="sm" onClick={() => deleteWebhookConfig(webhookForm.target)}>
                            <X className="h-3 w-3" /> Delete Config
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setShowWebhookConfig(false)}>Cancel</Button>
                        <Button size="sm" onClick={saveWebhookConfig} disabled={!webhookForm.apiUrl.trim()}>
                          <Settings className="h-3 w-3" /> Save Configuration
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Pagination */}
              {violationsTotal > violationsPageSize && (
                <div className="flex items-center justify-between pt-3 border-t">
                  <span className="text-xs text-muted-foreground">
                    Showing {violationsPage * violationsPageSize + 1}–{Math.min((violationsPage + 1) * violationsPageSize, violationsTotal)} of {violationsTotal}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={violationsPage === 0}
                      onClick={() => setViolationsPage(p => Math.max(0, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={(violationsPage + 1) * violationsPageSize >= violationsTotal}
                      onClick={() => setViolationsPage(p => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground text-sm">
              No violations data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Automated Report Delivery */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Automated Report Delivery</CardTitle>
              <CardDescription>Schedule recurring compliance ledger reports delivered to SecOps mailboxes</CardDescription>
            </div>
            <Button size="sm" onClick={() => { setScheduleForm({ id: '', name: '', enabled: true, frequency: 'weekly', dayOfWeek: 1, dayOfMonth: 1, hour: 8, minute: 0, format: 'csv', recipients: '', filters: '' }); setShowScheduleModal(true); }}>
              <Calendar className="h-3 w-3" /> New Schedule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(reportSchedules).length === 0 ? (
            <div className="flex h-[100px] items-center justify-center text-muted-foreground text-sm">
              No report schedules configured. Click "New Schedule" to create one.
            </div>
          ) : (
            <div className="space-y-2">
              {Object.values(reportSchedules).map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-md border bg-muted/20">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{s.name}</span>
                      <Badge variant="outline" className={s.enabled ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30' : 'bg-muted text-muted-foreground'}>
                        {s.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                      <Badge variant="outline">{s.frequency}</Badge>
                      <Badge variant="outline">{s.format.toUpperCase()}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.frequency === 'weekly' && `Every ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][s.dayOfWeek]} `}
                      {s.frequency === 'monthly' && `Day ${s.dayOfMonth} of each month `}
                      {s.frequency === 'daily' && 'Daily '}
                      at {String(s.hour).padStart(2,'0')}:{String(s.minute).padStart(2,'0')} UTC
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Recipients: {s.recipients.join(', ')}
                    </div>
                    {s.lastRunAt && (
                      <div className="text-xs text-muted-foreground">
                        Last run: {s.lastRunAt.slice(0,19).replace('T',' ')} — {s.lastRunStatus}
                        {s.lastRunError && ` (${s.lastRunError})`}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={scheduleRunning === s.id}
                      onClick={() => runReportSchedule(s.id)}
                    >
                      {scheduleRunning === s.id ? 'Running...' : 'Run Now'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setScheduleForm({
                          id: s.id, name: s.name, enabled: s.enabled, frequency: s.frequency,
                          dayOfWeek: s.dayOfWeek, dayOfMonth: s.dayOfMonth, hour: s.hour, minute: s.minute,
                          format: s.format, recipients: s.recipients.join(', '),
                          filters: Object.entries(s.filters || {}).map(([k,v]) => `${k}:${v}`).join(', '),
                        });
                        setShowScheduleModal(true);
                      }}
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label="Delete report schedule" onClick={() => deleteReportSchedule(s.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Configuration Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowScheduleModal(false)}>
          <div className="bg-background rounded-lg border shadow-lg p-6 w-full max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium">Report Schedule</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowScheduleModal(false)}><X className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground">Configure a recurring compliance report that generates the 22-column ledger and emails it to the specified recipients. Without SMTP configuration, reports are saved as stub files on disk.</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Schedule ID</label>
                  <input
                    type="text"
                    placeholder="weekly-secops"
                    value={scheduleForm.id}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, id: e.target.value }))}
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Display Name</label>
                  <input
                    type="text"
                    placeholder="Weekly SecOps Report"
                    value={scheduleForm.name}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, name: e.target.value }))}
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Frequency</label>
                  <select
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1"
                    value={scheduleForm.frequency}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, frequency: e.target.value as any }))}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Format</label>
                  <select
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1"
                    value={scheduleForm.format}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, format: e.target.value as any }))}
                  >
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Enabled</label>
                  <select
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1"
                    value={scheduleForm.enabled ? 'true' : 'false'}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, enabled: e.target.value === 'true' }))}
                  >
                    <option value="true">Active</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
              </div>
              {scheduleForm.frequency === 'weekly' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Day of Week</label>
                  <select
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1"
                    value={scheduleForm.dayOfWeek}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, dayOfWeek: Number(e.target.value) }))}
                  >
                    {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              )}
              {scheduleForm.frequency === 'monthly' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Day of Month</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={scheduleForm.dayOfMonth}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, dayOfMonth: Number(e.target.value) }))}
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Hour (UTC)</label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={scheduleForm.hour}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, hour: Number(e.target.value) }))}
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Minute</label>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={scheduleForm.minute}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, minute: Number(e.target.value) }))}
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Recipients (comma-separated emails)</label>
                <input
                  type="text"
                  placeholder="secops@company.com, ciso@company.com"
                  value={scheduleForm.recipients}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, recipients: e.target.value }))}
                  className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Filters (comma-separated key:value pairs, optional)</label>
                <input
                  type="text"
                  placeholder="repository:myrepo, slaBreached:true"
                  value={scheduleForm.filters}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, filters: e.target.value }))}
                  className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowScheduleModal(false)}>Cancel</Button>
              <Button size="sm" onClick={saveReportSchedule}>
                <Calendar className="h-3 w-3" /> Save Schedule
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Deployment Gate Panel */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" /> CI/CD Deployment Gate
          </CardTitle>
          <CardDescription className="text-xs">
            Evaluate scan posture against organizational policy thresholds. Returns pass/fail for CI/CD pipeline integration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Evaluate Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="repository name (e.g. my-org/my-repo)"
                value={gateEvalRepo}
                onChange={(e) => setGateEvalRepo(e.target.value)}
                className="flex h-8 flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                onKeyDown={(e) => { if (e.key === 'Enter') evaluateGate(); }}
              />
              <Button size="sm" onClick={evaluateGate} disabled={gateEvaluating}>
                {gateEvaluating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                Evaluate
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowGatePolicyModal(true)}>
                <Settings className="h-3 w-3" /> Policy
              </Button>
            </div>

            {/* Evaluation Result */}
            {gateEvalResult && (
              <div className={`p-3 rounded-lg border ${gateEvalResult.pass ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {gateEvalResult.pass ? (
                    <><Check className="h-4 w-4 text-green-600" /><span className="font-medium text-green-600">PASSED</span></>
                  ) : (
                    <><X className="h-4 w-4 text-red-600" /><span className="font-medium text-red-600">FAILED</span></>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    Posture: {gateEvalResult.scan?.postureScore ?? 'N/A'} · Gate: {gateEvalResult.scan?.gateStatus ?? 'N/A'}
                  </span>
                </div>
                {gateEvalResult.failures?.length > 0 && (
                  <div className="space-y-1">
                    {gateEvalResult.failures.map((f: any, i: number) => (
                      <div key={i} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span><strong>{f.rule}</strong>: {f.message}</span>
                      </div>
                    ))}
                  </div>
                )}
                {gateEvalResult.scan && (
                  <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                    Scan: {gateEvalResult.scan.scanId} · {gateEvalResult.scan.repository}@{gateEvalResult.scan.branch || 'N/A'}
                    {gateEvalResult.scan.commitSha && ` · ${gateEvalResult.scan.commitSha.slice(0, 7)}`}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Policy Summary */}
          <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Active Policy Thresholds</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div><span className="text-muted-foreground">Min Posture:</span> <span className="font-medium">{gatePolicy.minPostureScore ?? 70}</span></div>
              <div><span className="text-muted-foreground">Max Critical:</span> <span className="font-medium">{gatePolicy.maxCritical ?? 0}</span></div>
              <div><span className="text-muted-foreground">Max High:</span> <span className="font-medium">{gatePolicy.maxHigh ?? 5}</span></div>
              <div><span className="text-muted-foreground">Max Medium:</span> <span className="font-medium">{gatePolicy.maxMedium ?? 20}</span></div>
              <div><span className="text-muted-foreground">Max Low:</span> <span className="font-medium">{gatePolicy.maxLow ?? 50}</span></div>
              <div><span className="text-muted-foreground">Block on Gate Fail:</span> <span className="font-medium">{gatePolicy.blockOnGateFail ? 'Yes' : 'No'}</span></div>
              <div><span className="text-muted-foreground">Block on SLA:</span> <span className="font-medium">{gatePolicy.blockOnSlaBreached ? 'Yes' : 'No'}</span></div>
              <div><span className="text-muted-foreground">Block Unticketed Critical:</span> <span className="font-medium">{gatePolicy.blockOnUnticketedCritical ? 'Yes' : 'No'}</span></div>
            </div>
          </div>

          {/* Recent Evaluations */}
          {gateHistory.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Recent Gate Evaluations</span>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {gateHistory.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-muted/30">
                    {h.pass ? (
                      <Check className="h-3 w-3 text-green-600 shrink-0" />
                    ) : (
                      <X className="h-3 w-3 text-red-600 shrink-0" />
                    )}
                    <span className="truncate flex-1">{h.repository || 'N/A'}@{h.branch || 'N/A'}</span>
                    <span className="text-muted-foreground tabular-nums">Score: {h.postureScore ?? 'N/A'}</span>
                    {h.failures?.length > 0 && (
                      <span className="text-red-600 dark:text-red-400">{h.failures.length} failure(s)</span>
                    )}
                    <span className="text-muted-foreground text-[10px]">{new Date(h.evaluatedAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CI Integration Snippet */}
          <div className="p-3 rounded-lg border bg-muted/10">
            <span className="text-xs font-medium text-muted-foreground">GitHub Actions Integration</span>
            <pre className="text-[10px] mt-1 p-2 rounded bg-muted/30 overflow-x-auto text-muted-foreground">
{`- name: Simplebeacon Deployment Gate
  run: |
    RESULT=$(curl -s -w "\\n%{http_code}" \\
      -H "Authorization: Bearer $\{{{ secrets.SIMPLEBEACON_TOKEN \}}}" \\
      "https://your-host/api/deployment-gate/evaluate?repository=$\{{{ github.repository \}}}&branch=$\{{{ github.ref_name \}}}")
    CODE=$(echo "$RESULT" | tail -1)
    if [ "$CODE" != "200" ]; then
      echo "Deployment gate FAILED"
      exit 1
    fi
    echo "Deployment gate PASSED"`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Gate Policy Configuration Modal */}
      {showGatePolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowGatePolicyModal(false)}>
          <div className="bg-background rounded-lg border shadow-lg p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium">Deployment Gate Policy</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowGatePolicyModal(false)}><X className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground">Configure organizational thresholds for CI/CD deployment gate evaluations. These thresholds are applied to all gate evaluations unless overridden by query parameters.</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Min Posture Score</label>
                  <input type="number" min={0} max={100} value={gatePolicyForm.minPostureScore}
                    onChange={(e) => setGatePolicyForm(prev => ({ ...prev, minPostureScore: parseInt(e.target.value, 10) || 0 }))}
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Max Critical</label>
                  <input type="number" min={0} value={gatePolicyForm.maxCritical}
                    onChange={(e) => setGatePolicyForm(prev => ({ ...prev, maxCritical: parseInt(e.target.value, 10) || 0 }))}
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Max High</label>
                  <input type="number" min={0} value={gatePolicyForm.maxHigh}
                    onChange={(e) => setGatePolicyForm(prev => ({ ...prev, maxHigh: parseInt(e.target.value, 10) || 0 }))}
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Max Medium</label>
                  <input type="number" min={0} value={gatePolicyForm.maxMedium}
                    onChange={(e) => setGatePolicyForm(prev => ({ ...prev, maxMedium: parseInt(e.target.value, 10) || 0 }))}
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Max Low</label>
                  <input type="number" min={0} value={gatePolicyForm.maxLow}
                    onChange={(e) => setGatePolicyForm(prev => ({ ...prev, maxLow: parseInt(e.target.value, 10) || 0 }))}
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm mt-1" />
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={gatePolicyForm.blockOnGateFail}
                    onChange={(e) => setGatePolicyForm(prev => ({ ...prev, blockOnGateFail: e.target.checked }))}
                    className="h-4 w-4 rounded" />
                  <span>Block if scan gate status is <strong>fail</strong></span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={gatePolicyForm.blockOnSlaBreached}
                    onChange={(e) => setGatePolicyForm(prev => ({ ...prev, blockOnSlaBreached: e.target.checked }))}
                    className="h-4 w-4 rounded" />
                  <span>Block on <strong>SLA-breached</strong> unticketed violations</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={gatePolicyForm.blockOnUnticketedCritical}
                    onChange={(e) => setGatePolicyForm(prev => ({ ...prev, blockOnUnticketedCritical: e.target.checked }))}
                    className="h-4 w-4 rounded" />
                  <span>Block on <strong>unticketed critical</strong> violations</span>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowGatePolicyModal(false)}>Cancel</Button>
              <Button size="sm" onClick={saveGatePolicy}>
                <ShieldCheck className="h-3 w-3" /> Save Policy
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail Panel */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4" /> Audit Trail & Change Ledger
          </CardTitle>
          <CardDescription className="text-xs">
            Immutable record of all administrative changes across ticket statuses, webhook configs, report schedules, and deployment gate policies.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats Summary */}
          {auditStats && (
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded border bg-muted/20">
                <div className="text-muted-foreground">Total Events</div>
                <div className="text-lg font-bold">{auditStats.total}</div>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <div className="text-muted-foreground">By Action</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(auditStats.byAction || {}).map(([action, count]: any) => (
                    <Badge key={action} variant="outline" className="text-[10px]">{action}: {count}</Badge>
                  ))}
                </div>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <div className="text-muted-foreground">By Entity</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(auditStats.byEntity || {}).map(([entity, count]: any) => (
                    <Badge key={entity} variant="secondary" className="text-[10px]">{entity}: {count}</Badge>
                  ))}
                </div>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <div className="text-muted-foreground">Top Actors</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(auditStats.recentActors || []).slice(0, 3).map((a: any) => (
                    <Badge key={a.actorId} variant="outline" className="text-[10px]">{a.actorEmail}: {a.count}</Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Filter + Export Controls */}
          <div className="flex items-center gap-2">
            <select
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
            >
              <option value="">All Entities</option>
              <option value="ticket_status">Ticket Status</option>
              <option value="webhook_config">Webhook Config</option>
              <option value="report_schedule">Report Schedule</option>
              <option value="deployment_gate_policy">Gate Policy</option>
            </select>
            <Button variant="outline" size="sm" onClick={() => fetchAuditLog()}>
              <RefreshCw className="h-3 w-3" /> Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={() => exportAuditLog('csv')}>
              <Download className="h-3 w-3" /> CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={() => exportAuditLog('json')}>
              <FileJson className="h-3 w-3" /> JSON
            </Button>
          </div>

          {/* Timeline */}
          {auditLog.length > 0 ? (
            <div className="max-h-96 overflow-y-auto space-y-1">
              {auditLog.map((entry, i) => (
                <div key={entry.id || i} className="flex items-start gap-3 p-2 rounded hover:bg-muted/30 border-l-2"
                  style={{ borderColor: entry.action === 'DELETE' ? '#ef4444' : entry.action === 'CREATE' ? '#22c55e' : entry.action === 'RUN' ? '#3b82f6' : '#a855f7' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-[10px] shrink-0">{entry.action}</Badge>
                      <span className="font-medium truncate">{entry.entity}</span>
                      <span className="text-muted-foreground truncate">{entry.entityId}</span>
                    </div>
                    {entry.changes?.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {entry.changes.slice(0, 3).map((c: any, j: number) => (
                          <div key={j} className="text-[10px] text-muted-foreground">
                            <strong>{c.field}</strong>: {JSON.stringify(c.oldValue)?.slice(0, 40)} → {JSON.stringify(c.newValue)?.slice(0, 40)}
                          </div>
                        ))}
                        {entry.changes.length > 3 && (
                          <div className="text-[10px] text-muted-foreground italic">+{entry.changes.length - 3} more changes</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-muted-foreground">{entry.actorEmail}</div>
                    <div className="text-[10px] text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">No audit entries found</div>
          )}
        </CardContent>
      </Card>

      {/* Model Evaluation Workspace Panel */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4" /> Model Evaluation Workspace
          </CardTitle>
          <CardDescription className="text-xs">
            Run adversarial test suites against LLM providers to benchmark bias, hallucination, injection resistance, and policy compliance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats Summary */}
          {evalStats && (
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded border bg-muted/20">
                <div className="text-muted-foreground">Total Runs</div>
                <div className="text-lg font-bold">{evalStats.totalRuns}</div>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <div className="text-muted-foreground">Pass Rate</div>
                <div className="text-lg font-bold">{evalStats.passRate}%</div>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <div className="text-muted-foreground">Tests Run</div>
                <div className="text-lg font-bold">{evalStats.totalTests}</div>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <div className="text-muted-foreground">By Provider</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(evalStats.byProvider || {}).map(([prov, count]: any) => (
                    <Badge key={prov} variant="outline" className="text-[10px]">{prov}: {count}</Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Category Breakdown */}
          {evalStats?.byCategory && Object.keys(evalStats.byCategory).length > 0 && (
            <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Category Breakdown</span>
              <div className="grid grid-cols-5 gap-2 text-xs">
                {Object.entries(evalStats.byCategory).map(([cat, data]: any) => (
                  <div key={cat} className="text-center">
                    <div className="text-muted-foreground capitalize">{cat.replace(/_/g, ' ')}</div>
                    <div className="font-medium">{data.passed}/{data.passed + data.failed}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Run Controls */}
          <div className="flex items-center gap-2">
            <select
              value={evalProvider}
              onChange={(e) => setEvalProvider(e.target.value)}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="ollama">Ollama (local)</option>
            </select>
            <select
              value={evalSuiteId}
              onChange={(e) => setEvalSuiteId(e.target.value)}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
            >
              {Object.values(evalSuites).map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <Button size="sm" onClick={runEvaluation} disabled={evalRunning}>
              {evalRunning ? <RefreshCw className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />}
              Run Evaluation
            </Button>
          </div>

          {/* Run Detail */}
          {evalRunDetail && (
            <div className="p-3 rounded-lg border space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline">{evalRunDetail.provider}</Badge>
                <Badge variant="secondary">{evalRunDetail.model}</Badge>
                <span className="font-medium">
                  {evalRunDetail.passed}/{evalRunDetail.totalTests} passed
                  ({evalRunDetail.totalTests > 0 ? Math.round((evalRunDetail.passed / evalRunDetail.totalTests) * 100) : 0}%)
                </span>
                <span className="text-muted-foreground ml-auto">{new Date(evalRunDetail.timestamp).toLocaleString()}</span>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {evalRunDetail.results?.map((r: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs p-1.5 rounded hover:bg-muted/30 border-l-2"
                    style={{ borderColor: r.passed ? '#22c55e' : r.error ? '#f59e0b' : '#ef4444' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {r.passed ? <Check className="h-3 w-3 text-green-600" /> : r.error ? <Clock className="h-3 w-3 text-amber-600" /> : <X className="h-3 w-3 text-red-600" />}
                        <span className="font-medium capitalize">{r.category?.replace(/_/g, ' ')}</span>
                        <span className="text-muted-foreground">Score: {r.score}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{r.reason}</div>
                      {r.response && (
                        <details className="mt-1">
                          <summary className="text-[10px] text-muted-foreground cursor-pointer">Response</summary>
                          <div className="text-[10px] mt-1 p-1.5 rounded bg-muted/20 whitespace-pre-wrap">{r.response.slice(0, 500)}</div>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Runs */}
          {evalRuns.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Recent Evaluation Runs</span>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {evalRuns.map((run, i) => (
                  <div key={run.id || i} className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-muted/30 cursor-pointer"
                    onClick={() => fetchRunDetail(run.id)}>
                    <Badge variant="outline" className="text-[10px] shrink-0">{run.provider}</Badge>
                    <span className="truncate flex-1">{run.model}</span>
                    <span className="tabular-nums">{run.passed}/{run.totalTests}</span>
                    <span className="text-muted-foreground text-[10px]">{new Date(run.timestamp).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
