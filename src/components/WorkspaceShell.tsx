'use client';

import React, { useState } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { AuthScreen } from './AuthScreen';
import { OnboardingModal } from './OnboardingModal';
import { FloatingMiniTimer } from './FloatingMiniTimer';

// Code-split all major views for instant loading
const DashboardView = React.lazy(() =>
  import('./DashboardView').then((m) => ({ default: m.DashboardView }))
);
const StudyTrackerView = React.lazy(() =>
  import('./StudyTrackerView').then((m) => ({ default: m.StudyTrackerView }))
);
const StudyTimerView = React.lazy(() =>
  import('./StudyTimerView').then((m) => ({ default: m.StudyTimerView }))
);
const SubjectsView = React.lazy(() =>
  import('./SubjectsView').then((m) => ({ default: m.SubjectsView }))
);
const ScheduleAndTasksView = React.lazy(() =>
  import('./ScheduleAndTasksView').then((m) => ({ default: m.ScheduleAndTasksView }))
);
const GoalsView = React.lazy(() =>
  import('./GoalsView').then((m) => ({ default: m.GoalsView }))
);
const AnalyticsView = React.lazy(() =>
  import('./AnalyticsView').then((m) => ({ default: m.AnalyticsView }))
);
const StudyHistoryView = React.lazy(() =>
  import('./StudyHistoryView').then((m) => ({ default: m.StudyHistoryView }))
);
const AchievementsView = React.lazy(() =>
  import('./AchievementsView').then((m) => ({ default: m.AchievementsView }))
);
const SettingsView = React.lazy(() =>
  import('./SettingsView').then((m) => ({ default: m.SettingsView }))
);
const RevisionTrackerView = React.lazy(() =>
  import('./RevisionTrackerView').then((m) => ({ default: m.RevisionTrackerView }))
);

import {
  PWAInstallButton,
  PWAInstallModal,
  OfflineConnectivityBanner,
} from './PWAInstallUI';
import { CreatorAttribution } from './CreatorAttribution';
import { GamificationBadge } from './GamificationBadge';
import { RealtimeSyncBadge } from './RealtimeSyncBadge';
import { notificationService } from '@/lib/notifications';
import { NavigationTab } from '@/types/index';
import {
  Award,
  BarChart3,
  BookOpen,
  BookOpenCheck,
  Calendar,
  ClipboardList,
  History,
  LayoutDashboard,
  Menu,
  Moon,
  MoreHorizontal,
  Play,
  Settings,
  Sun,
  Target,
  Timer,
  X,
} from 'lucide-react';
import { useTheme } from 'next-themes';

