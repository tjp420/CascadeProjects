import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { useAuth } from '@/hooks/useAuth';

/**
 * AnalyticsView — wraps the AnalyticsDashboard component with the current
 * user's project context. Mounted at the "analytics" route in the sidebar
 * under the Operations group.
 */
export function AnalyticsView() {
  const { user } = useAuth();

  // Derive a project name from the user's email domain or fall back to a default.
  // In production, this would come from the user's selected active project.
  const projectName = user?.email
    ? user.email.split('@')[1]?.split('.')[0] || 'default-project'
    : 'default-project';

  return <AnalyticsDashboard projectName={projectName} />;
}
