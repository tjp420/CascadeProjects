import { Menu, Sun, Moon, LogOut, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/hooks/useTheme';
import { navigate } from '@/router/HashRouter';

interface HeaderProps {
  isAuthenticated: boolean;
  isFreeTier: boolean;
  onMenuClick: () => void;
}

export function Header({ isAuthenticated, isFreeTier, onMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="hidden sm:block">
          <span className="text-sm font-semibold text-foreground-muted">AI Safety Scanning Platform</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isAuthenticated && isFreeTier && (
          <span className="hidden rounded-full bg-warning-subtle px-2.5 py-0.5 text-xs font-medium text-warning sm:inline-block">
            Free Tier
          </span>
        )}

        <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>

        {isAuthenticated ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <UserIcon className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('profile')}>
                <UserIcon className="h-4 w-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('settings')}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                localStorage.removeItem('sb_token');
                localStorage.removeItem('sb_user');
                navigate('signin');
              }}>
                <LogOut className="h-4 w-4" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="default" size="sm" onClick={() => navigate('signin')}>
            Sign In
          </Button>
        )}
      </div>
    </header>
  );
}