const NAV_ITEMS: Array<{
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tracker', label: 'Study Tracker', icon: ClipboardList },
  { id: 'timer', label: 'Study Timer', icon: Timer },
  { id: 'revision', label: 'Revision Tracker', icon: BookOpenCheck },
  { id: 'subjects', label: 'Subjects', icon: BookOpen },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'history', label: 'Study History', icon: History },
  { id: 'achievements', label: 'Achievements', icon: Award },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function WorkspaceShell() {
  const {
    user,
    authLoading,
    workspaceLoading,
    workspaceError,
    data,
    activeTab,
    setActiveTab,
    setSelectedSubjectId,
    toasts,
    dismissToast,
    setThemePreference,
    refreshWorkspace,
    activeTimer,
  } = useWorkspace();

  const { theme, resolvedTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [visitedTabs, setVisitedTabs] = useState<Set<NavigationTab>>(() => new Set([activeTab]));

  React.useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  // Preload views in background
  React.useEffect(() => {
    const timer = setTimeout(() => {
      import('./DashboardView');
      import('./StudyTrackerView');
      import('./StudyTimerView');
      import('./SubjectsView');
      import('./RevisionTrackerView');
      import('./ScheduleAndTasksView');
      import('./GoalsView');
      import('./AnalyticsView');
      import('./StudyHistoryView');
      import('./AchievementsView');
      import('./SettingsView');
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // Background Notification Scheduler
  React.useEffect(() => {
    if (data) {
      notificationService.startBackgroundScheduler(data);
    }
    return () => {
      notificationService.stopBackgroundScheduler();
    };
  }, [data]);

  if (workspaceError && !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-xl">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 font-display font-bold flex items-center justify-center mx-auto">
            !
          </div>
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Could Not Load Workspace
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{workspaceError}</p>
          <button
            type="button"
            onClick={refreshWorkspace}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer transition-colors shadow-xs"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!user && !authLoading) {
    return <AuthScreen />;
  }

  if (authLoading && !user && !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="space-y-3 text-center">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-display font-bold flex items-center justify-center mx-auto animate-pulse">
            SP
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Verifying academic workspace session...
          </p>
        </div>
      </div>
    );
  }

  if (workspaceLoading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-4">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse mx-auto" />
          <div className="h-32 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
            <div className="h-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const currentNavLabel =
    NAV_ITEMS.find((item) => item.id === activeTab)?.label || 'Dashboard';

  const handleSelectNav = (tab: NavigationTab) => {
    setActiveTab(tab);
    if (tab !== 'subjects') {
      setSelectedSubjectId(null);
    }
    setMobileMenuOpen(false);
  };

  const toggleTheme = () => {
    const isCurrentlyDark =
      typeof document !== 'undefined'
        ? document.documentElement.classList.contains('dark')
        : (resolvedTheme || theme) === 'dark';
    const nextTheme = isCurrentlyDark ? 'light' : 'dark';
    setThemePreference(nextTheme);
  };

  return (
    <div className="min-h-screen min-h-dvh bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex w-full max-w-full overflow-x-clip">
      {/* Onboarding Modal for new accounts */}
      {data && !data.profile.onboardingCompleted && <OnboardingModal />}

      {/* Desktop Sidebar (256px width) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-30">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-display font-bold text-sm shrink-0">
              SP
            </div>
            <span className="font-display font-bold text-base tracking-tight text-slate-900 dark:text-white truncate">
              ScholarPulse
            </span>
          </div>
          <RealtimeSyncBadge variant="sidebar" />
        </div>

        {/* Scholar Rank in Desktop Sidebar */}
        <div className="px-3 pt-3 pb-1">
          <GamificationBadge variant="sidebar" />
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* PWA Sidebar Install Card */}
        <div className="px-3 pb-2">
          <PWAInstallButton variant="sidebar" />
        </div>

        {/* User Footer Card */}
        {data && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => handleSelectNav('settings')}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer"
            >
              {data.profile.avatarUrl ? (
                <img
                  src={data.profile.avatarUrl}
                  alt={data.profile.fullName}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600/15 text-blue-600 dark:text-blue-400 font-display font-bold text-xs flex items-center justify-center shrink-0">
                  {data.profile.fullName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {data.profile.fullName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {data.profile.timezone}
                </p>
              </div>
            </button>
          </div>
        )}

        <div className="px-3 pb-3 pt-1">
          <CreatorAttribution variant="sidebar" />
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-10 shadow-2xl">
            <div className="px-4 sm:px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-display font-bold text-xs flex items-center justify-center shrink-0">
                  SP
                </div>
                <span className="font-display font-bold text-sm truncate">ScholarPulse</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <RealtimeSyncBadge variant="drawer" />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scholar Rank in Mobile Drawer */}
            <div className="px-3 pt-3 pb-1">
              <GamificationBadge variant="drawer" />
            </div>

            <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectNav(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {data && (
              <div className="p-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleSelectNav('settings')}
                  className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer"
                >
                  {data.profile.avatarUrl ? (
                    <img
                      src={data.profile.avatarUrl}
                      alt={data.profile.fullName}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-600/15 text-blue-600 dark:text-blue-400 font-display font-bold text-xs flex items-center justify-center shrink-0">
                      {data.profile.fullName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {data.profile.fullName}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {data.profile.timezone}
                    </p>
                  </div>
                </button>
              </div>
            )}

            <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <PWAInstallButton variant="sidebar" />
              <CreatorAttribution variant="sidebar" />
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 sm:pb-3.5 flex items-center justify-between gap-2 sm:gap-4 w-full min-w-0">
          {/* Zone 1: Mobile Menu Trigger + Breadcrumb Trail */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 cursor-pointer transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
              <span className="font-display font-bold text-slate-900 dark:text-white shrink-0">
                Workspace
              </span>
              <span className="text-slate-300 dark:text-slate-700 shrink-0">/</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold truncate">
                {currentNavLabel}
              </span>
            </div>
          </div>

          {/* Zone 2: Navigation Shortcuts on desktop */}
          <nav className="hidden xl:flex items-center gap-5 text-xs font-medium text-slate-600 dark:text-slate-400">
            <button
              type="button"
              onClick={() => handleSelectNav('dashboard')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => handleSelectNav('revision')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer font-semibold text-blue-600 dark:text-blue-400"
            >
              Revision
            </button>
            <button
              type="button"
              onClick={() => handleSelectNav('subjects')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Subjects ({data?.subjects.filter((s) => !s.isArchived).length || 0})
            </button>
            <button
              type="button"
              onClick={() => handleSelectNav('schedule')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Timetable & Tasks
            </button>
            <button
              type="button"
              onClick={() => handleSelectNav('analytics')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Analytics
            </button>
          </nav>

          {/* Zone 3: Live Sync, Gamification, Theme Toggle & Primary Action */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <RealtimeSyncBadge variant="header" />
            <GamificationBadge variant="header" />

            <div className="hidden sm:block">
              <PWAInstallButton variant="header" />
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              title="Toggle theme"
              aria-label="Toggle theme"
              className="p-1.5 sm:p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <Sun className="w-4 h-4 hidden dark:block" />
              <Moon className="w-4 h-4 block dark:hidden" />
            </button>

            <button
              type="button"
              onClick={() => handleSelectNav('timer')}
              className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
            >
              <Play className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Study </span>
              <span>Timer</span>
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-[1400px] w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28 lg:pb-8">
          <React.Suspense
            fallback={
              <div className="space-y-4 animate-pulse">
                <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                <div className="h-48 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl" />
              </div>
            }
          >
            {visitedTabs.has('dashboard') && (
              <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
                <DashboardView />
              </div>
            )}
            {visitedTabs.has('tracker') && (
              <div className={activeTab === 'tracker' ? 'block' : 'hidden'}>
                <StudyTrackerView />
              </div>
            )}
            {visitedTabs.has('timer') && (
              <div className={activeTab === 'timer' ? 'block' : 'hidden'}>
                <StudyTimerView />
              </div>
            )}
            {visitedTabs.has('revision') && (
              <div className={activeTab === 'revision' ? 'block' : 'hidden'}>
                <RevisionTrackerView />
              </div>
            )}
            {visitedTabs.has('subjects') && (
              <div className={activeTab === 'subjects' ? 'block' : 'hidden'}>
                <SubjectsView />
              </div>
            )}
            {visitedTabs.has('schedule') && (
              <div className={activeTab === 'schedule' ? 'block' : 'hidden'}>
                <ScheduleAndTasksView />
              </div>
            )}
            {visitedTabs.has('goals') && (
              <div className={activeTab === 'goals' ? 'block' : 'hidden'}>
                <GoalsView />
              </div>
            )}
            {visitedTabs.has('analytics') && (
              <div className={activeTab === 'analytics' ? 'block' : 'hidden'}>
                <AnalyticsView />
              </div>
            )}
            {visitedTabs.has('history') && (
              <div className={activeTab === 'history' ? 'block' : 'hidden'}>
                <StudyHistoryView />
              </div>
            )}
            {visitedTabs.has('achievements') && (
              <div className={activeTab === 'achievements' ? 'block' : 'hidden'}>
                <AchievementsView />
              </div>
            )}
            {visitedTabs.has('settings') && (
              <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
                <SettingsView />
              </div>
            )}
          </React.Suspense>
        </main>

        <footer className="lg:hidden px-3 sm:px-6 pb-24 pt-1 max-w-[1400px] w-full mx-auto">
          <CreatorAttribution variant="sidebar" />
        </footer>
      </div>

      {/* Mobile Native Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-lg"
      >
        <button
          type="button"
          onClick={() => handleSelectNav('dashboard')}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 px-1 sm:px-2 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer min-w-0 ${
            activeTab === 'dashboard'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 shrink-0" />
          <span className="truncate max-w-full text-center leading-tight">Dashboard</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectNav('timer')}
          className={`flex-1 relative flex flex-col items-center justify-center gap-0.5 py-1 px-1 sm:px-2 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer min-w-0 ${
            activeTab === 'timer'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <div className="relative">
            <Timer className="w-5 h-5 shrink-0" />
            {activeTimer?.status === 'running' && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse ring-2 ring-white dark:ring-slate-900" />
            )}
          </div>
          <span className="truncate max-w-full text-center leading-tight">Timer</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectNav('tracker')}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 px-1 sm:px-2 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer min-w-0 ${
            activeTab === 'tracker'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ClipboardList className="w-5 h-5 shrink-0" />
          <span className="truncate max-w-full text-center leading-tight">Tracker</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectNav('subjects')}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 px-1 sm:px-2 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer min-w-0 ${
            activeTab === 'subjects'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BookOpen className="w-5 h-5 shrink-0" />
          <span className="truncate max-w-full text-center leading-tight">Subjects</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 px-1 sm:px-2 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer min-w-0 ${
            [
              'revision',
              'schedule',
              'goals',
              'analytics',
              'history',
              'achievements',
              'settings',
            ].includes(activeTab)
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <MoreHorizontal className="w-5 h-5 shrink-0" />
          <span className="truncate max-w-full text-center leading-tight">More</span>
        </button>
      </nav>

      <FloatingMiniTimer />
      <PWAInstallModal />
      <OfflineConnectivityBanner />

      {/* Toast Notifications Stack */}
      {toasts.length > 0 && (
        <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto p-3.5 rounded-xl border shadow-lg flex items-start justify-between gap-3 text-xs transition-all ${
                t.variant === 'error'
                  ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900 text-red-900 dark:text-red-200'
                  : t.variant === 'warning'
                  ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200'
                  : t.variant === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white'
              }`}
            >
              <div className="space-y-0.5">
                <p className="font-display font-bold">{t.title}</p>
                {t.description && (
                  <p className="opacity-85 leading-relaxed">{t.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="opacity-60 hover:opacity-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
