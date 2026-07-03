'use client';
import { Bot, ChevronRight, FileText, LogOut, MessageCircle, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { signOut } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

const navigationItems = [{ icon: FileText, label: 'CRUD Operations', href: '/posts' }];

const playgroundItems = [
  { label: 'Generate Text', href: '/playground/generate-text/' },
  {
    label: 'Generate Images',
    href: '/playground/generate-image',
  },
  { label: 'Chat', href: '/playground/chat' },
  { label: 'Web Search', href: '/playground/web-search' },
];

const settingsItems = [
  {
    icon: MessageCircle,
    label: 'Get Help',
    href: 'https://www.skool.com/ai-builders-6997/about?ref=873c5678d6d845feba1c23c6dbccdce3',
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [playgroundOpen, setPlaygroundOpen] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  return (
    <div className="w-64 border-r bg-card/50 flex flex-col">
      {/* Navigation Section */}
      <div className="p-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Navigate</h2>
        <nav className="space-y-1">
          {navigationItems.map((item) => (
            <Link key={item.label} href={item.href}>
              <Button
                variant={pathname === item.href ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start gap-3 h-9',
                  pathname === item.href && 'bg-secondary',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>
      </div>

      <Separator />

      {/* AI Playground Section */}
      <div className="p-4">
        <Collapsible open={playgroundOpen} onOpenChange={setPlaygroundOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between h-8 text-sm font-medium text-muted-foreground hover:text-foreground p-0"
            >
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                AI Playground
              </div>
              <ChevronRight
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  playgroundOpen && 'rotate-90',
                )}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-2">
            {playgroundItems.map((item) => (
              <Link key={item.label} href={item.href}>
                <Button
                  variant={pathname === item.href ? 'secondary' : 'ghost'}
                  className={cn(
                    'w-full justify-start gap-3 h-9 pl-6',
                    pathname === item.href && 'bg-secondary',
                  )}
                >
                  {item.label}
                </Button>
              </Link>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>

      <Separator />

      {/* Settings Section */}
      <div className="p-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Settings</h2>
        <nav className="space-y-1">
          {settingsItems.map((item) => (
            <Button
              key={item.label}
              variant="ghost"
              className="w-full justify-start gap-3 h-9"
              asChild
            >
              <a href={item.href} target="_blank" rel="noopener noreferrer">
                <item.icon className="h-4 w-4" />
                {item.label}
              </a>
            </Button>
          ))}

          {/* Theme Toggle */}
          {mounted && (
            <Button
              variant="ghost"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="w-full justify-start gap-3 h-9"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              Toggle Theme
            </Button>
          )}

          {/* Logout Button */}
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-3 h-9 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </Button>
        </nav>
      </div>

      {/* Spacer */}
      <div className="flex-1" />
    </div>
  );
}
