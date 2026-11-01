'use client';

import React, { useMemo } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { computeStreaksFromDates, toDateStringInTz } from '@/lib/timezone';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Flame,
  Lock,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';

export function AchievementsView() {
  const { data } = useWorkspace();

  const profile = data?.profile;
  const studySessions = useMemo(() => data?.studySessions || [], [data?.studySessions]);
  const tasks = useMemo(() => data?.tasks || [], [data?.tasks]);
  const achievementsCatalog = useMemo(() => data?.achievementsCatalog || [], [data?.achievementsCatalog]);
  const userAchievements = useMemo(() => data?.userAchievements || [], [data?.userAchievements]);

  const timezone = profile?.timezone || 'Asia/Dhaka';
  const dailyTargetMinutes = profile?.dailyStudyTargetMinutes || 360;

  const streakInfo = useMemo(
    () =>
      computeStreaksFromDates(
        studySessions.map((s) => s.startTime),
        timezone
      ),
    [studySessions, timezone]
  );

  // Calculate current progress toward each achievement
  const progressStats = useMemo(() => {
    const totalHours = Number(
      (
        studySessions.reduce((acc, s) => acc + s.durationSeconds, 0) / 3600
      ).toFixed(2)
    );
    const completedTasksCount = tasks.filter((t) => t.status === 'completed').length;
    const distinctSubjectsCount = new Set(studySessions.map((s) => s.subjectId)).size;

    const dailySecByYmd: Record<string, number> = {};
    for (const s of studySessions) {
      const ymd = toDateStringInTz(s.startTime, timezone);
      dailySecByYmd[ymd] = (dailySecByYmd[ymd] || 0) + s.durationSeconds;
    }

    const monthlyGoalDays: Record<string, number> = {};
    for (const [ymd, sec] of Object.entries(dailySecByYmd)) {
      if (sec / 60 >= dailyTargetMinutes) {
        const ym = ymd.slice(0, 7);
        monthlyGoalDays[ym] = (monthlyGoalDays[ym] || 0) + 1;
      }
    }
    const maxMonthlyGoalDays = Math.max(0, ...Object.values(monthlyGoalDays));

    return {
      sessions_count: studySessions.length,
      total_hours: totalHours,
      streak_days: Math.max(streakInfo.currentStreak, streakInfo.longestStreak),
      monthly_daily_goals: maxMonthlyGoalDays,
      completed_tasks: completedTasksCount,
      subjects_studied: distinctSubjectsCount,
    };
  }, [studySessions, tasks, timezone, dailyTargetMinutes, streakInfo]);

  const unlockedMap = useMemo(() => {
    const map = new Map<string, string>();
    userAchievements.forEach((ua) =>
      map.set(
        ua.achievementId,
        typeof ua.unlockedAt === 'string'
          ? ua.unlockedAt
          : new Date(ua.unlockedAt).toISOString()
      )
    );
    return map;
  }, [userAchievements]);

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'Sparkles':
        return <Sparkles className="w-5 h-5" />;
      case 'Clock':
        return <Clock className="w-5 h-5" />;
      case 'BookOpen':
        return <BookOpen className="w-5 h-5" />;
      case 'Trophy':
        return <Trophy className="w-5 h-5" />;
      case 'Flame':
        return <Flame className="w-5 h-5" />;
      case 'Zap':
        return <Zap className="w-5 h-5" />;
      case 'CalendarCheck':
        return <Calendar className="w-5 h-5" />;
      case 'CheckCircle2':
        return <CheckCircle2 className="w-5 h-5" />;
      case 'Compass':
        return <Compass className="w-5 h-5" />;
      default:
        return <Award className="w-5 h-5" />;
    }
  };

  const unlockedList = achievementsCatalog.filter((a) => unlockedMap.has(a.id));
  const lockedList = achievementsCatalog.filter((a) => !unlockedMap.has(a.id));

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Top Streak Hero Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Study Streaks & Academic Milestones
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Streaks are evaluated using calendar days in your configured timezone (
              {timezone})
            </p>
          </div>
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Status Today:{' '}
            <span
              className={
                streakInfo.studiedToday
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-amber-600 dark:text-amber-400 font-semibold'
              }
            >
              {streakInfo.studiedToday
                ? 'Streak Active for Today'
                : 'Log a session today to extend your streak'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500">Current Study Streak</span>
              <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
                {streakInfo.currentStreak} days
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-600/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500">Longest Study Streak</span>
              <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
                {streakInfo.longestStreak} days
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500">Total Active Study Days</span>
              <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
                {streakInfo.totalActiveDays} days
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unlocked Achievements */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Unlocked Achievements ({unlockedList.length} / {achievementsCatalog.length})
          </h2>
        </div>

        {unlockedList.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-xs text-slate-500">
            Complete your first study session to unlock your first achievement badge!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unlockedList.map((ach) => {
              const unlockedAt = unlockedMap.get(ach.id)!;
              return (
                <div
                  key={ach.id}
                  className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/70 rounded-xl p-5 flex items-start gap-4"
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                    {renderIcon(ach.icon)}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white truncate">
                        {ach.title}
                      </h3>
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                        Unlocked
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {ach.description}
                    </p>
                    <p className="font-mono tabular-nums text-[11px] text-slate-400 pt-1">
                      Awarded on {toDateStringInTz(unlockedAt, timezone)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Locked Achievements */}
      {lockedList.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Upcoming Milestones ({lockedList.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lockedList.map((ach) => {
              const curVal =
                progressStats[ach.requirementType as keyof typeof progressStats] || 0;
              const pct = Math.min(
                100,
                Math.round((Number(curVal) / Math.max(1, ach.requirementValue)) * 100)
              );

              return (
                <div
                  key={ach.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4 opacity-90"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                        {ach.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {ach.description}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500">
                      <span>
                        Progress: {curVal} / {ach.requirementValue}
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-600/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
