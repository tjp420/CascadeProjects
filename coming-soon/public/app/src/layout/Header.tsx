import { Menu, Sun, Moon, LogOut, User as UserIcon, ChevronDown, Map, DollarSign, Download, FileText, HelpCircle, Mail } from 'lucide-react';
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

  const moreLinks = [
    { href: '/roadmap', label: 'Roadmap', icon: Map },
    ...((!isAuthenticated || isFreeTier) ? [{ href: '/pricing', label: 'Pricing', icon: DollarSign }] : []),
    { href: '/community', label: 'Install', icon: Download },
    { href: '/blog/case-study-ai-slop-1-25m', label: 'Blog', icon: FileText },
    { href: '/faq', label: 'FAQ', icon: HelpCircle },
    { href: '/contact', label: 'Contact', icon: Mail },
  ];

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
        <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex font-semibold">
          <a href="/audit">Audit</a>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="hidden sm:inline-flex gap-1.5">
              More
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            {moreLinks.map((link) => {
              const Icon = link.icon;
              return (
                <DropdownMenuItem key={link.href} asChild>
                  <a href={link.href} className="flex items-center gap-2.5 cursor-pointer">
                    <Icon className="h-4 w-4 text-foreground-muted" />
                    {link.label}
                  </a>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

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
                localStorage.removeItem('sb-token');
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
