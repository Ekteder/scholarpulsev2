'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Shield,
  BookOpen,
  CheckSquare,
  Calendar,
  Award,
  Settings,
  ArrowLeft,
  Sun,
  Moon,
  Menu,
  X,
  LayoutDashboard,
  ShieldCheck,
  ChevronRight,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/lib/auth';

export interface AdminShellProps {
  user: SessionUser;
  children: React.ReactNode;
}

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

export const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    title: 'Overview',
    href: '/admin',
    icon: LayoutDashboard,
    description: 'System health, quick metrics, and live status',
  },
  {
    title: 'Users',
    href: '/admin/users',
    icon: Users,
    description: 'Inspect user data, ban/unban, and send targeted announcements',
  },
  {
    title: 'Subjects & Topics',
    href: '/admin/subjects',
    icon: BookOpen,
    description: 'Manage curriculum subjects, papers, and chapter topics',
  },
  {
    title: 'Checklist Stages',
    href: '/admin/checklist',
    icon: CheckSquare,
    description: 'Define syllabus progress stages, colors, and order',
  },
  {
    title: 'Goals & Timetable',
    href: '/admin/goals',
    icon: Calendar,
    description: 'Study goal templates and weekly routine presets',
  },
  {
    title: 'Badges & Rewards',
    href: '/admin/badges',
    icon: Award,
    description: 'Gamification badges, tiers, XP, and secret unlocks',
  },
  {
    title: 'System & Allowlist',
    href: '/admin/system',
    icon: Settings,
    description: 'Admin account allowlist and runtime system configs',
  },
];

export function AdminShell({ user, children }: AdminShellProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    if (typeof document !== 'undefined') {
      if (nextTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    setTheme(nextTheme);
  };

  const currentNav = ADMIN_NAV_ITEMS.find((item) =>
    item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
  ) || ADMIN_NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {/* Mobile Drawer (visible on < lg) */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-card border-r border-border flex flex-col z-10 shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <span className="font-display font-bold text-sm text-foreground">ScholarPulse Admin</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileDrawerOpen(false)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Close admin menu"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <nav role="navigation" className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
              {ADMIN_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === '/admin'
                    ? pathname === '/admin'
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-3 border-t border-border space-y-2">
              <Link
                href="/"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <ArrowLeft className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Return to Student App</span>
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Sticky Topbar */}
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-xs border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-3 w-full min-w-0">
          <div className="max-w-[1400px] w-full mx-auto flex items-center justify-between gap-2 sm:gap-4">
            {/* Left: Mobile Toggle & Breadcrumbs */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setMobileDrawerOpen(true)}
                className="lg:hidden h-8 w-8 text-muted-foreground shrink-0"
                aria-label="Open admin navigation menu"
              >
                <Menu className="w-4 h-4" />
              </Button>

              <nav role="navigation" aria-label="Admin header navigation" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground truncate">
                <Link
                  href="/admin"
                  className="font-display font-bold text-foreground hover:text-primary transition-colors shrink-0"
                >
                  Admin Console
                </Link>
                {pathname !== '/admin' && (
                  <>
                    <span className="text-muted-foreground/40 shrink-0">/</span>
                    <span className="text-blue-600 dark:text-blue-400 font-semibold truncate">
                      {currentNav.title}
                    </span>
                  </>
                )}
              </nav>
            </div>

            {/* Right: Quick Actions & Dual Theme Switcher */}
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/"
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Student App</span>
              </Link>

              {/* Dual Theme Toggle */}
              <Button
                variant="outline"
                size="icon"
                onClick={toggleTheme}
                aria-label="Toggle theme (light / dark mode)"
                className="h-8 w-8 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-500" data-icon="sun" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-blue-400" data-icon="moon" />
                <span className="sr-only">Toggle theme</span>
              </Button>

              {/* User Avatar Badge */}
              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border">
                <div className="w-7 h-7 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center shrink-0">
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="hidden md:block text-left text-xs leading-none">
                  <p className="font-semibold text-foreground truncate max-w-[120px]">{user.name}</p>
                  <p className="text-[10px] text-muted-foreground">Admin</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Horizontal Subnavigation Bar */}
        <nav
          role="navigation"
          aria-label="Admin mobile navigation"
          className="lg:hidden flex items-center gap-1.5 overflow-x-auto px-4 py-2 bg-background border-b border-border text-xs scrollbar-none whitespace-nowrap"
        >
          {ADMIN_NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-2.5 py-1 rounded-full font-medium transition-colors shrink-0',
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>

        {/* Dynamic Route Body */}
        <main role="main" className="flex-1 w-full max-w-[1400px] mx-auto px-3 sm:px-6 py-4 sm:py-6 min-w-0">
          {children}
        </main>
      </div>

      {/* Desktop Sidebar (lg and above) */}
      <aside
        data-slot="sidebar"
        className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-card border-r border-border flex-col z-30 shadow-xs select-none"
      >
        {/* Brand / Console Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-display font-bold text-sm shadow-sm">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="font-display font-bold text-sm leading-tight text-foreground flex items-center gap-1.5">
                ScholarPulse
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-semibold text-blue-600 dark:text-blue-400">
                  Admin
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">v2.0 Console</p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav role="navigation" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors group relative',
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon
                  className={cn(
                    'w-4 h-4 shrink-0 transition-transform group-hover:scale-105',
                    isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
                  )}
                />
                <span className="truncate flex-1">{item.title}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-70" />}
              </Link>
            );
          })}
        </nav>

        {/* Back to Student Workspace Link */}
        <div className="p-3 border-t border-border">
          <Link
            href="/"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="truncate">Student Workspace</span>
          </Link>
        </div>

        {/* Active Admin User Card */}
        <div className="p-3 border-t border-border bg-muted/30">
          <div className="flex items-center gap-2.5 px-1 py-1">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover shrink-0 border border-border"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-600/15 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center shrink-0">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
            </div>
            <span title="Allowlisted Administrator">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}
