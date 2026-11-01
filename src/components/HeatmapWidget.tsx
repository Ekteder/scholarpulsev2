'use client';

import React, { useMemo, useState } from 'react';
import { StudySession, Subject } from '@/types';
import {
  addDaysToYmd,
  formatDurationHuman,
  toDateStringInTz,
  toTimeStringInTz,
} from '@/lib/timezone';
import { Calendar, Clock, X } from 'lucide-react';

interface HeatmapWidgetProps {
  sessions: StudySession[];
  subjects: Subject[];
  timezone: string;
  dailyTargetMinutes: number;
}

export function HeatmapWidget({
  sessions,
  subjects,
  timezone,
  dailyTargetMinutes,
}: HeatmapWidgetProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const subjectMap = useMemo(() => {
    const map = new Map<string, Subject>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  // Group sessions by YYYY-MM-DD in user's timezone
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, StudySession[]>();
    for (const s of sessions) {
      const ymd = toDateStringInTz(s.startTime, timezone);
      const list = map.get(ymd) || [];
      list.push(s);
      map.set(ymd, list);
    }
    return map;
  }, [sessions, timezone]);

  // Build 52 weeks (364 days) ending today in user's timezone
  const { weeks, totalActiveDaysInYear, totalHoursInYear } = useMemo(() => {
    const todayYmd = toDateStringInTz(new Date(), timezone);
    const [ty, tm, td] = todayYmd.split('-').map(Number);
    const todayDow = new Date(Date.UTC(ty, tm - 1, td)).getUTCDay(); // 0=Sun..6=Sat

    // Start on Sunday 51 weeks before this week's Sunday
    const currentWeekSunday = addDaysToYmd(todayYmd, -todayDow);
    const startYmd = addDaysToYmd(currentWeekSunday, -51 * 7);

    const weeksArr: Array<
      Array<{
        ymd: string;
        totalSeconds: number;
        sessionCount: number;
        intensity: 0 | 1 | 2 | 3 | 4;
        isFuture: boolean;
      }>
    > = [];

    let activeDays = 0;
    let yearSeconds = 0;
    const targetSec = Math.max(1800, dailyTargetMinutes * 60);

    for (let w = 0; w < 52; w++) {
      const weekDays = [];
      for (let d = 0; d < 7; d++) {
        const ymd = addDaysToYmd(startYmd, w * 7 + d);
        const isFuture = ymd > todayYmd;
        const daySessions = sessionsByDate.get(ymd) || [];
        const totalSeconds = daySessions.reduce(
          (acc, s) => acc + s.durationSeconds,
          0
        );

        if (!isFuture && totalSeconds > 0) {
          activeDays++;
          yearSeconds += totalSeconds;
        }

        const ratio = totalSeconds / targetSec;
        let intensity: 0 | 1 | 2 | 3 | 4 = 0;
        if (totalSeconds > 0) {
          if (ratio < 0.25) intensity = 1;
          else if (ratio < 0.6) intensity = 2;
          else if (ratio < 1.0) intensity = 3;
          else intensity = 4;
        }

        weekDays.push({
          ymd,
          totalSeconds,
          sessionCount: daySessions.length,
          intensity,
          isFuture,
        });
      }
      weeksArr.push(weekDays);
    }

    return {
      weeks: weeksArr,
      totalActiveDaysInYear: activeDays,
      totalHoursInYear: (yearSeconds / 3600).toFixed(1),
    };
  }, [sessionsByDate, timezone, dailyTargetMinutes]);

  const selectedDaySessions = useMemo(() => {
    if (!selectedDate) return [];
    return sessionsByDate.get(selectedDate) || [];
  }, [selectedDate, sessionsByDate]);

  const selectedDayTotalSec = useMemo(
    () => selectedDaySessions.reduce((acc, s) => acc + s.durationSeconds, 0),
    [selectedDaySessions]
  );

  const getCellClass = (intensity: 0 | 1 | 2 | 3 | 4, isSelected: boolean) => {
    const ring = isSelected ? 'ring-2 ring-slate-900 dark:ring-white scale-110 z-10' : '';
    switch (intensity) {
      case 0:
        return `bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 ${ring}`;
      case 1:
        return `bg-blue-200 dark:bg-blue-950/90 hover:bg-blue-300 ${ring}`;
      case 2:
        return `bg-blue-400 dark:bg-blue-700 hover:bg-blue-500 ${ring}`;
      case 3:
        return `bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 ${ring}`;
      case 4:
        return `bg-blue-800 dark:bg-blue-400 hover:bg-blue-900 ${ring}`;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Yearly Study Activity Heatmap
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200">
              {totalActiveDaysInYear}
            </span>{' '}
            active study days ·{' '}
            <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200">
              {totalHoursInYear}h
            </span>{' '}
            studied in the past 52 weeks · Click any date to inspect sessions
          </p>
        </div>

        {/* Intensity Legend */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span>Less</span>
          <span className="w-3 h-3 rounded-[3px] bg-slate-100 dark:bg-slate-800" />
          <span className="w-3 h-3 rounded-[3px] bg-blue-200 dark:bg-blue-950" />
          <span className="w-3 h-3 rounded-[3px] bg-blue-400 dark:bg-blue-700" />
          <span className="w-3 h-3 rounded-[3px] bg-blue-600 dark:bg-blue-500" />
          <span className="w-3 h-3 rounded-[3px] bg-blue-800 dark:bg-blue-400" />
          <span>100%+ Goal</span>
        </div>
      </div>

      {/* Scrollable 52-week Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex gap-1 min-w-max">
          {/* Day of week labels */}
          <div className="flex flex-col justify-between pr-2 py-0.5 text-[10px] font-mono text-slate-400 select-none">
            <span>Sun</span>
            <span>Tue</span>
            <span>Thu</span>
            <span>Sat</span>
          </div>

          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="flex flex-col gap-1">
              {week.map((day) =>
                day.isFuture ? (
                  <div
                    key={day.ymd}
                    className="w-3 h-3 rounded-[3px] bg-transparent"
                  />
                ) : (
                  <button
                    key={day.ymd}
                    type="button"
                    onClick={() =>
                      setSelectedDate((prev) => (prev === day.ymd ? null : day.ymd))
                    }
                    title={`${day.ymd}: ${formatDurationHuman(day.totalSeconds)} (${day.sessionCount} sessions)`}
                    aria-label={`${day.ymd}: ${formatDurationHuman(day.totalSeconds)} across ${day.sessionCount} sessions`}
                    className={`w-3 h-3 rounded-[3px] transition-all cursor-pointer ${getCellClass(
                      day.intensity,
                      selectedDate === day.ymd
                    )}`}
                  />
                )
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Day Sessions Inspector */}
      {selectedDate && (
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="font-display font-bold text-slate-900 dark:text-white">
                Sessions on {selectedDate}
              </span>
              <span>·</span>
              <span className="font-mono tabular-nums text-blue-600 dark:text-blue-400 font-semibold">
                {formatDurationHuman(selectedDayTotalSec)} total
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer rounded-md transition-colors"
              aria-label="Close day sessions inspector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {selectedDaySessions.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
              No study sessions were recorded on {selectedDate}.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {selectedDaySessions.map((sess) => {
                const subj = subjectMap.get(sess.subjectId);
                return (
                  <div
                    key={sess.id}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: subj?.color || '#2563EB' }}
                        />
                        <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {subj?.name || 'Subject'}
                        </span>
                      </div>
                      <span className="font-mono tabular-nums text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                        {formatDurationHuman(sess.durationSeconds)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 truncate">
                      {sess.topic}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      <Clock className="w-3 h-3" />
                      <span>
                        {toTimeStringInTz(sess.startTime, timezone)} –{' '}
                        {toTimeStringInTz(sess.endTime, timezone)}
                      </span>
                      <span>·</span>
                      <span className="capitalize">{sess.sessionType}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default HeatmapWidget;
