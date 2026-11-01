'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Target,
  BarChart3,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import {
  PWAInstallButton,
  PWAInstallModal,
  OfflineConnectivityBanner,
} from './PWAInstallUI';
import { CreatorAttribution } from './CreatorAttribution';

export function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check for any OAuth errors returned via query parameters
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('authError');
    if (authError) {
      if (authError === 'missing_code') {
        setErrorMsg('Google sign-in was cancelled or code was missing. Please try again.');
      } else if (authError === 'token_exchange_failed') {
        setErrorMsg('Google sign-in token exchange failed. Please verify client secret.');
      } else {
        setErrorMsg('Sign-in encountered an error. Please try again.');
      }
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const handleGoogleSignIn = () => {
    setErrorMsg(null);
    setLoading(true);
    // 100% first-party navigation to Next.js OAuth initiation route
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="flex items-center justify-between gap-4 lg:gap-8 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2.5 whitespace-nowrap">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-display font-bold text-sm">
              SP
            </div>
            <span className="font-display font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
              ScholarPulse
            </span>
          </div>
          <div className="hidden sm:block">
            <CreatorAttribution variant="login-brand" />
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
          <span className="whitespace-nowrap shrink-0">Study Timer</span>
          <span className="whitespace-nowrap shrink-0">Subject Analytics</span>
          <span className="whitespace-nowrap shrink-0">Weekly Timetables</span>
          <span className="whitespace-nowrap shrink-0">Goal Tracking</span>
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <PWAInstallButton variant="auth" />
        </div>
      </header>

      {/* Main Split Container: On Mobile, the Google Sign-In Card is immediately at the top (order-1) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-12 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center">
        {/* Left Column on Desktop / Bottom Column on Mobile */}
        <div className="w-full lg:col-span-7 order-2 lg:order-1 space-y-6 sm:space-y-8">
          <div className="space-y-3 sm:space-y-4">
            <p className="text-xs font-semibold tracking-wider text-blue-600 dark:text-blue-400 uppercase">
              Academic Productivity & Analytics Platform
            </p>
            <h1
              className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.12]"
              style={{ textWrap: 'balance' }}
            >
              Make every study hour measurable, structured, and rewarding.
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
              Organize your subjects, track focus sessions with a timestamp-accurate
              Pomodoro and Stopwatch timer, compare planned timetables against actual
              study hours, and build lasting academic consistency.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 pt-1 sm:pt-2">
            <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 sm:space-y-2">
              <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-display font-semibold text-sm">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Authoritative Cloud Timer</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Stopwatch and configurable Pomodoro modes anchored by database timestamps—never lose progress across page refreshes or devices.
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 sm:space-y-2">
              <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-display font-semibold text-sm">
                <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Planned vs. Actual Analytics</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Inspect 365-day activity heatmaps, weekly comparison reports, subject distributions, and timetable adherence.
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 sm:space-y-2">
              <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-display font-semibold text-sm">
                <Target className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Multi-Horizon Study Goals</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Set daily, weekly, monthly, and subject-specific targets that automatically recalculate as you log sessions.
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 sm:space-y-2">
              <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-display font-semibold text-sm">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Isolated Private Accounts</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Every student account is strictly isolated with server-side ownership validation and full JSON/CSV data portability.
              </p>
            </div>
          </div>

          {/* Prominent Creator Attribution Card on Welcome Hero */}
          <div className="pt-2">
            <CreatorAttribution variant="login-banner" className="w-full sm:w-auto" />
          </div>
        </div>

        {/* Right Column on Desktop / Top Column on Mobile */}
        <div className="w-full lg:col-span-5 order-1 lg:order-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-8 lg:p-10 shadow-lg space-y-6 sm:space-y-8">
            <div className="space-y-2 text-center">
              <div className="inline-flex w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/80 border border-blue-100 dark:border-blue-800/80 items-center justify-center text-blue-600 dark:text-blue-400 mb-1 sm:mb-2">
                <Sparkles className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Welcome to ScholarPulse
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                Sign in with your Google account to access your personal academic workspace, cloud timers, and study analytics.
              </p>
            </div>

            {errorMsg && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-3 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Google Sign-In Action */}
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3.5 px-5 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/80 font-semibold text-sm flex items-center justify-center gap-3 transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
              >
                {/* Official Google G Logo */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{loading ? 'Signing you in...' : 'Sign In with Google'}</span>
                <ArrowRight className="w-4 h-4 ml-auto text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </button>

              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Instant 1-click access • No password needed</span>
              </div>
            </div>

            {/* Privacy & Account Isolation Note */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-200">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Private & Secure Workspace</span>
              </div>
              <p className="leading-relaxed text-[11px] text-slate-500 dark:text-slate-400">
                Your study habits, schedules, and timer analytics are stored under your unique Google account ID and isolated with server-side authorization.
              </p>
            </div>

            {/* Creator Attribution inside Auth Card */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex justify-center">
              <CreatorAttribution variant="login-brand" />
            </div>
          </div>
        </div>
      </main>

      <PWAInstallModal />
      <OfflineConnectivityBanner />
    </div>
  );
}
