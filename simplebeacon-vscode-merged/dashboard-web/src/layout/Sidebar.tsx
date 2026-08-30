import { useState } from 'react';
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
  Upload,
  ScrollText,
  Building2,
  Server,
  TrendingUp,
  Radio,
  Megaphone,
  Layers,
  SlidersHorizontal,
  Zap,
  FileBarChart,
  KeyRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { getViewUpgradeInfo } from '@/config/viewAccess';
import { UpgradeModal } from '@/components/UpgradeModal';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
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
    label: 'Scan',
    items: [
      { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { view: 'analyze', label: 'Analyze', icon: FolderSearch },
      { view: 'results', label: 'Results', icon: ClipboardList },
      { view: 'repository-health', label: 'Repo Health', icon: Package },
      { view: 'upload', label: 'Upload', icon: Upload },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { view: 'audit', label: 'Audit Report', icon: ClipboardCheck },
      { view: 'security', label: 'Security', icon: Lock },
      { view: 'quality', label: 'Quality', icon: Award },
      { view: 'trust', label: 'Trust', icon: BadgeCheck },
      { view: 'compliance', label: 'Compliance', icon: ScrollText },
    ],
  },
  {
    label: 'Operations',
    items: [
      { view: 'assessments', label: 'Assessments', icon: FileText },
      { view: 'remediation', label: 'Remediation', icon: Map },
      { view: 'platform', label: 'Platform', icon: BarChart3 },
      { view: 'outreach-analytics', label: 'Outreach Analytics', icon: Megaphone },
      { view: 'ops-report', label: 'Ops Report', icon: FileBarChart },
      { view: 'workspace', label: 'Workspace', icon: Layers },
      { view: 'profile', label: 'Profile', icon: User },
      { view: 'admin', label: 'Admin', icon: Users },
    ],
  },
  {
    label: 'Team & Enterprise',
    items: [
      { view: 'organization', label: 'Organization', icon: Building2 },
      { view: 'enterprise', label: 'Enterprise', icon: Server },
      { view: 'team-metrics', label: 'Team Metrics', icon: TrendingUp },
      { view: 'telemetry', label: 'Advanced Telemetry', icon: Radio },
      { view: 'fine-tuning', label: 'Fine-Tuning Curation', icon: SlidersHorizontal },
      { view: 'webhook-events', label: 'Webhook Events', icon: Zap },
    ],
  },
  {
    label: 'System',
    items: [
      { view: 'tools', label: 'Tools', icon: Wrench },
      { view: 'settings', label: 'Settings', icon: Settings },
      { view: 'license-manager', label: 'License Manager', icon: KeyRound },
      { view: 'help', label: 'Help', icon: HelpCircle },
      { view: 'getting-started', label: 'Getting Started', icon: Rocket },
      { view: 'chatbot', label: 'Chatbot', icon: Bot },
      { view: 'about', label: 'About', icon: Info },
    ],
  },
];

export function Sidebar({ currentView, onNavigate, isOpen, onClose, isAdmin }: SidebarProps) {
  const { hasFeature } = useFeatureAccess();
  const [upgradeView, setUpgradeView] = useState<string | null>(null);

  const handleNavigate = (view: string) => {
    const info = getViewUpgradeInfo(view);
    if (info && !hasFeature(info.flag)) {
      setUpgradeView(view);
      return;
    }
    onNavigate(view);
  };

  const upgradeInfo = upgradeView ? getViewUpgradeInfo(upgradeView) : null;
  const upgradeLabel = upgradeView
    ? navGroups
        .flatMap((g) => g.items)
        .find((i) => i.view === upgradeView)?.label
    : undefined;

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-border bg-card transition-transform lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
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
            <span className="text-sm font-bold tracking-tight">SimpleBeacon</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3 overscroll-contain">
          {navGroups.map((group) => (
            <NavGroupSection
              key={group.label}
              group={group}
              currentView={currentView}
              onNavigate={handleNavigate}
              isAdmin={!!isAdmin}
              hasFeature={hasFeature}
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
          >
            <Github className="h-4 w-4" />
          </a>
          <a
            href="https://github.com/tjp420/simplebeacon/blob/main/docs/ANTI-BLOAT-MANIFESTO.md"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-muted hover:bg-muted hover:text-foreground"
            title="Docs"
          >
            <BookOpen className="h-4 w-4" />
          </a>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-muted hover:bg-muted hover:text-foreground"
            title="Export"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleNavigate('about')}
            className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-muted hover:bg-muted hover:text-foreground"
            title="About"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <UpgradeModal
        open={upgradeView !== null}
        onOpenChange={(o) => { if (!o) setUpgradeView(null); }}
        viewLabel={upgradeLabel}
        info={upgradeInfo}
      />
    </>
  );
}

function NavGroupSection({
  group,
  currentView,
  onNavigate,
  isAdmin,
  hasFeature,
}: {
  group: NavGroup;
  currentView: string;
  onNavigate: (v: string) => void;
  isAdmin: boolean;
  hasFeature: (f: import('@/hooks/useFeatureAccess').FeatureFlag) => boolean;
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
            // Hide admin-only views from non-admin users
            if ((item.view === 'assessments' || item.view === 'admin') && !isAdmin) return false;
            return true;
          })
          .map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.view;
            const info = getViewUpgradeInfo(item.view);
            const isLocked = info ? !hasFeature(info.flag) : false;
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => onNavigate(item.view)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-subtle text-primary'
                    : 'text-foreground-secondary hover:bg-muted hover:text-foreground',
                  isLocked && 'opacity-70'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {isLocked && <Lock className="h-3 w-3 shrink-0 text-foreground-muted" />}
              </button>
            );
          })}
      </div>
    </div>
  );
}
