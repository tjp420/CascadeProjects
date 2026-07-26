import { useState, useEffect, useCallback } from 'react';
import { getCurrentRoute, navigate } from './router/HashRouter';
import { AppShell } from './layout/AppShell';
import { ToastProvider } from './components/ToastProvider';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';

// P1 views
import { DashboardView } from './views/DashboardView';
import { AnalyzeView } from './views/AnalyzeView';
import { ResultsView } from './views/ResultsView';

// P2 views
import { SettingsView } from './views/SettingsView';
import { AuditView } from './views/AuditView';
import { SecurityView } from './views/SecurityView';
import { QualityView } from './views/QualityView';
import { ChatbotView } from './views/ChatbotView';

// P3 views
import { TrustView } from './views/TrustView';
import { RemediationView } from './views/RemediationView';
import { ProfileView } from './views/ProfileView';
import { PlatformView } from './views/PlatformView';
import { ToolsView } from './views/ToolsView';
import { RepoHealthView } from './views/RepoHealthView';
import { SignInView } from './views/SignInView';
import { AdminView } from './views/AdminView';
import { UploadView } from './views/UploadView';
import { HelpView } from './views/HelpView';
import { AssessmentView } from './views/AssessmentView';
import { AboutView } from './views/AboutView';
import { GettingStartedView } from './views/GettingStartedView';
import { ComplianceView } from './views/ComplianceView';

const PUBLIC_VIEWS = new Set(['signin', 'register', 'about', 'getting-started']);
const WRITE_HEAVY_VIEWS = new Set(['dashboard', 'analyze', 'upload', 'settings', 'admin', 'chatbot']);

const viewMap: Record<string, React.ComponentType> = {
  dashboard: DashboardView,
  analyze: AnalyzeView,
  results: ResultsView,
  settings: SettingsView,
  audit: AuditView,
  security: SecurityView,
  quality: QualityView,
  chatbot: ChatbotView,
  trust: TrustView,
  remediation: RemediationView,
  roadmap: RemediationView,
  profile: ProfileView,
  platform: PlatformView,
  tools: ToolsView,
  'repository-health': RepoHealthView,
  signin: SignInView,
  register: SignInView,
  admin: AdminView,
  upload: UploadView,
  help: HelpView,
  features: HelpView,
  assessments: AssessmentView,
  about: AboutView,
  'getting-started': GettingStartedView,
  compliance: ComplianceView,
};

export default function App() {
  const [route, setRoute] = useState(getCurrentRoute());
  const { isAuthenticated, isFreeTier, user } = useAuth();
  useTheme();

  // simplebeacon-ignore: framework-practices — standard React useEffect hook
  useEffect(() => {
    const onHashChange = () => setRoute(getCurrentRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleNavigate = useCallback((view: string) => {
    navigate(view);
    setRoute(getCurrentRoute());
  }, []);

  const CurrentView = viewMap[route.view] || DashboardView;
  const isPublic = PUBLIC_VIEWS.has(route.view);

  return (
    <ToastProvider>
      <AppShell
        currentView={route.view}
        onNavigate={handleNavigate}
        isAuthenticated={isAuthenticated}
        isFreeTier={isFreeTier}
        user={user}
      >
        <CurrentView />
      </AppShell>
    </ToastProvider>
  );
}
