import { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface AppShellProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isAuthenticated: boolean;
  isFreeTier: boolean;
  children: React.ReactNode;
}

export function AppShell({ currentView, onNavigate, isAuthenticated, isFreeTier, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <Sidebar
        currentView={currentView}
        onNavigate={(v) => {
          onNavigate(v);
          setSidebarOpen(false);
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <Header
          isAuthenticated={isAuthenticated}
          isFreeTier={isFreeTier}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
