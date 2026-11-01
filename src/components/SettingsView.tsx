'use client';

import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { SUPPORTED_TIMEZONES, toDateStringInTz } from '@/lib/timezone';
import {
  playTimerChime,
  requestBrowserNotificationPermission,
  sendBrowserNotification,
} from '@/lib/audio';
import { notificationService } from '@/lib/notifications';
import { useTheme } from 'next-themes';
import {
  AlertTriangle,
  Bell,
  BellRing,
  Download,
  Globe,
  LogOut,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  User as UserIcon,
  Volume2,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallUI';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export function SettingsView() {
  const {
    data,
    user,
    updateProfile,
    updateNotificationPrefs,
    restoreBackup,
    deleteAccount,
    signOut,
    addToast,
  } = useWorkspace();

  const { theme, setTheme } = useTheme();

  const profile = data?.profile;
  const { isInstalled, isStandalone, swRegistered, canTriggerNativePrompt } =
    usePWAInstall();

  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || '');
  const [dailyTargetHours, setDailyTargetHours] = useState(
    Number(((profile?.dailyStudyTargetMinutes || 360) / 60).toFixed(1))
  );
  const [preferredStudyTime, setPreferredStudyTime] = useState(
    profile?.preferredStudyTime || 'evening'
  );
  const [timezone, setTimezone] = useState(profile?.timezone || 'Asia/Dhaka');
  const [targetExamName, setTargetExamName] = useState(
    profile?.targetExamName || 'HSC 2026'
  );
  const [targetExamDate, setTargetExamDate] = useState(
    profile?.targetExamDate || '2026-06-15'
  );
  const [themePref, setThemePref] = useState(profile?.themePreference || theme || 'light');
  const [focusMins, setFocusMins] = useState(profile?.pomodoroFocusMinutes || 25);
  const [shortBreakMins, setShortBreakMins] = useState(
    profile?.pomodoroShortBreakMinutes || 5
  );
  const [longBreakMins, setLongBreakMins] = useState(
    profile?.pomodoroLongBreakMinutes || 15
  );
  const [longBreakInterval, setLongBreakInterval] = useState(
    profile?.pomodoroLongBreakInterval || 4
  );

  // Keep local theme and profile selection in sync
  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName);
      setAvatarUrl(profile.avatarUrl || '');
      setDailyTargetHours(Number(((profile.dailyStudyTargetMinutes || 360) / 60).toFixed(1)));
      setPreferredStudyTime(profile.preferredStudyTime || 'evening');
      setTimezone(profile.timezone || 'Asia/Dhaka');
      setTargetExamName(profile.targetExamName || 'HSC 2026');
      setTargetExamDate(profile.targetExamDate || '2026-06-15');
      setFocusMins(profile.pomodoroFocusMinutes || 25);
      setShortBreakMins(profile.pomodoroShortBreakMinutes || 5);
      setLongBreakMins(profile.pomodoroLongBreakMinutes || 15);
      setLongBreakInterval(profile.pomodoroLongBreakInterval || 4);
      if (profile.themePreference) {
        setThemePref(profile.themePreference);
      }
    } else if (theme) {
      setThemePref(theme);
    }
  }, [profile, theme]);

  // Backup & Restore state
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [restoring, setRestoring] = useState(false);

  // Account deletion confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    setThemePref(newTheme);
    updateProfile({ themePreference: newTheme });
  };

  const handleSaveProfileAndStudy = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      fullName: fullName.trim() || 'Student Scholar',
      avatarUrl: avatarUrl.trim(),
      dailyStudyTargetMinutes: Math.max(15, Math.round(dailyTargetHours * 60)),
      preferredStudyTime,
      timezone,
      themePreference: themePref,
      targetExamName: targetExamName.trim(),
      targetExamDate,
      pomodoroFocusMinutes: focusMins,
      pomodoroShortBreakMinutes: shortBreakMins,
      pomodoroLongBreakMinutes: longBreakMins,
      pomodoroLongBreakInterval: longBreakInterval,
    });
  };

  const handleToggleBrowserNotifications = async (enabled: boolean) => {
    if (enabled) {
      const perm = await requestBrowserNotificationPermission();
      if (perm !== 'granted') {
        addToast({
          title: 'Browser Permission Denied',
          description:
            'Please allow notifications in your browser site settings to enable desktop alerts.',
          variant: 'warning',
        });
        return;
      }
      sendBrowserNotification(
        'ScholarPulse Notifications Active',
        'You will receive active-tab study reminders and Pomodoro completion alerts.'
      );
    }
    await updateNotificationPrefs({ browserNotificationsEnabled: enabled });
  };

  const handleExportFullJsonBackup = () => {
    if (!data) return;
    const todayYmd = toDateStringInTz(new Date(), timezone);
    const backupBundle = {
      schemaVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      application: 'ScholarPulse Daily Study Tracker',
      data: {
        profile: data.profile,
        notificationPreferences: data.notificationPreferences,
        subjects: data.subjects,
        studySessions: data.studySessions,
        tasks: data.tasks,
        schedules: data.schedules,
        goals: data.goals,
        userAchievements: data.userAchievements,
      },
    };

    const blob = new Blob([JSON.stringify(backupBundle, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ScholarPulse_Backup_${todayYmd}.json`;
    a.click();
    URL.revokeObjectURL(url);

    addToast({
      title: 'Personal Backup Exported',
      description: 'Downloaded your complete JSON account backup.',
      variant: 'success',
    });
  };

  const handleImportJsonBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const payload = parsed.data || parsed;
      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid JSON backup file.');
      }
      await restoreBackup(restoreMode, payload);
    } catch (err: any) {
      addToast({
        title: 'Backup Restore Failed',
        description: err.message || 'Please upload a valid ScholarPulse JSON backup.',
        variant: 'error',
      });
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setDeleting(true);
    try {
      await deleteAccount();
    } finally {
      setDeleting(false);
    }
  };

  if (!data) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 1. Profile & Study Preferences */}
      <form
        onSubmit={handleSaveProfileAndStudy}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6"
      >
        <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-4">
          <UserIcon className="w-5 h-5 text-blue-600" />
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Profile & Study Preferences
            </h2>
            <p className="text-xs text-slate-500">
              Manage your personal profile, timezone, daily target, and Pomodoro defaults
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Account Email (Verified Identity)
            </label>
            <input
              type="email"
              disabled
              value={user?.email || data.profile.email}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Profile Picture URL
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Daily Study Target (Hours)
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="18"
              value={dailyTargetHours}
              onChange={(e) => setDailyTargetHours(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Preferred Study Hours
            </label>
            <select
              value={preferredStudyTime}
              onChange={(e) => setPreferredStudyTime(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="morning">Morning (5:00 AM – 12:00 PM)</option>
              <option value="afternoon">Afternoon (12:00 PM – 5:00 PM)</option>
              <option value="evening">Evening (5:00 PM – 10:00 PM)</option>
              <option value="night">Late Night (10:00 PM – 3:00 AM)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Target Exam Name
            </label>
            <input
              type="text"
              value={targetExamName}
              onChange={(e) => setTargetExamName(e.target.value)}
              placeholder="e.g. HSC 2026, MCAT, SAT"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Target Exam Date
            </label>
            <input
              type="date"
              value={targetExamDate}
              onChange={(e) => setTargetExamDate(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Time Zone (Default: Asia/Dhaka)
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {SUPPORTED_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-blue-600" />
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Appearance & Theme
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'light' as const, label: 'Light Mode', icon: Sun },
              { id: 'dark' as const, label: 'Dark Mode', icon: Moon },
              { id: 'system' as const, label: 'System Preference', icon: Palette },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleThemeChange(item.id)}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    themePref === item.id
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pomodoro Defaults */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Default Pomodoro Durations
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Focus (mins)
              </label>
              <input
                type="number"
                min={1}
                max={180}
                value={focusMins}
                onChange={(e) => setFocusMins(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Short Break (mins)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={shortBreakMins}
                onChange={(e) => setShortBreakMins(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Long Break (mins)
              </label>
              <input
                type="number"
                min={1}
                max={90}
                value={longBreakMins}
                onChange={(e) => setLongBreakMins(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Long Break After
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={longBreakInterval}
                onChange={(e) => setLongBreakInterval(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
          >
            Save Profile & Study Preferences
          </button>
        </div>
      </form>

      {/* 2. Transparent Notifications & Reminders */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Notifications, Audio Chimes & Reminders
              </h2>
              <p className="text-xs text-slate-500">
                Configure in-app alerts, synthesized Web Audio chimes, and active-tab Browser Notifications
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const perm = await notificationService.requestPermission();
                if (perm) {
                  notificationService.send(
                    '🔥 Streak Protection Alert Test',
                    {
                      body: 'Your daily study streak is active! Keep up the momentum to reach your exam target.',
                    }
                  );
                  playTimerChime('focus_end');
                  addToast({
                    title: 'Test Notification Dispatched',
                    description: 'Dispatched browser notification & streak alarm audio chime.',
                    variant: 'success',
                  });
                } else {
                  addToast({
                    title: 'Notification Permission Denied',
                    description: 'Please enable notifications in your browser site permissions.',
                    variant: 'warning',
                  });
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300 text-xs font-medium flex items-center gap-1.5 hover:bg-blue-100 cursor-pointer"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>Test Notification & Streak Alarm</span>
            </button>

            <button
              type="button"
              onClick={() => playTimerChime('focus_end')}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-slate-700 dark:text-slate-300"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Test Audio Chime</span>
            </button>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          <strong>Notification Delivery Scope:</strong> Audio chimes (Web Audio API),
          in-app toast reminders, and desktop Browser Notifications (Web{' '}
          <code>Notification</code> API) operate while ScholarPulse is open in an
          active or backgrounded browser tab. Closed-browser push notifications are
          not sent unless an external push server is attached.
        </div>

        <div className="space-y-3 text-xs">
          <label className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 cursor-pointer">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">
                Pomodoro & Timer Audio Chimes
              </p>
              <p className="text-slate-500">
                Play a pleasant synthesized tone when Pomodoro focus or break intervals finish
              </p>
            </div>
            <input
              type="checkbox"
              checked={data.notificationPreferences.soundChimesEnabled}
              onChange={(e) =>
                updateNotificationPrefs({ soundChimesEnabled: e.target.checked })
              }
              className="rounded accent-blue-600 w-4 h-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 cursor-pointer">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">
                Desktop Browser Notifications (Requires Permission)
              </p>
              <p className="text-slate-500">
                Show OS-level desktop notifications when a backgrounded timer completes
              </p>
            </div>
            <input
              type="checkbox"
              checked={data.notificationPreferences.browserNotificationsEnabled}
              onChange={(e) => handleToggleBrowserNotifications(e.target.checked)}
              className="rounded accent-blue-600 w-4 h-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 cursor-pointer">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">
                In-App Goal & Streak Milestone Alerts
              </p>
              <p className="text-slate-500">
                Notify immediately when a daily goal or achievement badge is unlocked
              </p>
            </div>
            <input
              type="checkbox"
              checked={data.notificationPreferences.goalCompletionAlert}
              onChange={(e) =>
                updateNotificationPrefs({
                  goalCompletionAlert: e.target.checked,
                  streakMilestoneAlert: e.target.checked,
                })
              }
              className="rounded accent-blue-600 w-4 h-4 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* 3. App Installation (PWA) Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                App Installation
              </h2>
              <p className="text-xs text-slate-500">
                Install ScholarPulse on your desktop or phone for a dedicated window and faster access
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                isInstalled || isStandalone
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                  : canTriggerNativePrompt
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isInstalled || isStandalone
                    ? 'bg-emerald-500'
                    : canTriggerNativePrompt
                    ? 'bg-blue-500 animate-pulse'
                    : 'bg-slate-400'
                }`}
              />
              {isInstalled || isStandalone
                ? 'Installed (Standalone Mode)'
                : canTriggerNativePrompt
                ? 'Ready for Native Install'
                : 'PWA Ready'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs">
            <p className="font-bold text-slate-900 dark:text-white">
              Home Screen & Desktop
            </p>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-[11px]">
              Launch directly from your mobile home screen, Windows taskbar, or Mac Dock.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs">
            <p className="font-bold text-slate-900 dark:text-white">
              Dedicated App Window
            </p>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-[11px]">
              Distraction-free standalone window with no browser URL bar clutter.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs">
            <p className="font-bold text-slate-900 dark:text-white">
              Faster Study Tracking
            </p>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-[11px]">
              Service worker pre-caches UI shell assets ({swRegistered ? 'Active' : 'Ready'}) for instant load.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs">
            <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Private Cache Policy</span>
            </p>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-[11px]">
              API routes and auth tokens use strict NetworkOnly rules—never stored in shared caches.
            </p>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800">
          <PWAInstallButton variant="settings" />
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Supports Android Chrome, Desktop Chrome, Microsoft Edge, and iOS Safari (Share → Add to Home Screen).
          </p>
        </div>
      </div>

      {/* 4. Data Backup, Restoration & Security Documentation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-4">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Data Backup, Restoration & Multi-Layer Security
            </h2>
            <p className="text-xs text-slate-500">
              Export your complete personal data or restore from a JSON backup bundle
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export Card */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Export Complete Account Backup
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Download a portable JSON snapshot containing your profile, subjects,
              study sessions, tasks, weekly schedules, goals, and achievements.
            </p>
            <button
              type="button"
              onClick={handleExportFullJsonBackup}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Full JSON Backup</span>
            </button>
          </div>

          {/* Restore Card */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Restore from Backup Bundle
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  checked={restoreMode === 'merge'}
                  onChange={() => setRestoreMode('merge')}
                  className="accent-blue-600"
                />
                <span className="text-slate-700 dark:text-slate-300">Merge with current data</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  checked={restoreMode === 'replace'}
                  onChange={() => setRestoreMode('replace')}
                  className="accent-blue-600"
                />
                <span className="text-slate-700 dark:text-slate-300">Replace workspace</span>
              </label>
            </div>
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>{restoring ? 'Restoring...' : 'Upload JSON Backup File'}</span>
              <input
                type="file"
                accept="application/json"
                onChange={handleImportJsonBackup}
                disabled={restoring}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Security & Data Isolation Documentation */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-400">
          <h4 className="font-display font-bold text-slate-900 dark:text-white">
            Documented Security & Tenant Isolation Guarantees
          </h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Token-Verified Identity:</strong> Every request verifies your
              JWT authentication session server-side (`getCurrentUser` via HTTP-only session cookie).
            </li>
            <li>
              <strong>Server-Side Ownership Enforcement (IDOR Protection):</strong>{' '}
              Your `userId` is extracted strictly from your verified session—never from
              client request payloads. Every query, update, and delete validates
              record and subject ownership before executing.
            </li>
            <li>
              <strong>Transactional Integrity:</strong> Session additions, edits,
              deletions, and backup restores execute inside atomic PostgreSQL
              transactions that block overlapping intervals and deterministically
              recalculate goals, streaks, and achievements.
            </li>
          </ul>
        </div>

        {/* Account Actions: Sign Out & Delete Account */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => signOut()}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of Workspace</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 text-xs font-semibold flex items-center gap-2 hover:bg-red-100 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Account & Personal Data</span>
          </button>
        </div>
      </div>

      {/* Account Deletion Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2.5 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-display text-base font-bold">
                Permanently Delete Account Data?
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              This action is irreversible. All of your subjects, study sessions,
              active timers, tasks, weekly schedules, goals, achievements, and profile
              records will be permanently deleted from the cloud database.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Type <strong>DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                onClick={handleDeleteAccount}
                className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-40"
              >
                {deleting ? 'Deleting...' : 'Permanently Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
