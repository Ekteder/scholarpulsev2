'use client';

import React, { useMemo, useState } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  addDaysToYmd,
  computeStreaksFromDates,
  formatDurationHuman,
  getDayOfWeekInTz,
  getMinutesBetweenHHMM,
  toDateStringInTz,
  toTimeStringInTz,
} from '@/lib/timezone';
import { HeatmapWidget } from './HeatmapWidget';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  Plus,
  Play,
  SlidersHorizontal,
  Target,
  TrendingUp,
} from 'lucide-react';
import { CreatorAttribution } from './CreatorAttribution';
import { Button } from '@/components/ui/button';
import { ExamCountdownAndBurndown } from './ExamCountdownAndBurndown';

export function DashboardView() {
  const { data, setActiveTab, setSelectedSubjectId, updateTask } = useWorkspace();
  const [showCustomize, setShowCustomize] = useState(false);
  const [visibleSections, setVisibleSections] = useState({
    heatmap: true,
    weeklyChart: true,
    todayActivity: true,
    scheduleAndTasks: true,
    subjectProgress: true,
    achievements: true,
  });

  const profile = data?.profile;
  const subjects = useMemo(() => data?.subjects || [], [data?.subjects]);
  const studySessions = useMemo(() => data?.studySessions || [], [data?.studySessions]);
  const tasks = useMemo(() => data?.tasks || [], [data?.tasks]);
  const schedules = useMemo(() => data?.schedules || [], [data?.schedules]);
  const achievementsCatalog = useMemo(() => data?.achievementsCatalog || [], [data?.achievementsCatalog]);
  const userAchievements = useMemo(() => data?.userAchievements || [], [data?.userAchievements]);

  const timezone = profile?.timezone || 'Asia/Dhaka';
  const todayYmd = toDateStringInTz(new Date(), timezone);
  const todayDow = getDayOfWeekInTz(new Date(), timezone);

  const subjectMap = useMemo(() => {
    const map = new Map<string, (typeof subjects)[0]>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  // Personalized greeting in user's timezone
  const { greeting, formattedDate } = useMemo(() => {
    const now = new Date();
    const hourStr = toTimeStringInTz(now, timezone).slice(0, 2);
    const hour = Number(hourStr);
    let greet = 'Good evening';
    if (hour >= 5 && hour < 12) greet = 'Good morning';
    else if (hour >= 12 && hour < 17) greet = 'Good afternoon';

    let dateLabel = todayYmd;
    try {
      dateLabel = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(now);
    } catch {
      // fallback
    }
    return { greeting: greet, formattedDate: dateLabel };
  }, [timezone, todayYmd]);

  // Today's study sessions
  const todaySessions = useMemo(
    () =>
      studySessions.filter((s) => toDateStringInTz(s.startTime, timezone) === todayYmd),
    [studySessions, timezone, todayYmd]
  );

  const todayStudiedSeconds = useMemo(
    () => todaySessions.reduce((acc, s) => acc + s.durationSeconds, 0),
    [todaySessions]
  );

  const dailyGoalSeconds = Math.max(60, (profile?.dailyStudyTargetMinutes || 360) * 60);
  const remainingDailySeconds = Math.max(0, dailyGoalSeconds - todayStudiedSeconds);
  const dailyCompletionPercent = Math.min(
    100,
    Number(((todayStudiedSeconds / dailyGoalSeconds) * 100).toFixed(1))
  );

  // Weekly study time & 7-day bar chart
  const { weeklyStudiedSeconds, last7DaysChartData } = useMemo(() => {
    let weekSec = 0;
    const chartData = [];

    for (let i = 6; i >= 0; i--) {
      const ymd = addDaysToYmd(todayYmd, -i);
      const daySessions = studySessions.filter(
        (s) => toDateStringInTz(s.startTime, timezone) === ymd
      );
      const sec = daySessions.reduce((acc, s) => acc + s.durationSeconds, 0);
      weekSec += sec;

      const [y, m, d] = ymd.split('-').map(Number);
      const shortDay = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        timeZone: 'UTC',
      }).format(new Date(Date.UTC(y, m - 1, d)));

      chartData.push({
        ymd,
        day: shortDay,
        hours: Number((sec / 3600).toFixed(2)),
        targetHours: Number((dailyGoalSeconds / 3600).toFixed(1)),
      });
    }

    return { weeklyStudiedSeconds: weekSec, last7DaysChartData: chartData };
  }, [studySessions, todayYmd, timezone, dailyGoalSeconds]);

  // Streaks
  const streakInfo = useMemo(
    () =>
      computeStreaksFromDates(
        studySessions.map((s) => s.startTime),
        timezone
      ),
    [studySessions, timezone]
  );

  // Tasks stats
  const completedTasksCount = useMemo(
    () => tasks.filter((t) => t.status === 'completed').length,
    [tasks]
  );

  const todayCompletedTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status === 'completed' &&
          t.completedAt &&
          toDateStringInTz(t.completedAt, timezone) === todayYmd
      ),
    [tasks, timezone, todayYmd]
  );

  const upcomingTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'completed')
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 5),
    [tasks]
  );

  // Today's Schedule slots
  const todaySchedules = useMemo(
    () =>
      schedules
        .filter((sch) => sch.dayOfWeek === todayDow)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [schedules, todayDow]
  );

  // Subject-wise study progress (Today & Total)
  const subjectProgressList = useMemo(() => {
    const activeSubjects = subjects.filter((s) => !s.isArchived);
    return activeSubjects.map((sub) => {
      const todaySec = todaySessions
        .filter((s) => s.subjectId === sub.id)
        .reduce((acc, s) => acc + s.durationSeconds, 0);
      const totalSec = studySessions
        .filter((s) => s.subjectId === sub.id)
        .reduce((acc, s) => acc + s.durationSeconds, 0);
      const targetSec = Math.max(60, (sub.dailyTargetMinutes || 60) * 60);
      const pct = Math.min(100, Math.round((todaySec / targetSec) * 100));
      return {
        subject: sub,
        todaySec,
        totalSec,
        targetSec,
        pct,
      };
    });
  }, [subjects, todaySessions, studySessions]);

  // Recent unlocked achievements
  const recentUnlockedAchievements = useMemo(() => {
    return userAchievements
      .slice()
      .sort(
        (a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime()
      )
      .slice(0, 4)
      .map((ua) => {
        const meta = achievementsCatalog.find((c) => c.id === ua.achievementId);
        return { ua, meta };
      })
      .filter((x) => Boolean(x.meta));
  }, [userAchievements, achievementsCatalog]);

  if (!data || !profile) return null;

  // SVG Ring calculation
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (dailyCompletionPercent / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Top Personalized Greeting + Quick Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-xs text-slate-500 dark:text-slate-400">
            <span>{formattedDate}</span>
            <span>·</span>
            <span>Timezone: {timezone}</span>
            <CreatorAttribution variant="dashboard-top" />
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {greeting}, {profile.fullName}
          </h1>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <Button
            type="button"
            onClick={() => setActiveTab('timer')}
            className="px-3.5 sm:px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-xs h-auto"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Start Studying</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => setActiveTab('tracker')}
            className="px-3 sm:px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 border-transparent h-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add<span className="hidden sm:inline"> Study</span> Session</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => setActiveTab('schedule')}
            className="px-3 sm:px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 border-transparent h-auto"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => setActiveTab('analytics')}
            className="px-3 sm:px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 border-transparent h-auto"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span><span className="hidden sm:inline">View </span>Analytics</span>
          </Button>

          <button
            type="button"
            onClick={() => setShowCustomize((prev) => !prev)}
            title="Customize Dashboard Widgets"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dashboard Widget Customizer Drawer */}
      {showCustomize && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 sm:gap-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Customize Visible Dashboard Sections:
          </span>
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {[
              { key: 'weeklyChart', label: 'Weekly Bar Chart' },
              { key: 'heatmap', label: 'Yearly Heatmap' },
              { key: 'todayActivity', label: "Today's Activity" },
              { key: 'scheduleAndTasks', label: 'Schedule & Tasks' },
              { key: 'subjectProgress', label: 'Subject Progress' },
              { key: 'achievements', label: 'Recent Achievements' },
            ].map((item) => (
              <label
                key={item.key}
                className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={
                    visibleSections[item.key as keyof typeof visibleSections]
                  }
                  onChange={(e) =>
                    setVisibleSections((prev) => ({
                      ...prev,
                      [item.key]: e.target.checked,
                    }))
                  }
                  className="rounded accent-blue-600"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Exam Countdown & Burndown Forecaster */}
      <ExamCountdownAndBurndown />

      {/* 7 Main Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 sm:gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="truncate">Studied Today</span>
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 ml-1" />
          </div>
          <div className="font-mono tabular-nums text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
            {formatDurationHuman(todayStudiedSeconds)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="truncate">Daily Goal</span>
            <Target className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
          </div>
          <div className="font-mono tabular-nums text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
            {formatDurationHuman(dailyGoalSeconds)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="truncate">Goal Progress</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />
          </div>
          <div className="font-mono tabular-nums text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400 truncate">
            {dailyCompletionPercent}%
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="truncate">
              <span className="sm:hidden">Sessions</span>
              <span className="hidden sm:inline">Sessions Today</span>
            </span>
            <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
          </div>
          <div className="font-mono tabular-nums text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
            {todaySessions.length}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="truncate">
              <span className="sm:hidden">Tasks Done</span>
              <span className="hidden sm:inline">Completed Tasks</span>
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />
          </div>
          <div className="font-mono tabular-nums text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
            {completedTasksCount}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="truncate">
              <span className="sm:hidden">Streak</span>
              <span className="hidden sm:inline">Current Streak</span>
            </span>
            <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0 ml-1" />
          </div>
          <div className="font-mono tabular-nums text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
            {streakInfo.currentStreak}d
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-1 col-span-2 sm:col-span-1 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="truncate">Weekly Time</span>
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 ml-1" />
          </div>
          <div className="font-mono tabular-nums text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
            {formatDurationHuman(weeklyStudiedSeconds)}
          </div>
        </div>
      </div>

      {/* Prominent Daily Progress Card + 7-Day Weekly Overview Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Daily Progress Ring & Breakdown */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 flex flex-col justify-between space-y-4 sm:space-y-6 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Daily Study Progress
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real-time completion toward your daily target
              </p>
            </div>
            <span className="font-mono tabular-nums text-xs font-semibold text-blue-600 dark:text-blue-400">
              {dailyCompletionPercent}% Complete
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Circular Progress Indicator */}
            <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
              <svg className="w-36 h-36 -rotate-90" viewBox="0 0 140 140">
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="12"
                  className="text-slate-100 dark:text-slate-800"
                />
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="text-blue-600 dark:text-blue-500 transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
                  {dailyCompletionPercent}%
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  of daily goal
                </span>
              </div>
            </div>

            {/* Exact 4-row Breakdown */}
            <div className="flex-1 w-full space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Daily goal:</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {formatDurationHuman(dailyGoalSeconds)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Studied:</span>
                <span className="font-mono tabular-nums font-semibold text-blue-600 dark:text-blue-400">
                  {formatDurationHuman(todayStudiedSeconds)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Remaining:</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {formatDurationHuman(remainingDailySeconds)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500 dark:text-slate-400">Progress:</span>
                <span className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                  {dailyCompletionPercent}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Overview Bar Chart (Last 7 Days) */}
        {visibleSections.weeklyChart && (
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Weekly Study Overview (Last 7 Days)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Comparison of recorded study hours across the past 7 calendar days
                </p>
              </div>
              <span className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                Total: {formatDurationHuman(weeklyStudiedSeconds)}
              </span>
            </div>

            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={last7DaysChartData}
                  margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#94a3b8"
                    strokeOpacity={0.2}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    unit="h"
                  />
                  <Tooltip
                    formatter={(value: any) => [`${value} hrs`, 'Studied']}
                    labelFormatter={(label, payload) =>
                      payload?.[0]?.payload?.ymd
                        ? `${label} (${payload[0].payload.ymd})`
                        : label
                    }
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="hours"
                    fill="#2563EB"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={38}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* GitHub-Style Yearly Study Activity Heatmap */}
      {visibleSections.heatmap && (
        <HeatmapWidget
          sessions={studySessions}
          subjects={subjects}
          timezone={timezone}
          dailyTargetMinutes={profile.dailyStudyTargetMinutes || 360}
        />
      )}

      {/* Middle Grid: Today's Study Activity + Today's Schedule & Upcoming Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Today's Study Activity */}
        {visibleSections.todayActivity && (
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Today's Study Activity
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Recorded sessions and tasks completed today ({todayYmd})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Full History
              </button>
            </div>

            {todaySessions.length === 0 && todayCompletedTasks.length === 0 ? (
              <div className="py-8 text-center space-y-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No study sessions or completed tasks recorded yet today.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    onClick={() => setActiveTab('timer')}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer h-auto"
                  >
                    Start Timer
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveTab('tracker')}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium cursor-pointer h-auto border-transparent"
                  >
                    Log Manual Session
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {todaySessions.slice(0, 5).map((sess) => {
                  const subj = subjectMap.get(sess.subjectId);
                  return (
                    <div
                      key={sess.id}
                      className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800/80 last:border-none"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: subj?.color || '#2563EB' }}
                          />
                          <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {subj?.name || 'Subject'}
                          </span>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs text-slate-600 dark:text-slate-300 truncate">
                            {sess.topic}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          <span>Started {toTimeStringInTz(sess.startTime, timezone)}</span>
                          <span>·</span>
                          <span className="capitalize">{sess.sessionType}</span>
                        </div>
                      </div>
                      <span className="font-mono tabular-nums text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0">
                        {formatDurationHuman(sess.durationSeconds)}
                      </span>
                    </div>
                  );
                })}

                {todayCompletedTasks.length > 0 && (
                  <div className="pt-2 space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-400">
                      Completed Tasks Today ({todayCompletedTasks.length})
                    </span>
                    {todayCompletedTasks.map((t) => {
                      const subj = subjectMap.get(t.subjectId);
                      return (
                        <div
                          key={t.id}
                          className="flex items-center justify-between text-xs py-1 text-slate-600 dark:text-slate-300"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="line-through truncate">{t.title}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 shrink-0">
                            {subj?.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Today's Schedule & Upcoming Tasks */}
        {visibleSections.scheduleAndTasks && (
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6 shadow-xs">
            {/* Today's Schedule */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Today's Timetable
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Scheduled slots (kept distinct from actual recorded study time)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('schedule')}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Manage Schedule
                </button>
              </div>

              {todaySchedules.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                  No study slots scheduled for today.
                </p>
              ) : (
                <div className="space-y-2">
                  {todaySchedules.map((slot) => {
                    const subj = subjectMap.get(slot.subjectId);
                    const plannedMins = getMinutesBetweenHHMM(
                      slot.startTime,
                      slot.endTime
                    );
                    const actualSubjMinsToday = Math.round(
                      todaySessions
                        .filter((s) => s.subjectId === slot.subjectId)
                        .reduce((acc, s) => acc + s.durationSeconds, 0) / 60
                    );
                    const fulfilled = actualSubjMinsToday >= plannedMins && plannedMins > 0;

                    return (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: subj?.color || '#2563EB' }}
                            />
                            <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {subj?.name || 'Subject'}
                            </span>
                            {slot.description && (
                              <>
                                <span className="text-xs text-slate-400">·</span>
                                <span className="text-xs text-slate-500 truncate">
                                  {slot.description}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                            {slot.startTime} – {slot.endTime} ({plannedMins}m planned ·{' '}
                            {actualSubjMinsToday}m recorded today)
                          </div>
                        </div>
                        <span
                          className={`text-[11px] font-medium shrink-0 ${
                            fulfilled
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {fulfilled ? 'Completed' : 'Scheduled'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Upcoming Tasks */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Upcoming Tasks & Assignments
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('schedule')}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  All Tasks ({tasks.filter((t) => t.status !== 'completed').length})
                </button>
              </div>

              {upcomingTasks.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-1">
                  All caught up! No pending tasks.
                </p>
              ) : (
                <div className="space-y-2">
                  {upcomingTasks.map((task) => {
                    const subj = subjectMap.get(task.subjectId);
                    const dueYmd = toDateStringInTz(task.dueDate, timezone);
                    const isOverdue = dueYmd < todayYmd;

                    return (
                      <div
                        key={task.id}
                        className="flex items-center justify-between gap-3 py-1.5 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={task.status === 'completed'}
                            onChange={() =>
                              updateTask(task.id, {
                                status:
                                  task.status === 'completed' ? 'pending' : 'completed',
                              })
                            }
                            className="rounded accent-blue-600 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white truncate">
                              {task.title}
                            </p>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                              <span>{subj?.name || 'Subject'}</span>
                              <span>·</span>
                              <span
                                className={
                                  isOverdue
                                    ? 'text-red-600 dark:text-red-400 font-semibold'
                                    : ''
                                }
                              >
                                {isOverdue ? `Overdue (${dueYmd})` : `Due ${dueYmd}`}
                              </span>
                              <span>·</span>
                              <span className="capitalize">{task.priority} priority</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Row: Subject-Wise Study Progress + Recent Achievements */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {visibleSections.subjectProgress && (
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Subject-Wise Study Progress
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Today's progress against each subject's daily target (click a subject for details)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('subjects')}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Manage Subjects
              </button>
            </div>

            {subjectProgressList.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">
                No active subjects yet. Add subjects in the Subjects tab.
              </p>
            ) : (
              <div className="space-y-3.5">
                {subjectProgressList.map(({ subject, todaySec, totalSec, targetSec, pct }) => (
                  <div
                    key={subject.id}
                    onClick={() => {
                      setSelectedSubjectId(subject.id);
                      setActiveTab('subjects');
                    }}
                    className="space-y-1.5 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: subject.color }}
                        />
                        <span className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {subject.name}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          {formatDurationHuman(totalSec)} lifetime
                        </span>
                      </div>
                      <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {formatDurationHuman(todaySec)} / {formatDurationHuman(targetSec)} (
                        {pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: subject.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {visibleSections.achievements && (
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Streaks & Recent Achievements
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Longest streak: {streakInfo.longestStreak} days · Active days:{' '}
                  {streakInfo.totalActiveDays}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('achievements')}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                All Milestones
              </button>
            </div>

            {recentUnlockedAchievements.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  No achievements unlocked yet
                </p>
                <p>
                  Complete your first study session to unlock the "First Session"
                  milestone badge!
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentUnlockedAchievements.map(({ ua, meta }) => (
                  <div
                    key={ua.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Award className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {meta!.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {meta!.description}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">
                      {toDateStringInTz(ua.unlockedAt, timezone)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prominent Dashboard Footer Attribution */}
      <CreatorAttribution variant="dashboard-footer" />
    </div>
  );
}
