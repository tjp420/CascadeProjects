import {
  LayoutDashboard,
  FolderSearch,
  ClipboardList,
  Package,
  ClipboardCheck,
  Lock,
  Award,
  BadgeCheck,
  FileText,
  Map,
  BarChart3,
  TrendingUp,
  User,
  Users,
  Wrench,
  Settings,
  HelpCircle,
  Rocket,
  Bot,
  Info,
  ChevronDown,
  Github,
  BookOpen,
  Download,
  Building2,
  Server,
  Mail,
  Briefcase,
  Database,
  Webhook,
  FileBarChart,
  KeyRound,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  isAuthenticated?: boolean;
}

interface NavItem {
  view: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Scan",
    items: [
      { view: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { view: "analyze", label: "Analyze", icon: FolderSearch },
      { view: "results", label: "Results", icon: ClipboardList },
      { view: "repository-health", label: "Repo Health", icon: Package },
    ],
  },
  {
    label: "Compliance",
    items: [
      { view: "audit", label: "Audit Report", icon: ClipboardCheck },
      { view: "security", label: "Security", icon: Lock },
      { view: "quality", label: "Quality", icon: Award },
      { view: "trust", label: "Trust", icon: BadgeCheck },
    ],
  },
  {
    label: "Operations",
    items: [
      { view: "assessments", label: "Assessments", icon: FileText },
      { view: "remediation", label: "Remediation", icon: Map },
      { view: "platform", label: "Platform", icon: BarChart3 },
      { view: "team-metrics", label: "Team Metrics", icon: TrendingUp },
      { view: "telemetry", label: "Advanced Telemetry", icon: Activity },
      { view: "outreach-analytics", label: "Outreach Analytics", icon: Mail },
      { view: "organization", label: "Organization", icon: Building2 },
      { view: "enterprise", label: "Enterprise", icon: Server },
      { view: "workspace", label: "Workspace", icon: Briefcase },
      { view: "fine-tuning", label: "Fine-Tuning", icon: Database },
      { view: "webhook-events", label: "Webhook Events", icon: Webhook },
      { view: "ops-report", label: "Ops Report", icon: FileBarChart },
      { view: "license-manager", label: "License Manager", icon: KeyRound },
      { view: "profile", label: "Profile", icon: User },
      { view: "admin", label: "Admin", icon: Users },
    ],
  },
  {
    label: "System",
    items: [
      { view: "tools", label: "Tools", icon: Wrench },
      { view: "settings", label: "Settings", icon: Settings },
      { view: "help", label: "Help", icon: HelpCircle },
      { view: "getting-started", label: "Getting Started", icon: Rocket },
      { view: "chatbot", label: "Chatbot", icon: Bot },
      { view: "about", label: "About", icon: Info },
    ],
  },
];

// Views that require authentication — hidden from sidebar when signed out
// Align with App.tsx AUTH_REQUIRED_VIEWS — only workspace truly requires auth
// at the router level. Admin is handled separately below.
const AUTH_REQUIRED_VIEWS = new Set(["workspace"]);

export function Sidebar({
  currentView,
  onNavigate,
  isOpen,
  onClose,
  isAdmin,
  isAuthenticated,
}: SidebarProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-border bg-card transition-transform lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 text-primary-foreground"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 12 15 16 10" />
              </svg>
            </div>
            <span className="text-sm font-bold tracking-tight">
              SimpleBeacon
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3 overscroll-contain">
          {navGroups.map((group) => (
            <NavGroupSection
              key={group.label}
              group={group}
              currentView={currentView}
              onNavigate={onNavigate}
              isAdmin={!!isAdmin}
              isAuthenticated={!!isAuthenticated}
            />
          ))}
        </nav>

        <div className="flex items-center gap-1 border-t border-border px-3 py-2">
          <a
            href="https://github.com/tjp420/simplebeacon"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-muted hover:bg-muted hover:text-foreground"
            title="GitHub"
            aria-label="GitHub repository"
          >
            <Github className="h-4 w-4" />
          </a>
          <a
            href="https://github.com/tjp420/simplebeacon/blob/main/docs/ANTI-BLOAT-MANIFESTO.md"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-muted hover:bg-muted hover:text-foreground"
            title="Docs"
            aria-label="Documentation"
          >
            <BookOpen className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={async () => {
              try {
                const res = await fetch("/api/simplebeacon/report");
                if (!res.ok) return;
                const data = await res.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "simplebeacon-report.json";
                a.click();
                URL.revokeObjectURL(url);
              } catch {
                /* ignore download errors */
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-muted hover:bg-muted hover:text-foreground"
            title="Export Report"
            aria-label="Export report"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </>
  );
}

function NavGroupSection({
  group,
  currentView,
  onNavigate,
  isAdmin,
  isAuthenticated,
}: {
  group: NavGroup;
  currentView: string;
  onNavigate: (v: string) => void;
  isAdmin: boolean;
  isAuthenticated: boolean;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
        <ChevronDown className="h-3 w-3" />
        <span>{group.label}</span>
      </div>
      <div className="space-y-0.5">
        {group.items
          .filter((item) => {
            // Hide admin-only items from non-admin users
            if (
              !isAdmin &&
              (item.view === "admin" || item.view === "workspace")
            )
              return false;
            // Hide auth-required items from signed-out users
            if (!isAuthenticated && AUTH_REQUIRED_VIEWS.has(item.view))
              return false;
            return true;
          })
          .map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => onNavigate(item.view)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary-subtle text-primary"
                    : "text-foreground-secondary hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
      </div>
    </div>
  );
}
