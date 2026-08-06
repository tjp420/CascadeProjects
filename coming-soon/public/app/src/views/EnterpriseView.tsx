import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Building2, Users, Crown, Shield, CheckCircle2, Clock, Mail,
  UserPlus, Trash2, Download, FileText, AlertCircle, Key,
  Rocket, Copy, Server, Calendar, DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import { getApiBase } from '@/config';

interface EnterpriseOrg {
  orgId: string;
  companyName: string;
  adminEmail: string;
  tier: string;
  status: string;
  seatCount: number;
  seatsUsed: number;
  provisionedEmails: string[];
  contractValue: number | null;
  contractPeriodMonths: number;
  azureDevOpsOrgUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  trial: boolean;
  trialStartedAt?: string;
  trialExpiresAt?: string;
  apiKey?: string;
}

interface OnboardResponse {
  success: boolean;
  orgId: string;
  companyName: string;
  adminEmail: string;
  apiKey: string;
  seatCount: number;
  seatsUsed: number;
  provisionedEmails: string[];
  adminLicenseToken: string;
  expiresAt: string;
  azureDevOpsPipelineUrl: string;
}

interface TrialResponse {
  success: boolean;
  orgId: string;
  trial: boolean;
  trialDurationDays: number;
  trialExpiresAt: string;
  adminEmail: string;
  apiKey: string;
  seatCount: number;
  seatsUsed: number;
  adminLicenseToken: string;
  upgradeUrl: string;
}

interface AzureDevOpsResponse {
  success: boolean;
  orgId: string;
  pipelineYaml: string;
  instructions: string[];
  apiKey: string;
}

interface SeatResponse {
  success: boolean;
  email: string;
  licenseToken: string;
  seatsUsed: number;
  seatsRemaining: number;
}

