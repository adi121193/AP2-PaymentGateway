/**
 * Navigation Bar Component
 *
 * Main navigation for the application with:
 * - Public marketplace link
 * - Developer portal link (protected)
 * - Auth buttons (login/signup or user menu)
 */

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Store, Code2, User, LogOut } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, developer, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <nav className="border-b bg-white">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold">
                F
              </div>
              <span>FrameOS</span>
            </Link>

            {/* Main Navigation */}
            <div className="hidden md:flex items-center gap-6">
              <Link
                href="/marketplace"
                className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-blue-600 ${
                  pathname?.startsWith('/marketplace')
                    ? 'text-blue-600'
                    : 'text-gray-700'
                }`}
              >
                <Store className="h-4 w-4" />
                Marketplace
              </Link>

              {isAuthenticated && (
                <Link
                  href="/dashboard"
                  className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-blue-600 ${
                    pathname?.startsWith('/dashboard')
                      ? 'text-blue-600'
                      : 'text-gray-700'
                  }`}
                >
                  <Code2 className="h-4 w-4" />
                  Developer
                </Link>
              )}
            </div>
          </div>

          {/* Auth Section */}
          <div className="flex items-center gap-4">
            {isAuthenticated && developer ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-10 w-10 rounded-full p-0">
                    <Avatar>
                      <AvatarFallback className="bg-blue-600 text-white">
                        {getInitials(developer.name)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{developer.name}</p>
                      <p className="text-xs text-gray-500">{developer.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                    <Code2 className="mr-2 h-4 w-4" />
                    Developer Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => router.push('/login')}
                  className="hidden sm:inline-flex"
                >
                  Login
                </Button>
                <Button onClick={() => router.push('/signup')}>Get Started</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
