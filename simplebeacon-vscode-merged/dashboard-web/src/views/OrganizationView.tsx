// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  Plus,
  Users,
  Trash2,
  UserPlus,
  Crown,
  Shield,
  CheckCircle2,
  Clock,
  Mail,
  Settings,
  BarChart3,
  ChevronDown,
  AlertCircle,
  Download,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { useOrganizations, type OrgMember } from "@/hooks/useOrganizations";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  team_lead: "Team Lead",
  compliance_officer: "Compliance Officer",
  auditor: "Auditor",
};

const ROLE_COLORS: Record<string, string> = {
  owner:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  team_lead: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  compliance_officer:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  auditor: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

const ASSIGNABLE_ROLES = ["team_lead", "compliance_officer", "auditor"];

export function OrganizationView() {
  const {
    organizations,
    activeOrg,
    loading,
    error,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    getMembers,
    inviteMember,
    updateMemberRole,
    removeMember,
    acceptInvitation,
    getMetrics,
    switchOrg,
    refresh,
  } = useOrganizations();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("auditor");
  const [metrics, setMetrics] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editName, setEditName] = useState("");
  const [editMaxSeats, setEditMaxSeats] = useState(10);

  const loadMembers = useCallback(
    async (orgId: string) => {
      setMembersLoading(true);
      try {
        const m = await getMembers(orgId);
        setMembers(m);
      } catch (err: any) {
        toast.error(err.message || "Failed to load members");
      } finally {
        setMembersLoading(false);
      }
    },
    [getMembers],
  );

  const loadMetrics = useCallback(
    async (orgId: string) => {
      try {
        const m = await getMetrics(orgId);
        setMetrics(m);
      } catch {
        setMetrics(null);
      }
    },
    [getMetrics],
  );

  useEffect(() => {
    if (activeOrg) {
      loadMembers(activeOrg.id);
      loadMetrics(activeOrg.id);
      setEditName(activeOrg.name);
      setEditMaxSeats(activeOrg.max_seats);
    } else {
      setMembers([]);
      setMetrics(null);
    }
  }, [activeOrg, loadMembers, loadMetrics]);

  const handleCreate = async () => {
    if (!newName.trim() || !newSlug.trim()) {
      toast.error("Name and slug are required");
      return;
    }
    try {
      const org = await createOrganization(newName.trim(), newSlug.trim());
      toast.success(`Organization "${org.name}" created`);
      setShowCreate(false);
      setNewName("");
      setNewSlug("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create organization");
    }
  };

  const handleInvite = async () => {
    if (!activeOrg || !inviteEmail.trim()) {
      toast.error("Email is required");
      return;
    }
    if (!inviteEmail.includes("@")) {
      toast.error("Please enter a valid email");
      return;
    }
    try {
      await inviteMember(activeOrg.id, inviteEmail.trim(), inviteRole);
      toast.success(
        `Invitation sent to ${inviteEmail.trim()} as ${ROLE_LABELS[inviteRole]}`,
      );
      setInviteEmail("");
      await loadMembers(activeOrg.id);
      await loadMetrics(activeOrg.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to invite member");
    }
  };

  const handleRoleChange = async (email: string, role: string) => {
    if (!activeOrg) return;
    try {
      await updateMemberRole(activeOrg.id, email, role);
      toast.success(`Role updated for ${email}`);
      await loadMembers(activeOrg.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    }
  };

  const handleRemoveMember = async (email: string) => {
    if (!activeOrg) return;
    if (!confirm(`Remove ${email} from this organization?`)) return;
    try {
      await removeMember(activeOrg.id, email);
      toast.success(`${email} removed`);
      await loadMembers(activeOrg.id);
      await loadMetrics(activeOrg.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member");
    }
  };

  const handleAcceptInvitation = async (orgId: string) => {
    try {
      await acceptInvitation(orgId);
      toast.success("Invitation accepted");
    } catch (err: any) {
      toast.error(err.message || "Failed to accept invitation");
    }
  };

  const handleDeleteOrg = async () => {
    if (!activeOrg) return;
    if (
      !confirm(
        `Delete organization "${activeOrg.name}"? This cannot be undone.`,
      )
    )
      return;
    if (!confirm(`Are you absolutely sure? All members will be removed.`))
      return;
    try {
      await deleteOrganization(activeOrg.id);
      toast.success("Organization deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete organization");
    }
  };

  const handleSaveSettings = async () => {
    if (!activeOrg) return;
    try {
      await updateOrganization(activeOrg.id, {
        name: editName,
        maxSeats: editMaxSeats,
      });
      toast.success("Organization updated");
      setShowSettings(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update organization");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground">
          Loading organizations...
        </div>
      </div>
    );
  }

  if (error && organizations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={refresh}>
          Retry
        </Button>
      </div>
    );
  }

  if (organizations.length === 0 && !showCreate) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Building2 className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold">No Organizations Yet</h2>
          <p className="text-muted-foreground mt-1">
            Create your first organization to get started.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> Create Organization
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Organization Switcher + Actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {organizations.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Building2 className="h-4 w-4" />
                  {activeOrg?.name || "Select Organization"}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[240px]">
                <DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {organizations.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => switchOrg(org)}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {org.name}
                    </span>
                    {org.id === activeOrg?.id && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4" /> New Organization
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {activeOrg && (
            <Badge
              variant="secondary"
              className={ROLE_COLORS[activeOrg.role || "auditor"]}
            >
              {ROLE_LABELS[activeOrg.role || "auditor"]}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeOrg &&
            (activeOrg.role === "owner" || activeOrg.role === "team_lead") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="h-4 w-4" /> Settings
              </Button>
            )}
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
      </div>

      {/* Create Organization Form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Organization</CardTitle>
            <CardDescription>
              Set up a new workspace for your team
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                placeholder="Acme Corporation"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-slug">URL Slug</Label>
              <Input
                id="org-slug"
                placeholder="acme-corp"
                value={newSlug}
                onChange={(e) =>
                  setNewSlug(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                  )
                }
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate}>Create</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settings Panel */}
      {showSettings && activeOrg && (
        <Card>
          <CardHeader>
            <CardTitle>Organization Settings</CardTitle>
            <CardDescription>Update name and seat limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-seats">Max Seats</Label>
              <Input
                id="edit-seats"
                type="number"
                min={1}
                max={100}
                value={editMaxSeats}
                onChange={(e) =>
                  setEditMaxSeats(parseInt(e.target.value) || 10)
                }
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveSettings}>Save</Button>
              <Button variant="outline" onClick={() => setShowSettings(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics Overview */}
      {activeOrg && metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics.members.active}</p>
                  <p className="text-xs text-muted-foreground">
                    Active Members
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {metrics.members.pending}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pending Invitations
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <BarChart3 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {metrics.seats.used}/{metrics.seats.max}
                  </p>
                  <p className="text-xs text-muted-foreground">Seats Used</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pending Invitation Banner */}
      {activeOrg && activeOrg.member_status === "pending" && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/10">
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium">
                  You have a pending invitation to {activeOrg.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Accept to start collaborating with your team
                </p>
              </div>
            </div>
            <Button onClick={() => handleAcceptInvitation(activeOrg.id)}>
              <CheckCircle2 className="h-4 w-4" /> Accept
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Members Section */}
      {activeOrg && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Members</CardTitle>
                <CardDescription>
                  Manage team members and their roles
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Invite Form */}
            {activeOrg.role !== "auditor" && (
              <div className="mb-6 flex gap-2 flex-wrap">
                <Input
                  placeholder="email@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 min-w-[200px]"
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      {ROLE_LABELS[inviteRole]}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <DropdownMenuItem
                        key={r}
                        onClick={() => setInviteRole(r)}
                      >
                        {ROLE_LABELS[r]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button onClick={handleInvite}>
                  <UserPlus className="h-4 w-4" /> Invite
                </Button>
              </div>
            )}

            {/* Members List */}
            {membersLoading ? (
              <div className="py-8 text-center text-muted-foreground">
                Loading members...
              </div>
            ) : members.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No members yet
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium">
                        {member.user_email.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {member.user_name || member.user_email}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.user_email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {member.status === "pending" && (
                        <Badge variant="outline" className="text-amber-600">
                          <Clock className="h-3 w-3 mr-1" /> Pending
                        </Badge>
                      )}
                      {member.role === "owner" ? (
                        <Badge
                          variant="secondary"
                          className={ROLE_COLORS.owner}
                        >
                          <Crown className="h-3 w-3 mr-1" /> Owner
                        </Badge>
                      ) : activeOrg.role !== "auditor" &&
                        member.role !== "owner" ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5"
                            >
                              <Badge
                                variant="secondary"
                                className={ROLE_COLORS[member.role]}
                              >
                                {ROLE_LABELS[member.role]}
                              </Badge>
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {ASSIGNABLE_ROLES.map((r) => (
                              <DropdownMenuItem
                                key={r}
                                onClick={() =>
                                  handleRoleChange(member.user_email, r)
                                }
                              >
                                {ROLE_LABELS[r]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <Badge
                          variant="secondary"
                          className={ROLE_COLORS[member.role]}
                        >
                          {ROLE_LABELS[member.role]}
                        </Badge>
                      )}
                      {activeOrg.role !== "auditor" &&
                        member.role !== "owner" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label="Remove member"
                            onClick={() =>
                              handleRemoveMember(member.user_email)
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Compliance Exports */}
      {activeOrg && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Compliance Exports
            </CardTitle>
            <CardDescription>
              Download vulnerability trend data and audit reports for compliance
              teams
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  try {
                    const raw = localStorage.getItem("sb_last_scan_full");
                    if (!raw) {
                      toast.error("No scan report found — run a scan first");
                      return;
                    }
                    const report = JSON.parse(raw);
                    let history: any[] = [];
                    try {
                      const histRaw = localStorage.getItem("sb_scan_history");
                      if (histRaw) history = JSON.parse(histRaw);
                    } catch {
                      /* ignore */
                    }
                    const sev = report.severityCounts || {};
                    const gate = report.gate || {};
                    const header = [
                      "date",
                      "project",
                      "gatePass",
                      "qualityScore",
                      "issueCount",
                      "blockingCount",
                      "warningCount",
                      "critical",
                      "high",
                      "medium",
                      "low",
                      "totalFilesScanned",
                    ];
                    const rows: string[] = [header.join(",")];
                    const esc = (v: unknown) =>
                      `"${String(v ?? "").replace(/"/g, '""')}"`;
                    for (const entry of history) {
                      const s = entry.severityCounts || {};
                      rows.push(
                        [
                          entry.date,
                          activeOrg.slug,
                          entry.gatePass,
                          entry.qualityScore,
                          entry.issueCount,
                          entry.blockingCount,
                          entry.warningCount,
                          s.critical || 0,
                          s.high || 0,
                          s.medium || 0,
                          s.low || 0,
                          entry.totalFilesScanned,
                        ]
                          .map(esc)
                          .join(","),
                      );
                    }
                    const reportDate =
                      report.generatedAt || new Date().toISOString();
                    rows.push(
                      [
                        reportDate,
                        activeOrg.slug,
                        gate.pass,
                        report.qualityScore,
                        report.issueCount,
                        gate.blockingCount,
                        gate.warningCount,
                        sev.critical || 0,
                        sev.high || 0,
                        sev.medium || 0,
                        sev.low || 0,
                        report.totalFiles || report.repositoryFilesTotal || "",
                      ]
                        .map(esc)
                        .join(","),
                    );
                    const csv = rows.join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `simplebeacon-trend-${activeOrg.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("Trend CSV downloaded");
                  } catch (err: any) {
                    toast.error(err.message || "Failed to export trend CSV");
                  }
                }}
              >
                <Download className="h-4 w-4" /> Trend CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  try {
                    const raw = localStorage.getItem("sb_last_scan_full");
                    if (!raw) {
                      toast.error("No scan report found — run a scan first");
                      return;
                    }
                    const report = JSON.parse(raw);
                    let history: any[] = [];
                    try {
                      const histRaw = localStorage.getItem("sb_scan_history");
                      if (histRaw) history = JSON.parse(histRaw);
                    } catch {
                      /* ignore */
                    }
                    const projectLabel = activeOrg.name;
                    const generatedAt =
                      report.generatedAt || new Date().toISOString();
                    const gate = report.gate || {};
                    const sev = report.severityCounts || {};
                    const issues =
                      report.rawIssues || report.detectedIssues || [];
                    const qualityScore =
                      report.qualityScore != null ? report.qualityScore : "N/A";
                    const gatePass =
                      gate.pass === true
                        ? "PASS"
                        : gate.blockingCount > 0
                          ? "FAIL"
                          : "REVIEW";
                    const e = (s: unknown) =>
                      String(s ?? "")
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;");
                    const issueRows = issues
                      .slice(0, 200)
                      .map(
                        (issue: any) =>
                          `<tr><td class="${e(issue.severity)}">${e(issue.severity)}</td><td>${e(issue.type)}</td><td>${e(issue.description)}</td><td>${e(issue.filePath || issue.file || "—")}</td><td>${e(issue.line || "—")}</td><td>${e(issue.count || 1)}</td></tr>`,
                      )
                      .join("");
                    const trendRows = history
                      .map((entry: any) => {
                        const s = entry.severityCounts || {};
                        return `<tr><td>${e(entry.date)}</td><td>${e(entry.gatePass === true ? "PASS" : "FAIL")}</td><td>${e(entry.qualityScore ?? "—")}</td><td>${e(entry.issueCount ?? "—")}</td><td>${e(s.critical || 0)}</td><td>${e(s.high || 0)}</td><td>${e(s.medium || 0)}</td><td>${e(s.low || 0)}</td></tr>`;
                      })
                      .join("");
                    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SimpleBeacon Audit — ${e(projectLabel)}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;padding:40px;line-height:1.5}.header{border-bottom:2px solid #6366f1;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end}.header h1{font-size:1.5rem}.header .meta{font-size:0.8rem;color:#666;text-align:right}.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}.summary-card{border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px}.summary-card .label{font-size:0.7rem;color:#666;text-transform:uppercase;letter-spacing:0.05em}.summary-card .value{font-size:1.5rem;font-weight:700;margin-top:4px}.gate-pass{color:#16a34a}.gate-fail{color:#dc2626}.gate-review{color:#d97706}h2{font-size:1.1rem;margin:24px 0 12px;border-bottom:1px solid #e5e7eb;padding-bottom:6px}table{width:100%;border-collapse:collapse;font-size:0.8rem}th{background:#f9fafb;text-align:left;padding:8px;border-bottom:2px solid #e5e7eb;font-weight:600}td{padding:6px 8px;border-bottom:1px solid #f3f4f6}.critical{background:#fef2f2;color:#dc2626;font-weight:600}.high{background:#fff7ed;color:#ea580c;font-weight:600}.medium{background:#fefce8;color:#ca8a04}.low{color:#6b7280}.footer{margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:0.7rem;color:#999}@media print{body{padding:20px}}</style></head><body><div class="header"><h1>SimpleBeacon Compliance Audit Report</h1><div class="meta"><div><strong>Organization:</strong> ${e(projectLabel)}</div><div><strong>Generated:</strong> ${e(generatedAt)}</div><div><strong>Gate:</strong> <span class="gate-${gatePass.toLowerCase()}">${gatePass}</span></div></div></div><div class="summary-grid"><div class="summary-card"><div class="label">Quality Score</div><div class="value">${e(qualityScore)}</div></div><div class="summary-card"><div class="label">Total Issues</div><div class="value">${e(report.issueCount)}</div></div><div class="summary-card"><div class="label">Blocking</div><div class="value gate-fail">${e(gate.blockingCount || 0)}</div></div><div class="summary-card"><div class="label">Files Scanned</div><div class="value">${e(report.totalFiles || report.repositoryFilesTotal || "—")}</div></div></div><div class="summary-grid"><div class="summary-card"><div class="label">Critical</div><div class="value" style="color:#dc2626">${e(sev.critical || 0)}</div></div><div class="summary-card"><div class="label">High</div><div class="value" style="color:#ea580c">${e(sev.high || 0)}</div></div><div class="summary-card"><div class="label">Medium</div><div class="value" style="color:#ca8a04">${e(sev.medium || 0)}</div></div><div class="summary-card"><div class="label">Low</div><div class="value" style="color:#6b7280">${e(sev.low || 0)}</div></div></div><h2>Detected Issues (${issues.length}${issues.length > 200 ? " — showing first 200" : ""})</h2><table><thead><tr><th>Severity</th><th>Type</th><th>Description</th><th>File</th><th>Line</th><th>Count</th></tr></thead><tbody>${issueRows || '<tr><td colspan="6" style="text-align:center;color:#999;padding:16px">No issues detected</td></tr>'}</tbody></table>${trendRows ? `<h2>Vulnerability Trend (${history.length} scans)</h2><table><thead><tr><th>Date</th><th>Gate</th><th>Score</th><th>Issues</th><th>Critical</th><th>High</th><th>Medium</th><th>Low</th></tr></thead><tbody>${trendRows}</tbody></table>` : ""}<div class="footer"><p>Generated by SimpleBeacon — Compliance Audit Report</p><p>This report is auto-generated from scan data. For compliance attestation, verify with your SimpleBeacon gate configuration.</p></div><script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`;
                    const w = window.open("", "_blank");
                    if (!w) {
                      toast.error(
                        "Pop-up blocked — allow pop-ups to generate audit PDF",
                      );
                      return;
                    }
                    w.document.write(html);
                    w.document.close();
                    toast.success("Audit PDF opened — use Print to save");
                  } catch (err: any) {
                    toast.error(err.message || "Failed to generate audit PDF");
                  }
                }}
              >
                <Download className="h-4 w-4" /> Audit PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  try {
                    const raw = localStorage.getItem("sb_last_scan_full");
                    if (!raw) {
                      toast.error("No scan report found — run a scan first");
                      return;
                    }
                    const report = JSON.parse(raw);
                    const issues =
                      report.rawIssues || report.detectedIssues || [];
                    if (!issues.length) {
                      toast.error("No issues in current scan report");
                      return;
                    }
                    const header = [
                      "project",
                      "severity",
                      "type",
                      "description",
                      "file",
                      "line",
                      "count",
                    ];
                    const rows: string[] = [header.join(",")];
                    const esc = (v: unknown) =>
                      `"${String(v ?? "").replace(/"/g, '""')}"`;
                    for (const issue of issues) {
                      rows.push(
                        [
                          activeOrg.slug,
                          issue.severity,
                          issue.type,
                          issue.description,
                          issue.filePath || issue.file || "",
                          issue.line || "",
                          issue.count || 1,
                        ]
                          .map(esc)
                          .join(","),
                      );
                    }
                    const csv = rows.join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `simplebeacon-issues-${activeOrg.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success(`Exported ${issues.length} issue(s) as CSV`);
                  } catch (err: any) {
                    toast.error(err.message || "Failed to export issues CSV");
                  }
                }}
              >
                <Download className="h-4 w-4" /> Issues CSV
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Exports use the latest scan report stored in your browser. Run a
              scan from the Analyze page to populate data. The Audit PDF opens a
              printable view — use your browser's Print dialog to save as PDF.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Danger Zone */}
      {activeOrg && activeOrg.role === "owner" && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions for this organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleDeleteOrg}>
              <Trash2 className="h-4 w-4" /> Delete Organization
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
