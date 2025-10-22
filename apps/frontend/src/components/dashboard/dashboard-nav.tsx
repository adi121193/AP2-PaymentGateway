'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Bot,
  Plus,
  DollarSign,
  Key,
  User,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { Separator } from '@/components/ui/separator';

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'My Agents',
    href: '/dashboard/agents',
    icon: Bot,
  },
  {
    label: 'Register Agent',
    href: '/dashboard/agents/register',
    icon: Plus,
  },
  {
    label: 'Revenue',
    href: '/dashboard/revenue',
    icon: DollarSign,
  },
  {
    label: 'API Keys',
    href: '/dashboard/api-keys',
    icon: Key,
  },
  {
    label: 'Profile',
    href: '/dashboard/profile',
    icon: User,
  },
];

export function DashboardNav() {
  const pathname = usePathname();
  const { developer, logout } = useAuthStore();

  return (
    <aside className="w-64 border-r bg-card">
      <div className="sticky top-0 flex h-screen flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60" />
            <span className="text-xl font-bold">FrameOS</span>
          </Link>
        </div>

        {/* Developer Info */}
        <div className="border-b p-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              {developer?.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{developer?.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {developer?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center space-x-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <Separator />

        {/* Logout */}
        <div className="p-4">
          <Button
            variant="ghost"
            onClick={logout}
            className="w-full justify-start text-muted-foreground"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </Button>
        </div>
      </div>
    </aside>
  );
}