function apiUrl(path: string): string {
  const base = getApiBase();
  return `${base}/api${path}`;
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied to clipboard`),
    () => toast.error('Failed to copy')
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function EnterpriseView() {
  const [activeTab, setActiveTab] = useState('organizations');
  const [orgs, setOrgs] = useState<EnterpriseOrg[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<EnterpriseOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Onboarding form state
  const [companyName, setCompanyName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [contactName, setContactName] = useState('');
  const [seatCount, setSeatCount] = useState(10);
  const [contractValue, setContractValue] = useState<number | ''>('');
  const [contractMonths, setContractMonths] = useState(12);
  const [azureDevOpsOrg, setAzureDevOpsOrg] = useState('');
  const [onboarding, setOnboarding] = useState(false);
  const [onboardResult, setOnboardResult] = useState<OnboardResponse | null>(null);

  // Trial form state
  const [trialCompany, setTrialCompany] = useState('');
  const [trialEmail, setTrialEmail] = useState('');
  const [trialSeats, setTrialSeats] = useState(5);
  const [trialing, setTrialing] = useState(false);
  const [trialResult, setTrialResult] = useState<TrialResponse | null>(null);

  // Seat management state
  const [newSeatEmail, setNewSeatEmail] = useState('');
  const [addingSeat, setAddingSeat] = useState(false);

  // Azure DevOps state
  const [azureConfig, setAzureConfig] = useState<AzureDevOpsResponse | null>(null);
  const [generatingAzure, setGeneratingAzure] = useState(false);
  const fetchErrorRef = useRef(false);

  const fetchOrgs = useCallback(async () => {
    if (fetchErrorRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/enterprise/organizations'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOrgs(data.organizations || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load organizations');
      if (err.message && /HTTP (401|403|404)/.test(err.message)) {
        fetchErrorRef.current = true;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const handleOnboard = async () => {
    if (!companyName.trim() || !adminEmail.trim()) {
      toast.error('Company name and admin email are required');
      return;
    }
    setOnboarding(true);
    try {
      const res = await fetch(apiUrl('/enterprise/onboard'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          adminEmail: adminEmail.trim(),
          contactName: contactName.trim() || undefined,
          seats: seatCount,
          contractValue: contractValue || undefined,
          contractPeriodMonths: contractMonths,
          azureDevOpsOrgUrl: azureDevOpsOrg.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      const data: OnboardResponse = await res.json();
      setOnboardResult(data);
      toast.success(`Organization "${data.companyName}" provisioned successfully`);
      fetchErrorRef.current = false;
      await fetchOrgs();
      setActiveTab('result');
    } catch (err: any) {
      toast.error(err.message || 'Onboarding failed');
    } finally {
      setOnboarding(false);
    }
  };

  const handleTrial = async () => {
    if (!trialCompany.trim() || !trialEmail.trim()) {
      toast.error('Company name and admin email are required');
      return;
    }
    setTrialing(true);
    try {
      const res = await fetch(apiUrl('/enterprise/trial'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: trialCompany.trim(),
          adminEmail: trialEmail.trim(),
          seatCount: trialSeats,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      const data: TrialResponse = await res.json();
      setTrialResult(data);
      toast.success(`30-day trial started for ${trialCompany}`);
      await fetchOrgs();
      setActiveTab('result');
    } catch (err: any) {
      toast.error(err.message || 'Trial provisioning failed');
    } finally {
      setTrialing(false);
    }
  };

  const handleAddSeat = async () => {
    if (!selectedOrg || !newSeatEmail.trim()) {
      toast.error('Email is required');
      return;
    }
    setAddingSeat(true);
    try {
      const res = await fetch(apiUrl(`/enterprise/organizations/${selectedOrg.orgId}/seats`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newSeatEmail.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      const data: SeatResponse = await res.json();
      toast.success(`Seat provisioned for ${data.email}`);
      setNewSeatEmail('');
      await fetchOrgs();
      if (selectedOrg) {
        const updated = { ...selectedOrg, seatsUsed: data.seatsUsed, provisionedEmails: [...selectedOrg.provisionedEmails, data.email] };
        setSelectedOrg(updated);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to add seat');
    } finally {
      setAddingSeat(false);
    }
  };

  const handleRemoveSeat = async (email: string) => {
    if (!selectedOrg) return;
    if (!confirm(`Remove ${email} from this organization?`)) return;
    try {
      const res = await fetch(apiUrl(`/enterprise/organizations/${selectedOrg.orgId}/seats/${encodeURIComponent(email)}`), {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      toast.success(`${email} removed`);
      await fetchOrgs();
      if (selectedOrg) {
        const updated = {
          ...selectedOrg,
          seatsUsed: data.seatsUsed,
          provisionedEmails: selectedOrg.provisionedEmails.filter(e => e !== email),
        };
        setSelectedOrg(updated);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove seat');
    }
  };

  const handleGenerateAzureConfig = async () => {
    if (!selectedOrg) return;
    setGeneratingAzure(true);
    try {
      const res = await fetch(apiUrl(`/enterprise/organizations/${selectedOrg.orgId}/azure-devops`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: '$(Build.SourcesDirectory)' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      const data: AzureDevOpsResponse = await res.json();
      setAzureConfig(data);
      toast.success('Azure DevOps pipeline template generated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate Azure DevOps config');
    } finally {
      setGeneratingAzure(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground">Loading enterprise organizations...</div>
      </div>
    );
  }

  if (error && orgs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={fetchOrgs}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Enterprise Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Provision enterprise organizations, manage seat pools, and configure Azure DevOps CI/CD pipelines
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <Server className="h-3.5 w-3.5" />
          {orgs.length} Organization{orgs.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="onboard">Onboard</TabsTrigger>
          <TabsTrigger value="trial">Start Trial</TabsTrigger>
          {onboardResult && <TabsTrigger value="result">Provisioning Result</TabsTrigger>}
        </TabsList>

        {/* ── Organizations Tab ── */}
        <TabsContent value="organizations" className="space-y-4">
          {orgs.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Building2 className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-center">
                    <h2 className="text-lg font-semibold">No Enterprise Organizations</h2>
                    <p className="text-muted-foreground mt-1">Onboard your first enterprise client or start a trial.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setActiveTab('onboard')}>
                      <Building2 className="h-4 w-4" /> Onboard Client
                    </Button>
                    <Button variant="outline" onClick={() => setActiveTab('trial')}>
                      <Rocket className="h-4 w-4" /> Start Trial
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Organization Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {orgs.map((org) => (
                  <Card
                    key={org.orgId}
                    className={selectedOrg?.orgId === org.orgId ? 'border-primary ring-1 ring-primary' : ''}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{org.companyName}</CardTitle>
                            <CardDescription className="text-xs">{org.orgId}</CardDescription>
                          </div>
                        </div>
                        {org.trial ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">
                            <Clock className="h-3 w-3 mr-1" /> Trial
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-300">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Admin</span>
                          <p className="font-medium truncate">{org.adminEmail}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Seats</span>
                          <p className="font-medium">{org.seatsUsed} / {org.seatCount}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Created</span>
                          <p className="font-medium">{formatDate(org.createdAt)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Expires</span>
                          <p className="font-medium">{formatDate(org.expiresAt)}</p>
                        </div>
                      </div>
                      {org.trial && org.trialExpiresAt && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Trial remaining</span>
                            <span className="font-medium">{daysUntil(org.trialExpiresAt)} days</span>
                          </div>
                          <Progress
                            value={Math.max(0, (daysUntil(org.trialExpiresAt) / 30) * 100)}
                            indicatorClassName={daysUntil(org.trialExpiresAt) < 7 ? 'bg-amber-500' : 'bg-primary'}
                          />
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setSelectedOrg(org);
                          setActiveTab('organizations');
                        }}
                      >
                        Manage Organization
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Selected Organization Detail */}
              {selectedOrg && (
                <div className="space-y-4">
                  {/* Seat Pool Management */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Seat Pool Management
                      </CardTitle>
                      <CardDescription>
                        {selectedOrg.seatsUsed} of {selectedOrg.seatCount} seats provisioned
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Progress
                        value={(selectedOrg.seatsUsed / selectedOrg.seatCount) * 100}
                        indicatorClassName={selectedOrg.seatsUsed >= selectedOrg.seatCount ? 'bg-destructive' : 'bg-primary'}
                      />

                      {/* Add Seat Form */}
                      {selectedOrg.seatsUsed < selectedOrg.seatCount && (
                        <div className="flex gap-2 flex-wrap">
                          <Input
                            placeholder="email@example.com"
                            value={newSeatEmail}
                            onChange={(e) => setNewSeatEmail(e.target.value)}
                            className="flex-1 min-w-[200px]"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddSeat()}
                          />
                          <Button onClick={handleAddSeat} disabled={addingSeat}>
                            <UserPlus className="h-4 w-4" />
                            {addingSeat ? 'Provisioning...' : 'Add Seat'}
                          </Button>
                        </div>
                      )}

                      {/* Provisioned Seats List */}
                      <div className="space-y-2">
                        {selectedOrg.provisionedEmails.map((email, idx) => (
                          <div
                            key={email}
                            className="flex items-center justify-between gap-4 rounded-lg border border-border p-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium">
                                {email.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium truncate">{email}</p>
                                <p className="text-xs text-muted-foreground">
                                  {idx === 0 ? (
                                    <span className="flex items-center gap-1">
                                      <Crown className="h-3 w-3" /> Admin
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1">
                                      <Shield className="h-3 w-3" /> Member
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            {idx !== 0 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveSeat(email)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Contract Details */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Contract Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5" /> Contract Value
                          </span>
                          <p className="font-medium">
                            {selectedOrg.contractValue ? `$${selectedOrg.contractValue.toLocaleString()}` : 'Custom'}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" /> Duration
                          </span>
                          <p className="font-medium">{selectedOrg.contractPeriodMonths} months</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" /> Azure DevOps
                          </span>
                          <p className="font-medium truncate">
                            {selectedOrg.azureDevOpsOrgUrl || 'Not configured'}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Key className="h-3.5 w-3.5" /> API Key
                          </span>
                          <p className="font-mono text-xs">
                            {selectedOrg.apiKey ? `${selectedOrg.apiKey.slice(0, 8)}...` : 'Hidden'}
                          </p>
                        </div>
                      </div>
                      {selectedOrg.notes && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <span className="text-muted-foreground text-xs">Notes</span>
                          <p className="text-sm mt-1">{selectedOrg.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Azure DevOps Pipeline Config */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Server className="h-5 w-5" />
                        Azure DevOps Pipeline
                      </CardTitle>
                      <CardDescription>
                        Generate a CI/CD pipeline template for this organization
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!azureConfig ? (
                        <Button onClick={handleGenerateAzureConfig} disabled={generatingAzure}>
                          <Download className="h-4 w-4" />
                          {generatingAzure ? 'Generating...' : 'Generate Pipeline Template'}
                        </Button>
                      ) : (
                        <>
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Label htmlFor="api-key-display">Organization API Key</Label>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(azureConfig.apiKey, 'API Key')}
                              >
                                <Copy className="h-3.5 w-3.5" /> Copy
                              </Button>
                            </div>
                            <Input
                              id="api-key-display"
                              readOnly
                              value={azureConfig.apiKey}
                              className="font-mono text-xs"
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Pipeline YAML</Label>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(azureConfig.pipelineYaml, 'Pipeline YAML')}
                              >
                                <Copy className="h-3.5 w-3.5" /> Copy YAML
                              </Button>
                            </div>
                            <Textarea
                              readOnly
                              value={azureConfig.pipelineYaml}
                              className="font-mono text-xs min-h-[300px]"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Setup Instructions</Label>
                            <ol className="space-y-1.5">
                              {azureConfig.instructions.map((step, i) => (
                                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                                  <span className="font-medium text-foreground shrink-0">{i + 1}.</span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const blob = new Blob([azureConfig.pipelineYaml], { type: 'text/yaml' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${selectedOrg.orgId}-azure-pipelines.yml`;
                              a.click();
                              URL.revokeObjectURL(url);
                              toast.success('Pipeline YAML downloaded');
                            }}
                          >
                            <Download className="h-4 w-4" /> Download YAML
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Onboard Tab ── */}
        <TabsContent value="onboard">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Enterprise Onboarding
              </CardTitle>
              <CardDescription>
                Provision a new enterprise organization with seat pool and Azure DevOps integration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="onboard-company">Company Name *</Label>
                  <Input
                    id="onboard-company"
                    placeholder="Acme Corporation"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="onboard-admin">Admin Email *</Label>
                  <Input
                    id="onboard-admin"
                    type="email"
                    placeholder="admin@acme.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="onboard-contact">Contact Name</Label>
                  <Input
                    id="onboard-contact"
                    placeholder="John Smith"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="onboard-seats">Seat Count</Label>
                  <Input
                    id="onboard-seats"
                    type="number"
                    min={1}
                    max={500}
                    value={seatCount}
                    onChange={(e) => setSeatCount(parseInt(e.target.value) || 10)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="onboard-value">Contract Value ($)</Label>
                  <Input
                    id="onboard-value"
                    type="number"
                    min={0}
                    placeholder="25000"
                    value={contractValue}
                    onChange={(e) => setContractValue(e.target.value ? parseInt(e.target.value) : '')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="onboard-months">Contract Duration (months)</Label>
                  <Input
                    id="onboard-months"
                    type="number"
                    min={1}
                    max={36}
                    value={contractMonths}
                    onChange={(e) => setContractMonths(parseInt(e.target.value) || 12)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="onboard-azure">Azure DevOps Organization URL</Label>
                  <Input
                    id="onboard-azure"
                    placeholder="https://dev.azure.com/acme-corp"
                    value={azureDevOpsOrg}
                    onChange={(e) => setAzureDevOpsOrg(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleOnboard} disabled={onboarding}>
                  <Building2 className="h-4 w-4" />
                  {onboarding ? 'Provisioning...' : 'Provision Organization'}
                </Button>
                <Button variant="outline" onClick={() => {
                  setCompanyName('');
                  setAdminEmail('');
                  setContactName('');
                  setSeatCount(10);
                  setContractValue('');
                  setContractMonths(12);
                  setAzureDevOpsOrg('');
                }}>
                  Clear Form
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Trial Tab ── */}
        <TabsContent value="trial">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                Start Enterprise Trial
              </CardTitle>
              <CardDescription>
                Provision a 30-day enterprise trial with up to 10 seats — no contract required
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="trial-company">Company Name *</Label>
                  <Input
                    id="trial-company"
                    placeholder="Acme Corporation"
                    value={trialCompany}
                    onChange={(e) => setTrialCompany(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trial-email">Admin Email *</Label>
                  <Input
                    id="trial-email"
                    type="email"
                    placeholder="admin@acme.com"
                    value={trialEmail}
                    onChange={(e) => setTrialEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trial-seats">Seat Count (max 10)</Label>
                  <Input
                    id="trial-seats"
                    type="number"
                    min={1}
                    max={10}
                    value={trialSeats}
                    onChange={(e) => setTrialSeats(Math.min(10, parseInt(e.target.value) || 5))}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Trial includes: all enterprise features, 30-day evaluation, up to 10 seats
              </div>
              <div className="flex gap-2">
                <Button onClick={handleTrial} disabled={trialing}>
                  <Rocket className="h-4 w-4" />
                  {trialing ? 'Starting Trial...' : 'Start 30-Day Trial'}
                </Button>
                <Button variant="outline" onClick={() => {
                  setTrialCompany('');
                  setTrialEmail('');
                  setTrialSeats(5);
                }}>
                  Clear Form
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Provisioning Result Tab ── */}
        {onboardResult && (
          <TabsContent value="result">
            <Card className="border-green-300 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  Provisioning Successful
                </CardTitle>
                <CardDescription>
                  {onboardResult.companyName} has been onboarded with {onboardResult.seatsUsed} of {onboardResult.seatCount} seats provisioned
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Organization ID</span>
                    <p className="font-mono font-medium">{onboardResult.orgId}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Admin Email</span>
                    <p className="font-medium">{onboardResult.adminEmail}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Expires</span>
                    <p className="font-medium">{formatDate(onboardResult.expiresAt)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Seats</span>
                    <p className="font-medium">{onboardResult.seatsUsed} / {onboardResult.seatCount}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="result-api-key">API Key</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(onboardResult.apiKey, 'API Key')}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </Button>
                  </div>
                  <Input id="result-api-key" readOnly value={onboardResult.apiKey} className="font-mono text-xs" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="result-license">Admin License Token</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(onboardResult.adminLicenseToken, 'License Token')}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </Button>
                  </div>
                  <Textarea
                    id="result-license"
                    readOnly
                    value={onboardResult.adminLicenseToken}
                    className="font-mono text-xs min-h-[80px]"
                  />
                </div>

                {onboardResult.provisionedEmails.length > 1 && (
                  <div className="space-y-2">
                    <Label>Provisioned Seats</Label>
                    <div className="space-y-1">
                      {onboardResult.provisionedEmails.map((email, i) => (
                        <div key={email} className="flex items-center gap-2 text-sm">
                          {i === 0 ? <Crown className="h-3.5 w-3.5 text-amber-500" /> : <Shield className="h-3.5 w-3.5 text-muted-foreground" />}
                          <span>{email}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button onClick={() => {
                    setSelectedOrg(orgs.find(o => o.orgId === onboardResult.orgId) || null);
                    setActiveTab('organizations');
                  }}>
                    <Building2 className="h-4 w-4" /> Manage Organization
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setOnboardResult(null);
                    setActiveTab('onboard');
                  }}>
                    Onboard Another
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {trialResult && !onboardResult && (
          <TabsContent value="result">
            <Card className="border-amber-300 dark:border-amber-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Rocket className="h-5 w-5" />
                  Trial Provisioned
                </CardTitle>
                <CardDescription>
                  30-day trial started — {trialResult.trialDurationDays} days remaining
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Organization ID</span>
                    <p className="font-mono font-medium">{trialResult.orgId}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Trial Expires</span>
                    <p className="font-medium">{formatDate(trialResult.trialExpiresAt)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Admin Email</span>
                    <p className="font-medium">{trialResult.adminEmail}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Seats</span>
                    <p className="font-medium">{trialResult.seatsUsed} / {trialResult.seatCount}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>API Key</Label>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(trialResult.apiKey, 'API Key')}>
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </Button>
                  </div>
                  <Input readOnly value={trialResult.apiKey} className="font-mono text-xs" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Admin License Token</Label>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(trialResult.adminLicenseToken, 'License Token')}>
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </Button>
                  </div>
                  <Textarea readOnly value={trialResult.adminLicenseToken} className="font-mono text-xs min-h-[80px]" />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={() => {
                    setSelectedOrg(orgs.find(o => o.orgId === trialResult.orgId) || null);
                    setActiveTab('organizations');
                  }}>
                    <Building2 className="h-4 w-4" /> Manage Organization
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setTrialResult(null);
                    setActiveTab('trial');
                  }}>
                    Start Another Trial
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
