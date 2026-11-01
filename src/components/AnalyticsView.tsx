'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
import { generatePdfDossier } from '@/lib/pdfDossier';
import {
  REVISION_CATEGORIES,
  RevisionWorkspacePayload,
} from '@/types/index';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  Moon,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  TrendingUp,
} from 'lucide-react';

type TimeFilterPreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'this_month'
  | 'prev_month'
  | 'this_year'
  | 'custom';

export function AnalyticsView() {
  const { data, fetchRevisionWorkspace } = useWorkspace();
  const [subView, setSubView] = useState<
    'overview' | 'planned_vs_actual' | 'weekly_reports' | 'heatmap' | 'revision'
  >('overview');

  const [revisionPayload, setRevisionPayload] = useState<RevisionWorkspacePayload | null>(null);
  const [loadingRevision, setLoadingRevision] = useState(false);

  useEffect(() => {
    if (subView === 'revision' && !revisionPayload && !loadingRevision) {
      setLoadingRevision(true);
      fetchRevisionWorkspace()
        .then((res) => setRevisionPayload(res))
        .catch((e) => console.error('Failed to load revision data for analytics:', e))
        .finally(() => setLoadingRevision(false));
    }
  }, [subView, revisionPayload, loadingRevision, fetchRevisionWorkspace]);

  const timezone = data?.profile?.timezone || 'Asia/Dhaka';
  const todayYmd = toDateStringInTz(new Date(), timezone);

  const [preset, setPreset] = useState<TimeFilterPreset>('last30');
  const [customStart, setCustomStart] = useState(addDaysToYmd(todayYmd, -14));
  const [customEnd, setCustomEnd] = useState(todayYmd);

  // Weekly Report week offset (0 = current 7-day week ending today, -1 = previous week, etc.)
  const [reportWeekOffset, setReportWeekOffset] = useState(0);

  if (!data) return null;

  const { profile, subjects, studySessions, tasks, schedules, goals } = data;
  const dailyTargetHours = Number(
    ((profile.dailyStudyTargetMinutes || 360) / 60).toFixed(2)
  );
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  // Compute startYmd and endYmd for the selected time filter
  const { startYmd, endYmd, dayCount } = useMemo(() => {
    let s = todayYmd;
    let e = todayYmd;

    if (preset === 'today') {
      s = todayYmd;
      e = todayYmd;
    } else if (preset === 'yesterday') {
      s = addDaysToYmd(todayYmd, -1);
      e = s;
    } else if (preset === 'last7') {
      s = addDaysToYmd(todayYmd, -6);
      e = todayYmd;
    } else if (preset === 'last30') {
      s = addDaysToYmd(todayYmd, -29);
      e = todayYmd;
    } else if (preset === 'this_month') {
      s = `${todayYmd.slice(0, 7)}-01`;
      e = todayYmd;
    } else if (preset === 'prev_month') {
      const [y, m] = todayYmd.split('-').map(Number);
      const prevMonthDate = new Date(Date.UTC(y, m - 2, 1));
      const lastDayPrevMonth = new Date(Date.UTC(y, m - 1, 0));
      s = prevMonthDate.toISOString().slice(0, 10);
      e = lastDayPrevMonth.toISOString().slice(0, 10);
    } else if (preset === 'this_year') {
      s = `${todayYmd.slice(0, 4)}-01-01`;
      e = todayYmd;
    } else if (preset === 'custom') {
      s = customStart <= customEnd ? customStart : customEnd;
      e = customEnd >= customStart ? customEnd : customStart;
    }

    const startMs = new Date(`${s}T00:00:00Z`).getTime();
    const endMs = new Date(`${e}T00:00:00Z`).getTime();
    const days = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);
    return { startYmd: s, endYmd: e, dayCount: days };
  }, [preset, todayYmd, customStart, customEnd]);

  // Filtered sessions in the selected date window
  const periodSessions = useMemo(
    () =>
      studySessions.filter((sess) => {
        const ymd = toDateStringInTz(sess.startTime, timezone);
        return ymd >= startYmd && ymd <= endYmd;
      }),
    [studySessions, timezone, startYmd, endYmd]
  );

  // 10 Additional Summary Statistics (Lifetime & Period)
  const summaryMetrics = useMemo(() => {
    const lifetimeSeconds = studySessions.reduce(
      (acc, s) => acc + s.durationSeconds,
      0
    );
    const periodSeconds = periodSessions.reduce(
      (acc, s) => acc + s.durationSeconds,
      0
    );

    const avgDailySeconds = Math.round(periodSeconds / Math.max(1, dayCount));
    const avgSessionSeconds =
      studySessions.length > 0
        ? Math.round(lifetimeSeconds / studySessions.length)
        : 0;
    const longestSessionSeconds = studySessions.reduce(
      (max, s) => Math.max(max, s.durationSeconds),
      0
    );

    // Most studied subject (lifetime)
    const subjectTotals: Record<string, number> = {};
    const dateTotals: Record<string, number> = {};
    for (const s of studySessions) {
      subjectTotals[s.subjectId] =
        (subjectTotals[s.subjectId] || 0) + s.durationSeconds;
      const ymd = toDateStringInTz(s.startTime, timezone);
      dateTotals[ymd] = (dateTotals[ymd] || 0) + s.durationSeconds;
    }

    let mostStudiedSubjectName = 'None yet';
    let maxSubjSec = 0;
    for (const [subId, sec] of Object.entries(subjectTotals)) {
      if (sec > maxSubjSec) {
        maxSubjSec = sec;
        mostStudiedSubjectName = subjectMap.get(subId)?.name || 'Subject';
      }
    }

    let mostProductiveDayLabel = 'None yet';
    let maxDaySec = 0;
    for (const [ymd, sec] of Object.entries(dateTotals)) {
      if (sec > maxDaySec) {
        maxDaySec = sec;
        mostProductiveDayLabel = `${ymd} (${formatDurationHuman(sec)})`;
      }
    }

    const completedTasksCount = tasks.filter((t) => t.status === 'completed').length;
    const completedGoalsCount = goals.filter((g) => g.status === 'completed').length;
    const goalCompletionRate =
      goals.length > 0
        ? Math.round((completedGoalsCount / goals.length) * 100)
        : 0;

    const streaks = computeStreaksFromDates(
      studySessions.map((s) => s.startTime),
      timezone
    );

    return {
      lifetimeHours: (lifetimeSeconds / 3600).toFixed(1),
      avgDailyHuman: formatDurationHuman(avgDailySeconds),
      avgSessionHuman: formatDurationHuman(avgSessionSeconds),
      longestSessionHuman: formatDurationHuman(longestSessionSeconds),
      mostStudiedSubjectName,
      mostProductiveDayLabel,
      totalCompletedSessions: studySessions.length,
      totalCompletedTasks: completedTasksCount,
      goalCompletionRate,
      currentStreak: streaks.currentStreak,
      longestStreak: streaks.longestStreak,
    };
  }, [studySessions, periodSessions, dayCount, timezone, subjectMap, tasks, goals]);

  // Chart A & F: Daily Study Hours & Productivity Consistency
  const dailySeries = useMemo(() => {
    const cappedDays = Math.min(60, dayCount);
    const seriesStart = addDaysToYmd(endYmd, -(cappedDays - 1));
    const byDate: Record<string, number> = {};
    for (const s of periodSessions) {
      const ymd = toDateStringInTz(s.startTime, timezone);
      byDate[ymd] = (byDate[ymd] || 0) + s.durationSeconds;
    }

    const arr = [];
    for (let i = 0; i < cappedDays; i++) {
      const ymd = addDaysToYmd(seriesStart, i);
      const sec = byDate[ymd] || 0;
      arr.push({
        date: ymd.slice(5),
        fullDate: ymd,
        hours: Number((sec / 3600).toFixed(2)),
        target: dailyTargetHours,
      });
    }
    return arr;
  }, [periodSessions, endYmd, dayCount, timezone, dailyTargetHours]);

  // Chart B: Weekly Study Trends (last 8 weeks)
  const weeklyTrendsData = useMemo(() => {
    const arr = [];
    for (let w = 7; w >= 0; w--) {
      const wEnd = addDaysToYmd(todayYmd, -w * 7);
      const wStart = addDaysToYmd(wEnd, -6);
      const sec = studySessions
        .filter((s) => {
          const ymd = toDateStringInTz(s.startTime, timezone);
          return ymd >= wStart && ymd <= wEnd;
        })
        .reduce((acc, s) => acc + s.durationSeconds, 0);

      arr.push({
        week: `${wStart.slice(5)}–${wEnd.slice(5)}`,
        hours: Number((sec / 3600).toFixed(2)),
      });
    }
    return arr;
  }, [studySessions, todayYmd, timezone]);

  // Chart C: Monthly Study Trends (last 6 months)
  const monthlyTrendsData = useMemo(() => {
    const [curY, curM] = todayYmd.split('-').map(Number);
    const arr = [];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(Date.UTC(curY, curM - 1 - i, 1));
      const ym = dt.toISOString().slice(0, 7);
      const label = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        year: '2-digit',
        timeZone: 'UTC',
      }).format(dt);

      const sec = studySessions
        .filter((s) => toDateStringInTz(s.startTime, timezone).startsWith(ym))
        .reduce((acc, s) => acc + s.durationSeconds, 0);

      arr.push({
        month: label,
        hours: Number((sec / 3600).toFixed(2)),
      });
    }
    return arr;
  }, [studySessions, todayYmd, timezone]);

  // Chart D & E: Subject Distribution & Comparison
  const subjectBreakdownData = useMemo(() => {
    const totalPeriodSec = periodSessions.reduce(
      (acc, s) => acc + s.durationSeconds,
      0
    );
    return subjects
      .map((sub) => {
        const sec = periodSessions
          .filter((s) => s.subjectId === sub.id)
          .reduce((acc, s) => acc + s.durationSeconds, 0);
        const pct =
          totalPeriodSec > 0 ? Number(((sec / totalPeriodSec) * 100).toFixed(1)) : 0;
        return {
          id: sub.id,
          name: sub.name,
          color: sub.color || '#2563EB',
          hours: Number((sec / 3600).toFixed(2)),
          seconds: sec,
          percent: pct,
        };
      })
      .filter((item) => item.seconds > 0 || !subjects.find((s) => s.id === item.id)?.isArchived)
      .sort((a, b) => b.seconds - a.seconds);
  }, [subjects, periodSessions]);

  // Planned vs. Actual Analytics (Across the selected period)
  const plannedVsActualData = useMemo(() => {
    const dowOccurrences: Record<number, number> = {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
    };
    const cappedCount = Math.min(366, dayCount);
    for (let i = 0; i < cappedCount; i++) {
      const ymd = addDaysToYmd(startYmd, i);
      const dow = getDayOfWeekInTz(`${ymd}T12:00:00Z`, 'UTC');
      dowOccurrences[dow] = (dowOccurrences[dow] || 0) + 1;
    }

    const plannedMinutesBySubject: Record<string, number> = {};
    for (const slot of schedules) {
      const slotMins = getMinutesBetweenHHMM(slot.startTime, slot.endTime);
      const occurrences = dowOccurrences[slot.dayOfWeek] || 0;
      plannedMinutesBySubject[slot.subjectId] =
        (plannedMinutesBySubject[slot.subjectId] || 0) + slotMins * occurrences;
    }

    const rows = subjects.map((sub) => {
      const plannedMins = plannedMinutesBySubject[sub.id] || 0;
      const actualSec = periodSessions
        .filter((s) => s.subjectId === sub.id)
        .reduce((acc, s) => acc + s.durationSeconds, 0);
      const actualMins = Math.round(actualSec / 60);
      const completionPct =
        plannedMins > 0
          ? Math.min(200, Math.round((actualMins / plannedMins) * 100))
          : actualMins > 0
          ? 100
          : 0;

      return {
        id: sub.id,
        name: sub.name,
        color: sub.color,
        plannedHours: Number((plannedMins / 60).toFixed(2)),
        actualHours: Number((actualSec / 3600).toFixed(2)),
        plannedMinutes: plannedMins,
        actualMinutes: actualMins,
        completionPct,
      };
    });

    const totalPlannedMins = rows.reduce((acc, r) => acc + r.plannedMinutes, 0);
    const totalActualMins = rows.reduce((acc, r) => acc + r.actualMinutes, 0);
    const overallAdherencePct =
      totalPlannedMins > 0
        ? Math.round((totalActualMins / totalPlannedMins) * 100)
        : 0;

    return {
      rows,
      totalPlannedHours: (totalPlannedMins / 60).toFixed(1),
      totalActualHours: (totalActualMins / 60).toFixed(1),
      overallAdherencePct,
    };
  }, [schedules, subjects, periodSessions, startYmd, dayCount]);

  // Time-of-Day Productivity Analysis (Morning, Afternoon, Evening, Night)
  const timeOfDayData = useMemo(() => {
    const brackets = [
      {
        key: 'morning',
        name: 'Morning',
        timeRange: '06:00 – 11:59',
        icon: Sunrise,
        color: '#F59E0B',
        seconds: 0,
        sessionCount: 0,
        totalRating: 0,
        ratedCount: 0,
      },
      {
        key: 'afternoon',
        name: 'Afternoon',
        timeRange: '12:00 – 16:59',
        icon: Sun,
        color: '#3B82F6',
        seconds: 0,
        sessionCount: 0,
        totalRating: 0,
        ratedCount: 0,
      },
      {
        key: 'evening',
        name: 'Evening',
        timeRange: '17:00 – 20:59',
        icon: Sunset,
        color: '#8B5CF6',
        seconds: 0,
        sessionCount: 0,
        totalRating: 0,
        ratedCount: 0,
      },
      {
        key: 'night',
        name: 'Night',
        timeRange: '21:00 – 05:59',
        icon: Moon,
        color: '#6366F1',
        seconds: 0,
        sessionCount: 0,
        totalRating: 0,
        ratedCount: 0,
      },
    ];

    for (const sess of periodSessions) {
      const timeStr = toTimeStringInTz(sess.startTime, timezone);
      const hour = parseInt(timeStr.split(':')[0], 10);
      let idx = 3; // Night (21:00 - 05:59)
      if (hour >= 6 && hour < 12) {
        idx = 0; // Morning
      } else if (hour >= 12 && hour < 17) {
        idx = 1; // Afternoon
      } else if (hour >= 17 && hour < 21) {
        idx = 2; // Evening
      }

      brackets[idx].seconds += sess.durationSeconds;
      brackets[idx].sessionCount += 1;
      if (sess.productivityRating && sess.productivityRating > 0) {
        brackets[idx].totalRating += sess.productivityRating;
        brackets[idx].ratedCount += 1;
      }
    }

    const rows = brackets.map((b) => {
      const hours = Number((b.seconds / 3600).toFixed(2));
      const avgRating = b.ratedCount > 0 ? Number((b.totalRating / b.ratedCount).toFixed(1)) : 0;
      return {
        ...b,
        hours,
        avgRating,
      };
    });

    const activeRows = rows.filter((r) => r.sessionCount > 0);
    const peak =
      activeRows.length > 0
        ? [...activeRows].sort((a, b) => b.avgRating - a.avgRating || b.hours - a.hours)[0]
        : null;

    return {
      rows,
      peak,
    };
  }, [periodSessions, timezone]);

  // Weekly Summary Report Data (Selected 7-day week vs. Previous 7-day week)
  const weeklyReport = useMemo(() => {
    const weekEnd = addDaysToYmd(todayYmd, reportWeekOffset * 7);
    const weekStart = addDaysToYmd(weekEnd, -6);
    const prevWeekEnd = addDaysToYmd(weekStart, -1);
    const prevWeekStart = addDaysToYmd(prevWeekEnd, -6);

    const currentWeekSessions = studySessions.filter((s) => {
      const ymd = toDateStringInTz(s.startTime, timezone);
      return ymd >= weekStart && ymd <= weekEnd;
    });

    const prevWeekSessions = studySessions.filter((s) => {
      const ymd = toDateStringInTz(s.startTime, timezone);
      return ymd >= prevWeekStart && ymd <= prevWeekEnd;
    });

    const currentTotalSec = currentWeekSessions.reduce(
      (acc, s) => acc + s.durationSeconds,
      0
    );
    const prevTotalSec = prevWeekSessions.reduce(
      (acc, s) => acc + s.durationSeconds,
      0
    );
    const deltaSeconds = currentTotalSec - prevTotalSec;
    const deltaPercent =
      prevTotalSec > 0
        ? Math.round(((currentTotalSec - prevTotalSec) / prevTotalSec) * 100)
        : currentTotalSec > 0
        ? 100
        : 0;

    const weekCompletedTasks = tasks.filter((t) => {
      if (t.status !== 'completed' || !t.completedAt) return false;
      const ymd = toDateStringInTz(t.completedAt, timezone);
      return ymd >= weekStart && ymd <= weekEnd;
    });

    const dailyGoalSec = (profile.dailyStudyTargetMinutes || 360) * 60;
    let daysMetGoal = 0;
    let activeDaysInWeek = 0;
    for (let i = 0; i < 7; i++) {
      const dYmd = addDaysToYmd(weekStart, i);
      const dSec = currentWeekSessions
        .filter((s) => toDateStringInTz(s.startTime, timezone) === dYmd)
        .reduce((acc, s) => acc + s.durationSeconds, 0);
      if (dSec > 0) activeDaysInWeek++;
      if (dSec >= dailyGoalSec) daysMetGoal++;
    }

    const subjectRows = subjects
      .map((sub) => {
        const curSec = currentWeekSessions
          .filter((s) => s.subjectId === sub.id)
          .reduce((acc, s) => acc + s.durationSeconds, 0);
        const prevSec = prevWeekSessions
          .filter((s) => s.subjectId === sub.id)
          .reduce((acc, s) => acc + s.durationSeconds, 0);
        return {
          subject: sub,
          curSec,
          prevSec,
          diffSec: curSec - prevSec,
          sessionCount: currentWeekSessions.filter((s) => s.subjectId === sub.id).length,
        };
      })
      .filter((r) => r.curSec > 0 || r.prevSec > 0 || !r.subject.isArchived)
      .sort((a, b) => b.curSec - a.curSec);

    return {
      weekStart,
      weekEnd,
      prevWeekStart,
      prevWeekEnd,
      currentTotalSec,
      prevTotalSec,
      deltaSeconds,
      deltaPercent,
      sessionCount: currentWeekSessions.length,
      completedTasksCount: weekCompletedTasks.length,
      daysMetGoal,
      activeDaysInWeek,
      subjectRows,
    };
  }, [
    todayYmd,
    reportWeekOffset,
    studySessions,
    timezone,
    tasks,
    profile.dailyStudyTargetMinutes,
    subjects,
  ]);

  const exportWeeklyReportCsv = () => {
    const lines = [
      ['ScholarPulse Weekly Study Summary Report'],
      ['Period', `${weeklyReport.weekStart} to ${weeklyReport.weekEnd}`],
      ['Total Study Time', formatDurationHuman(weeklyReport.currentTotalSec)],
      ['Previous Week Study Time', formatDurationHuman(weeklyReport.prevTotalSec)],
      ['Week-over-Week Change (%)', `${weeklyReport.deltaPercent}%`],
      ['Completed Sessions', String(weeklyReport.sessionCount)],
      ['Completed Tasks', String(weeklyReport.completedTasksCount)],
      ['Active Days in Week', `${weeklyReport.activeDaysInWeek} / 7`],
      ['Daily Goal Met Days', `${weeklyReport.daysMetGoal} / 7`],
      [],
      ['Subject', 'This Week Hours', 'Previous Week Hours', 'Sessions Count'],
      ...weeklyReport.subjectRows.map((r) => [
        r.subject.name,
        (r.curSec / 3600).toFixed(2),
        (r.prevSec / 3600).toFixed(2),
        String(r.sessionCount),
      ]),
    ];

    const csv = lines.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ScholarPulse_Weekly_Report_${weeklyReport.weekStart}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-View Navigation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Academic Study Analytics
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              100% database-verified metrics · Break intervals are strictly excluded from study totals
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => generatePdfDossier(data)}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Export Dossier (PDF)</span>
            </button>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {[
                { id: 'overview', label: 'Charts & Trends' },
                { id: 'planned_vs_actual', label: 'Planned vs. Actual' },
                { id: 'weekly_reports', label: 'Weekly Reports' },
                { id: 'heatmap', label: 'Yearly Heatmap' },
                { id: 'revision', label: 'Revision Progress' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSubView(tab.id as any)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    subView === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 8 Time Filters Bar */}
        {subView !== 'weekly_reports' && subView !== 'heatmap' && subView !== 'revision' && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'last7', label: 'Last 7 Days' },
                { id: 'last30', label: 'Last 30 Days' },
                { id: 'this_month', label: 'This Month' },
                { id: 'prev_month', label: 'Previous Month' },
                { id: 'this_year', label: 'This Year' },
                { id: 'custom', label: 'Custom Range' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPreset(f.id as TimeFilterPreset)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    preset === f.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {preset === 'custom' && (
              <div className="flex items-center gap-2 text-xs font-mono">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
                <span>to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 10 Summary Statistics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-1">
          <span className="text-xs text-slate-500 truncate block">
            <span className="sm:hidden">Lifetime Hours</span>
            <span className="hidden sm:inline">Total Lifetime Hours</span>
          </span>
          <div className="font-mono tabular-nums text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
            {summaryMetrics.lifetimeHours}h
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-1">
          <span className="text-xs text-slate-500 truncate block">
            <span className="sm:hidden">Avg Daily</span>
            <span className="hidden sm:inline">Avg Daily Study Time</span>
          </span>
          <div className="font-mono tabular-nums text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400 truncate">
            {summaryMetrics.avgDailyHuman}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-1">
          <span className="text-xs text-slate-500 truncate block">
            <span className="sm:hidden">Avg Session</span>
            <span className="hidden sm:inline">Avg Session Duration</span>
          </span>
          <div className="font-mono tabular-nums text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
            {summaryMetrics.avgSessionHuman}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-1">
          <span className="text-xs text-slate-500 truncate block">Longest Session</span>
          <div className="font-mono tabular-nums text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
            {summaryMetrics.longestSessionHuman}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-1">
          <span className="text-xs text-slate-500 truncate block">
            <span className="sm:hidden">Top Subject</span>
            <span className="hidden sm:inline">Most Studied Subject</span>
          </span>
          <div className="font-display text-sm font-bold text-slate-900 dark:text-white truncate">
            {summaryMetrics.mostStudiedSubjectName}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-1">
          <span className="text-xs text-slate-500 truncate block">
            <span className="sm:hidden">Best Day</span>
            <span className="hidden sm:inline">Most Productive Day</span>
          </span>
          <div className="font-mono tabular-nums text-xs font-bold text-slate-900 dark:text-white truncate">
            {summaryMetrics.mostProductiveDayLabel}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-1">
          <span className="text-xs text-slate-500 truncate block">Completed Sessions</span>
          <div className="font-mono tabular-nums text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
            {summaryMetrics.totalCompletedSessions}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-1">
          <span className="text-xs text-slate-500 truncate block">Completed Tasks</span>
          <div className="font-mono tabular-nums text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
            {summaryMetrics.totalCompletedTasks}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-1">
          <span className="text-xs text-slate-500 truncate block">
            <span className="sm:hidden">Goal Met Rate</span>
            <span className="hidden sm:inline">Goal Completion Rate</span>
          </span>
          <div className="font-mono tabular-nums text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate">
            {summaryMetrics.goalCompletionRate}%
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-1 col-span-2 sm:col-span-1">
          <span className="text-xs text-slate-500 truncate block">
            <span className="sm:hidden">Streak (Cur/Best)</span>
            <span className="hidden sm:inline">Current / Longest Streak</span>
          </span>
          <div className="font-mono tabular-nums text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
            {summaryMetrics.currentStreak}d / {summaryMetrics.longestStreak}d
          </div>
        </div>
      </div>

      {/* Sub-View 1: Overview & 6 Recharts Charts */}
      {subView === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* A. Daily Study Hours */}
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                A. Daily Study Hours ({startYmd} to {endYmd})
              </h2>
              <p className="text-xs text-slate-500">
                Recorded study hours per calendar day
              </p>
            </div>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="h" />
                  <Tooltip formatter={(v: any) => [`${v} hrs`, 'Studied']} />
                  <Bar dataKey="hours" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* F. Productivity & Goal Consistency Trend */}
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                F. Daily Consistency vs. Target ({dailyTargetHours}h/day)
              </h2>
              <p className="text-xs text-slate-500">
                Daily study hours compared against your configured daily target line
              </p>
            </div>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="h" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="hours" name="Studied Hours" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="target"
                    name="Daily Target"
                    stroke="#16A34A"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* B. Weekly Study Trends */}
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                B. Weekly Study Trends (Last 8 Weeks)
              </h2>
              <p className="text-xs text-slate-500">
                Comparison of total study hours across consecutive 7-day weeks
              </p>
            </div>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyTrendsData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="h" />
                  <Tooltip formatter={(v: any) => [`${v} hrs`, 'Weekly Total']} />
                  <Area
                    type="monotone"
                    dataKey="hours"
                    stroke="#2563EB"
                    fill="#2563EB"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* C. Monthly Study Trends */}
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                C. Monthly Study Trends (Last 6 Months)
              </h2>
              <p className="text-xs text-slate-500">
                Long-term progression of total study hours by calendar month
              </p>
            </div>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrendsData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="h" />
                  <Tooltip formatter={(v: any) => [`${v} hrs`, 'Monthly Total']} />
                  <Bar dataKey="hours" fill="#2563EB" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* D. Subject Distribution Donut */}
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                D. Subject Time Distribution
              </h2>
              <p className="text-xs text-slate-500">
                Percentage share of study time spent on each subject
              </p>
            </div>

            {subjectBreakdownData.every((d) => d.hours === 0) ? (
              <div className="h-60 flex items-center justify-center text-xs text-slate-400">
                No study sessions recorded in this date window.
              </div>
            ) : (
              <div className="h-60 flex items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={subjectBreakdownData.filter((d) => d.hours > 0)}
                      dataKey="hours"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {subjectBreakdownData
                        .filter((d) => d.hours > 0)
                        .map((entry) => (
                          <Cell key={entry.id} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: any, _n, p: any) => [
                        `${v} hrs (${p?.payload?.percent}%)`,
                        p?.payload?.name,
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* E. Subject Comparison Bar Chart */}
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                E. Subject Hours Comparison
              </h2>
              <p className="text-xs text-slate-500">
                Side-by-side comparison of total hours studied across subjects
              </p>
            </div>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={subjectBreakdownData}
                  layout="vertical"
                  margin={{ left: 20, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.2} />
                  <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    width={90}
                  />
                  <Tooltip formatter={(v: any) => [`${v} hrs`, 'Total Studied']} />
                  <Bar dataKey="hours" radius={[0, 5, 5, 0]}>
                    {subjectBreakdownData.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* G. Productivity vs. Time-of-Day Analytics */}
          <div className="lg:col-span-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>G. Productivity vs. Time-of-Day Analysis</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Study duration and average focus ratings across Morning, Afternoon, Evening, and Night
                </p>
              </div>
              {timeOfDayData.peak && (
                <div className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Peak Focus Bracket: {timeOfDayData.peak.name} ({timeOfDayData.peak.avgRating}/5.0 Focus Score)</span>
                </div>
              )}
            </div>

            {/* 4 Bracket Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {timeOfDayData.rows.map((b) => {
                const Icon = b.icon;
                return (
                  <div
                    key={b.key}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Icon className="w-4 h-4 text-slate-500" />
                        {b.name}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">{b.timeRange}</span>
                    </div>
                    <div className="flex items-baseline justify-between pt-1">
                      <div className="font-mono tabular-nums text-xl font-bold text-slate-900 dark:text-white">
                        {b.hours}h
                      </div>
                      <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {b.sessionCount} {b.sessionCount === 1 ? 'session' : 'sessions'}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-slate-500">Avg Focus Rating:</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        {b.avgRating > 0 ? `${b.avgRating} / 5.0` : 'No data'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dual Axis Chart */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timeOfDayData.rows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11 }}
                    unit="h"
                    label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#64748b' } }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 5]}
                    tick={{ fontSize: 11 }}
                    unit="/5"
                    label={{ value: 'Rating', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#64748b' } }}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      name === 'Studied Hours' ? `${value} hrs` : `${value} / 5.0`,
                      String(name || ''),
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    yAxisId="left"
                    dataKey="hours"
                    name="Studied Hours"
                    fill="#2563EB"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgRating"
                    name="Avg Focus Rating (1-5)"
                    stroke="#F59E0B"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#F59E0B' }}
                    activeDot={{ r: 7 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Sub-View 2: Planned vs. Actual Analytics */}
      {subView === 'planned_vs_actual' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
              <span className="text-xs text-slate-500">
                Scheduled Study Hours ({startYmd} to {endYmd})
              </span>
              <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
                {plannedVsActualData.totalPlannedHours}h
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
              <span className="text-xs text-slate-500">
                Actual Recorded Study Hours
              </span>
              <div className="font-mono tabular-nums text-2xl font-bold text-blue-600 dark:text-blue-400">
                {plannedVsActualData.totalActualHours}h
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
              <span className="text-xs text-slate-500">
                Schedule Adherence / Completion Rate
              </span>
              <div className="font-mono tabular-nums text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {plannedVsActualData.overallAdherencePct}%
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Subject-Level Planned vs. Actual Study Hours
              </h2>
              <p className="text-xs text-slate-500">
                Comparing your weekly timetable commitments against verified study sessions
              </p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={plannedVsActualData.rows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} unit="h" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="plannedHours"
                    name="Scheduled Hours"
                    fill="#94A3B8"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="actualHours"
                    name="Actual Recorded Hours"
                    fill="#2563EB"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detailed Subject Adherence Table */}
            <div className="overflow-x-auto pt-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2.5 px-3 font-medium">Subject</th>
                    <th className="py-2.5 px-3 font-medium text-right">Planned</th>
                    <th className="py-2.5 px-3 font-medium text-right">Actual</th>
                    <th className="py-2.5 px-3 font-medium text-right">Variance</th>
                    <th className="py-2.5 px-3 font-medium text-right">Completion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
                  {plannedVsActualData.rows.map((r) => {
                    const diffMins = r.actualMinutes - r.plannedMinutes;
                    return (
                      <tr key={r.id}>
                        <td className="py-2.5 px-3 font-sans font-semibold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: r.color }}
                            />
                            <span>{r.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {formatDurationHuman(r.plannedMinutes * 60)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400 font-semibold">
                          {formatDurationHuman(r.actualMinutes * 60)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right ${
                            diffMins >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {diffMins >= 0 ? '+' : '-'}
                          {formatDurationHuman(Math.abs(diffMins) * 60)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold">
                          {r.completionPct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub-View 3: Weekly Summary Reports */}
      {subView === 'weekly_reports' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Weekly Academic Performance Report
              </h2>
              <p className="text-xs text-slate-500 font-mono tabular-nums">
                Window: {weeklyReport.weekStart} → {weeklyReport.weekEnd} (compared against{' '}
                {weeklyReport.prevWeekStart} → {weeklyReport.prevWeekEnd})
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReportWeekOffset((w) => w - 1)}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-slate-700 dark:text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={reportWeekOffset === 0}
                onClick={() => setReportWeekOffset(0)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium cursor-pointer disabled:opacity-50 text-slate-700 dark:text-slate-300"
              >
                Current Week
              </button>
              <button
                type="button"
                disabled={reportWeekOffset >= 0}
                onClick={() => setReportWeekOffset((w) => Math.min(0, w + 1))}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-40 text-slate-700 dark:text-slate-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={exportWeeklyReportCsv}
                className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Report CSV</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-xs text-slate-500">Weekly Study Time</span>
              <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
                {formatDurationHuman(weeklyReport.currentTotalSec)}
              </div>
              <div
                className={`flex items-center gap-1 text-xs font-mono ${
                  weeklyReport.deltaSeconds >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {weeklyReport.deltaSeconds >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                <span>
                  {weeklyReport.deltaPercent >= 0 ? '+' : ''}
                  {weeklyReport.deltaPercent}% vs. prev week (
                  {formatDurationHuman(weeklyReport.prevTotalSec)})
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-xs text-slate-500">Completed Tasks & Sessions</span>
              <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-white">
                {weeklyReport.completedTasksCount} tasks · {weeklyReport.sessionCount}{' '}
                sessions
              </div>
              <span className="text-xs text-slate-500">
                Recorded during this 7-day period
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-xs text-slate-500">Daily Target Hit Rate</span>
              <div className="font-mono tabular-nums text-2xl font-bold text-blue-600 dark:text-blue-400">
                {weeklyReport.daysMetGoal} / 7 days
              </div>
              <span className="text-xs text-slate-500">
                Days reaching {dailyTargetHours}h daily goal
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-xs text-slate-500">Active Consistency</span>
              <div className="font-mono tabular-nums text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {weeklyReport.activeDaysInWeek} / 7 active days
              </div>
              <span className="text-xs text-slate-500">
                Current Streak: {summaryMetrics.currentStreak}d
              </span>
            </div>
          </div>

          {/* Subject Breakdown Table for Weekly Report */}
          <div className="space-y-3">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Subject Breakdown & Week-over-Week Comparison
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2.5 px-3 font-medium">Subject</th>
                    <th className="py-2.5 px-3 font-medium text-right">Sessions</th>
                    <th className="py-2.5 px-3 font-medium text-right">This Week</th>
                    <th className="py-2.5 px-3 font-medium text-right">Previous Week</th>
                    <th className="py-2.5 px-3 font-medium text-right">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
                  {weeklyReport.subjectRows.map((row) => (
                    <tr key={row.subject.id}>
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: row.subject.color }}
                          />
                          <span>{row.subject.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">{row.sessionCount}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-blue-600 dark:text-blue-400">
                        {formatDurationHuman(row.curSec)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">
                        {formatDurationHuman(row.prevSec)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right ${
                          row.diffSec >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {row.diffSec >= 0 ? '+' : '-'}
                        {formatDurationHuman(Math.abs(row.diffSec))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub-View 4: Yearly Heatmap */}
      {subView === 'heatmap' && (
        <HeatmapWidget
          sessions={studySessions}
          subjects={subjects}
          timezone={timezone}
          dailyTargetMinutes={profile.dailyStudyTargetMinutes || 360}
        />
      )}

      {/* Sub-View 5: Revision Analytics */}
      {subView === 'revision' && (
        <div className="space-y-6">
          {/* Strict Separation Notice */}
          <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60 flex items-start gap-3">
            <BookOpenCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs">
              <p className="font-bold text-blue-950 dark:text-blue-200">
                Strict Separation of Revision Activities & Study Hours
              </p>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Revision checklist milestones track syllabus coverage across Class, Revision Note, Book Reading, MCQ Exam, CQ Solve, and Test Paper Solving. They do not artificially alter study timer hours unless explicitly recorded as study sessions.
              </p>
            </div>
          </div>

          {!revisionPayload ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse text-xs text-slate-400">
              Loading revision analytics...
            </div>
          ) : (
            <>
              {/* Revision KPI Cards & Detailed Recharts Visualizations */}
              {(() => {
                const totalChapters = revisionPayload.topics.length;
                const totalPossible = totalChapters * 6;
                const completedRecords = revisionPayload.records.filter((r) => r.isCompleted);
                const totalCompleted = completedRecords.length;
                const pct = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;
                const pending = Math.max(0, totalPossible - totalCompleted);

                // Subject completion data
                const subjectChartData = revisionPayload.subjects.map((sub) => {
                  const subTopics = revisionPayload.topics.filter((t) => t.subjectId === sub.id);
                  const subPossible = subTopics.length * 6;
                  const subCompleted = revisionPayload.records.filter(
                    (r) => r.subjectId === sub.id && r.isCompleted
                  ).length;
                  const subPct = subPossible > 0 ? Math.round((subCompleted / subPossible) * 100) : 0;
                  return {
                    name: sub.name.split(' ')[0],
                    fullName: sub.name,
                    completed: subCompleted,
                    possible: subPossible,
                    percentage: subPct,
                    color: sub.color,
                  };
                });

                // Category completion data (in exact order)
                const categoryChartData = REVISION_CATEGORIES.map((cat) => {
                  const catCompleted = revisionPayload.records.filter(
                    (r) => r.category === cat.id && r.isCompleted
                  ).length;
                  return {
                    category: cat.shortLabel,
                    fullName: cat.label,
                    count: catCompleted,
                    fill: cat.color,
                  };
                });

                // Completed vs Pending Pie
                const pieData = [
                  { name: 'Completed', value: totalCompleted, color: '#10B981' },
                  { name: 'Pending', value: pending, color: '#94A3B8' },
                ];

                // Daily trend
                const dateCountMap = new Map<string, number>();
                for (const r of completedRecords) {
                  const d =
                    r.activityDate ||
                    (typeof r.updatedAt === 'string'
                      ? r.updatedAt.slice(0, 10)
                      : new Date(r.updatedAt).toISOString().slice(0, 10));
                  dateCountMap.set(d, (dateCountMap.get(d) || 0) + 1);
                }
                const sortedDates = Array.from(dateCountMap.keys()).sort().slice(-14);
                const trendData = sortedDates.map((date) => ({
                  date: date.slice(5),
                  activities: dateCountMap.get(date) || 0,
                }));

                return (
                  <div className="space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                        <span className="text-xs text-slate-500">Activities Completed</span>
                        <p className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                          {totalCompleted} <span className="text-xs font-normal text-slate-400">/ {totalPossible}</span>
                        </p>
                      </div>
                      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                        <span className="text-xs text-slate-500">Syllabus Completion</span>
                        <p className="font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                          {pct}%
                        </p>
                      </div>
                      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                        <span className="text-xs text-slate-500">Active Chapters</span>
                        <p className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                          {totalChapters}
                        </p>
                      </div>
                      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                        <span className="text-xs text-slate-500">Pending Activities</span>
                        <p className="font-display text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                          {pending}
                        </p>
                      </div>
                    </div>

                    {/* Chart 1: Subject Progress & Category Distribution */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                        <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                          Milestones by Subject
                        </h3>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={subjectChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 11 }} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12, color: '#fff' }}
                                formatter={(val: any, _name: any, item: any) => [`${val} (${item.payload.percentage}%)`, item.payload.fullName]}
                              />
                              <Bar dataKey="completed" radius={[4, 4, 0, 0]}>
                                {subjectChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color || '#2563EB'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                        <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                          Category Breakdown (Exact 6 Order)
                        </h3>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                              <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 11 }} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12, color: '#fff' }}
                                formatter={(val: any, _name: any, item: any) => [`${val} chapters`, item.payload.fullName]}
                              />
                              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                {categoryChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Chart 2: Daily Activity Trend & Completed vs Pending Pie */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                        <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                          Daily Revision Activity Trend
                        </h3>
                        <div className="h-56">
                          {trendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                  <linearGradient id="revisionGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12, color: '#fff' }}
                                  formatter={(val: any) => [`${val} activities`, 'Completed']}
                                />
                                <Area type="monotone" dataKey="activities" stroke="#2563EB" strokeWidth={2} fillOpacity={1} fill="url(#revisionGrad)" />
                              </AreaChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-full flex items-center justify-center text-xs text-slate-400">
                              No dated activity records logged yet.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                        <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                          Completed vs. Pending
                        </h3>
                        <div className="h-56 flex flex-col items-center justify-center">
                          <ResponsiveContainer width="100%" height="80%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={65}
                                paddingAngle={4}
                                dataKey="value"
                              >
                                {pieData.map((entry, index) => (
                                  <Cell key={`pie-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12, color: '#fff' }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Done ({pct}%)
                            </span>
                            <span className="flex items-center gap-1.5 text-slate-400 font-semibold">
                              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Pending ({100 - pct}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}
