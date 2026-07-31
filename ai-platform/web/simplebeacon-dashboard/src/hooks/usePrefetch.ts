import { useCallback, useEffect, useRef } from 'react';

type ImportFn = () => Promise<unknown>;

const prefetchCache = new Set<string>();

const viewImporters: Record<string, ImportFn> = {
  analyze: () => import('../views/AnalyzeView'),
  results: () => import('../views/ResultsView'),
  settings: () => import('../views/SettingsView'),
  audit: () => import('../views/AuditView'),
  security: () => import('../views/SecurityView'),
  quality: () => import('../views/QualityView'),
  chatbot: () => import('../views/ChatbotView'),
  trust: () => import('../views/TrustView'),
  remediation: () => import('../views/RemediationView'),
  profile: () => import('../views/ProfileView'),
  platform: () => import('../views/PlatformView'),
  tools: () => import('../views/ToolsView'),
  'repository-health': () => import('../views/RepoHealthView'),
  admin: () => import('../views/AdminView'),
  upload: () => import('../views/UploadView'),
  help: () => import('../views/HelpView'),
  assessments: () => import('../views/AssessmentView'),
  about: () => import('../views/AboutView'),
  'getting-started': () => import('../views/GettingStartedView'),
  compliance: () => import('../views/ComplianceView'),
  organization: () => import('../views/OrganizationView'),
  enterprise: () => import('../views/EnterpriseView'),
  'outreach-analytics': () => import('../views/OutreachAnalyticsView'),
  'team-metrics': () => import('../views/TeamMetricsView'),
};

const HIGH_PRIORITY_VIEWS = ['analyze', 'results', 'admin', 'settings', 'audit'];

export function prefetchView(view: string) {
  if (prefetchCache.has(view)) return;
  const importer = viewImporters[view];
  if (!importer) return;
  prefetchCache.add(view);
  importer().catch(() => {
    prefetchCache.delete(view);
  });
}

export function usePrefetch(currentView: string) {
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefetchOnHover = useCallback((view: string) => {
    prefetchView(view);
  }, []);

  useEffect(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    idleTimerRef.current = setTimeout(() => {
      for (const view of HIGH_PRIORITY_VIEWS) {
        if (view !== currentView) {
          prefetchView(view);
        }
      }
    }, 2000);

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [currentView]);

  return { prefetchOnHover };
}
