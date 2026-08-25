// simplebeacon-ignore: mega-params — conservative suppression; plan refactor later
import { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface AppShellProps {
    currentView: string;
    onNavigate: (view: string) => void;
    isAuthenticated: boolean;
    isFreeTier: boolean;
    user?: { email?: string; name?: string; role?: string } | null;
    children: React.ReactNode;
}

export function AppShell({ currentView, onNavigate, isAuthenticated, isFreeTier, user, children }: AppShellProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const isAdmin = !!(
        user && ['admin', 'owner', 'superuser', 'superadmin'].includes(String(user.role || '').toLowerCase())
    );

    return (
        <div className="flex h-full overflow-hidden bg-background">
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded"
            >
                Skip to main content
            </a>
            <Sidebar
                currentView={currentView}
                onNavigate={v => {
                    onNavigate(v);
                    setSidebarOpen(false);
                }}
                isOpen={sidebarOpen}
                isAdmin={isAdmin}
                isAuthenticated={isAuthenticated}
                onClose={() => setSidebarOpen(false)}
            />
            <div className="flex flex-1 flex-col overflow-hidden min-h-0">
                <Header
                    isAuthenticated={isAuthenticated}
                    isFreeTier={isFreeTier}
                    onMenuClick={() => setSidebarOpen(true)}
                />
                <main id="main-content" className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
                    {children}
                </main>
            </div>
        </div>
    );
}
