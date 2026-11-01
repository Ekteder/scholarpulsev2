'use client';

import React, { useMemo, useState } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { StudySession } from '@/types/index';
import {
  addDaysToYmd,
  formatDurationHuman,
  toDateStringInTz,
  toTimeStringInTz,
} from '@/lib/timezone';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  ListFilter,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { MathRenderer } from './MathRenderer';

export function StudyHistoryView() {
  const { data, updateSession, deleteSession } = useWorkspace();
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [calendarScale, setCalendarScale] = useState<'daily' | 'weekly' | 'monthly'>(
    'monthly'
  );

  // Table Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'duration_desc' | 'duration_asc'>(
    'date_desc'
  );
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Calendar cursor date (YYYY-MM-DD)
  const timezone = data?.profile?.timezone || 'Asia/Dhaka';
  const todayYmd = toDateStringInTz(new Date(), timezone);
  const [cursorYmd, setCursorYmd] = useState(todayYmd);

  // Edit / Delete Modal State
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);
  const [editSubjectId, setEditSubjectId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editTopic, setEditTopic] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editRating, setEditRating] = useState(4);
  const [editError, setEditError] = useState<string | null>(null);

  if (!data) return null;

  const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));

  // Filtered and sorted sessions for Table View
  const filteredSessions = useMemo(() => {
    return data.studySessions
      .filter((s) => {
        if (
          searchQuery.trim() &&
          !s.topic.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !(s.notes || '').toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return false;
        }
        if (subjectFilter !== 'all' && s.subjectId !== subjectFilter) {
          return false;
        }
        const ymd = toDateStringInTz(s.startTime, timezone);
        if (startDateFilter && ymd < startDateFilter) return false;
        if (endDateFilter && ymd > endDateFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'duration_desc') return b.durationSeconds - a.durationSeconds;
        if (sortBy === 'duration_asc') return a.durationSeconds - b.durationSeconds;
        if (sortBy === 'date_asc') {
          return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        }
        return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
      });
  }, [
    data.studySessions,
    searchQuery,
    subjectFilter,
    startDateFilter,
    endDateFilter,
    sortBy,
    timezone,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const paginatedSessions = filteredSessions.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  // Sessions indexed by YYYY-MM-DD for Calendar View
  const sessionsByYmd = useMemo(() => {
    const map = new Map<string, StudySession[]>();
    for (const s of data.studySessions) {
      const ymd = toDateStringInTz(s.startTime, timezone);
      const arr = map.get(ymd) || [];
      arr.push(s);
      map.set(ymd, arr);
    }
    return map;
  }, [data.studySessions, timezone]);

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      'Date',
      'Subject',
      'Topic',
      'Start Time',
      'End Time',
      'Duration (Minutes)',
      'Duration (Seconds)',
      'Session Type',
      'Productivity Rating',
      'Notes',
    ];
    const rows = filteredSessions.map((s) => {
      const subj = subjectMap.get(s.subjectId)?.name || 'Subject';
      const dateStr = toDateStringInTz(s.startTime, timezone);
      const startStr = toTimeStringInTz(s.startTime, timezone);
      const endStr = toTimeStringInTz(s.endTime, timezone);
      const escapeCsv = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;

      return [
        dateStr,
        escapeCsv(subj),
        escapeCsv(s.topic),
        startStr,
        endStr,
        String(Math.round(s.durationSeconds / 60)),
        String(s.durationSeconds),
        s.sessionType,
        String(s.productivityRating || 4),
        escapeCsv(s.notes || ''),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ScholarPulse_Study_History_${todayYmd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calendar navigation helpers
  const stepCalendar = (dir: -1 | 1) => {
    if (calendarScale === 'daily') {
      setCursorYmd((prev) => addDaysToYmd(prev, dir));
    } else if (calendarScale === 'weekly') {
      setCursorYmd((prev) => addDaysToYmd(prev, dir * 7));
    } else {
      const [y, m] = cursorYmd.split('-').map(Number);
      const next = new Date(Date.UTC(y, m - 1 + dir, 1));
      setCursorYmd(next.toISOString().slice(0, 10));
    }
  };

  // Monthly calendar cells
  const monthlyCells = useMemo(() => {
    const [y, m] = cursorYmd.split('-').map(Number);
    const firstDayDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells: Array<{ ymd: string | null; dayNum?: number }> = [];

    for (let i = 0; i < firstDayDow; i++) {
      cells.push({ ymd: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const ymd = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ ymd, dayNum: d });
    }
    return cells;
  }, [cursorYmd]);

  // Weekly calendar days (7 days around cursorYmd)
  const weeklyDays = useMemo(() => {
    const [y, m, d] = cursorYmd.split('-').map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const sunday = addDaysToYmd(cursorYmd, -dow);
    return Array.from({ length: 7 }, (_, i) => addDaysToYmd(sunday, i));
  }, [cursorYmd]);

  const openEditModal = (s: StudySession) => {
    setEditingSession(s);
    setEditError(null);
    setEditSubjectId(s.subjectId);
    setEditDate(toDateStringInTz(s.startTime, timezone));
    setEditStart(toTimeStringInTz(s.startTime, timezone));
    setEditEnd(toTimeStringInTz(s.endTime, timezone));
    setEditTopic(s.topic);
    setEditNotes(s.notes || '');
    setEditRating(s.productivityRating || 4);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;
    setEditError(null);
    try {
      const startDt = new Date(`${editDate}T${editStart}:00`);
      const endDt = new Date(`${editDate}T${editEnd}:00`);
      await updateSession(editingSession.id, {
        subjectId: editSubjectId,
        startTime: startDt.toISOString(),
        endTime: endDt.toISOString(),
        topic: editTopic,
        notes: editNotes,
        productivityRating: editRating,
      });
      setEditingSession(null);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update session.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Study History & Calendar Archive
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Search, filter, inspect in Daily/Weekly/Monthly calendar views, or export as CSV
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Table View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Calendar View</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV ({filteredSessions.length})</span>
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          {/* Search & Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by study topic or notes..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>

            <select
              value={subjectFilter}
              onChange={(e) => {
                setSubjectFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="all">All Subjects</option>
              {data.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={startDateFilter}
                onChange={(e) => {
                  setStartDateFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
              <input
                type="date"
                value={endDateFilter}
                onChange={(e) => {
                  setEndDateFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="duration_desc">Longest Duration</option>
              <option value="duration_asc">Shortest Duration</option>
            </select>
          </div>

          {/* Sessions Table */}
          {paginatedSessions.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No study sessions match your filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-3 px-3 font-medium">Date</th>
                    <th className="py-3 px-3 font-medium">Subject</th>
                    <th className="py-3 px-3 font-medium">Topic</th>
                    <th className="py-3 px-3 font-medium">Start – End</th>
                    <th className="py-3 px-3 font-medium text-right">Duration</th>
                    <th className="py-3 px-3 font-medium">Type</th>
                    <th className="py-3 px-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedSessions.map((sess) => {
                    const subj = subjectMap.get(sess.subjectId);
                    return (
                      <tr
                        key={sess.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      >
                        <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-300">
                          {toDateStringInTz(sess.startTime, timezone)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: subj?.color || '#2563EB' }}
                            />
                            <span>{subj?.name || 'Subject'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 max-w-xs">
                          <p className="font-medium text-slate-900 dark:text-white truncate">
                            {sess.topic}
                          </p>
                          {sess.notes && (
                            <div className="text-[11px] text-slate-500 truncate">
                              <MathRenderer content={sess.notes} inline />
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                          {toTimeStringInTz(sess.startTime, timezone)} –{' '}
                          {toTimeStringInTz(sess.endTime, timezone)}
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums font-bold text-blue-600 dark:text-blue-400 text-right whitespace-nowrap">
                          {formatDurationHuman(sess.durationSeconds)}
                        </td>
                        <td className="py-3 px-3 capitalize text-slate-500 whitespace-nowrap">
                          {sess.sessionType}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(sess)}
                              className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSession(sess.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
            <span>
              Showing {paginatedSessions.length} of {filteredSessions.length} sessions
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span className="font-mono tabular-nums">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Calendar View (Daily, Weekly, Monthly Navigation) */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => stepCalendar(-1)}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-slate-700 dark:text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCursorYmd(todayYmd)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium cursor-pointer text-slate-700 dark:text-slate-300"
              >
                Today ({todayYmd})
              </button>
              <button
                type="button"
                onClick={() => stepCalendar(1)}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-slate-700 dark:text-slate-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="font-display font-bold text-sm text-slate-900 dark:text-white ml-2">
                {calendarScale === 'monthly'
                  ? cursorYmd.slice(0, 7)
                  : calendarScale === 'weekly'
                  ? `${weeklyDays[0]} → ${weeklyDays[6]}`
                  : cursorYmd}
              </span>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(['daily', 'weekly', 'monthly'] as const).map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => setCalendarScale(sc)}
                  className={`px-3 py-1 text-xs font-medium rounded-md capitalize cursor-pointer ${
                    calendarScale === sc
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {sc}
                </button>
              ))}
            </div>
          </div>

          {calendarScale === 'monthly' && (
            <div className="overflow-x-auto pb-2 -mx-1 px-1">
              <div className="min-w-[560px] space-y-2">
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {monthlyCells.map((cell, idx) => {
                    if (!cell.ymd) {
                      return (
                        <div
                          key={`empty_${idx}`}
                          className="min-h-[96px] rounded-lg bg-slate-50/40 dark:bg-slate-950/30"
                        />
                      );
                    }
                    const daySessions = sessionsByYmd.get(cell.ymd) || [];
                    const totalSec = daySessions.reduce(
                      (acc, s) => acc + s.durationSeconds,
                      0
                    );
                    const isToday = cell.ymd === todayYmd;

                    return (
                      <div
                        key={cell.ymd}
                        onClick={() => {
                          setCursorYmd(cell.ymd!);
                          setCalendarScale('daily');
                        }}
                        className={`min-h-[96px] p-2 rounded-xl border text-left flex flex-col justify-between cursor-pointer transition-colors ${
                          isToday
                            ? 'border-blue-600 bg-blue-50/20 dark:bg-blue-950/20'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {cell.dayNum}
                          </span>
                          {totalSec > 0 && (
                            <span className="font-mono tabular-nums text-[10px] font-bold text-blue-600 dark:text-blue-400">
                              {formatDurationHuman(totalSec)}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 mt-1">
                          {daySessions.slice(0, 2).map((s) => {
                            const subj = subjectMap.get(s.subjectId);
                            return (
                              <div
                                key={s.id}
                                className="text-[10px] truncate flex items-center gap-1 text-slate-600 dark:text-slate-300"
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: subj?.color || '#2563EB' }}
                                />
                                <span className="truncate">{subj?.name}</span>
                              </div>
                            );
                          })}
                          {daySessions.length > 2 && (
                            <div className="text-[10px] text-slate-400">
                              +{daySessions.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {calendarScale === 'weekly' && (
            <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
              {weeklyDays.map((ymd) => {
                const daySessions = sessionsByYmd.get(ymd) || [];
                const totalSec = daySessions.reduce(
                  (acc, s) => acc + s.durationSeconds,
                  0
                );
                return (
                  <div
                    key={ymd}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2.5 min-h-[220px]"
                  >
                    <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {ymd}
                      </div>
                      <div className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
                        {formatDurationHuman(totalSec)}
                      </div>
                    </div>

                    {daySessions.length === 0 ? (
                      <p className="text-[11px] text-slate-400 py-4 text-center">
                        No logs
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {daySessions.map((s) => {
                          const subj = subjectMap.get(s.subjectId);
                          return (
                            <div
                              key={s.id}
                              onClick={() => openEditModal(s)}
                              className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-0.5 cursor-pointer hover:border-blue-400"
                            >
                              <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: subj?.color || '#2563EB' }}
                                />
                                <span className="truncate">{subj?.name}</span>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                                {s.topic}
                              </p>
                              <div className="font-mono text-[10px] text-slate-400">
                                {toTimeStringInTz(s.startTime, timezone)} ·{' '}
                                {formatDurationHuman(s.durationSeconds)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {calendarScale === 'daily' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Daily Sessions Log for {cursorYmd}
                </h3>
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                  Total:{' '}
                  {formatDurationHuman(
                    (sessionsByYmd.get(cursorYmd) || []).reduce(
                      (acc, s) => acc + s.durationSeconds,
                      0
                    )
                  )}
                </span>
              </div>

              {(sessionsByYmd.get(cursorYmd) || []).length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  No study sessions recorded on {cursorYmd}.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {(sessionsByYmd.get(cursorYmd) || []).map((s) => {
                    const subj = subjectMap.get(s.subjectId);
                    return (
                      <div
                        key={s.id}
                        className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: subj?.color || '#2563EB' }}
                            />
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {subj?.name}
                            </span>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                              {s.topic}
                            </span>
                          </div>
                          {s.notes && (
                            <div className="text-xs text-slate-500">
                              <MathRenderer content={s.notes} inline />
                            </div>
                          )}
                          <div className="font-mono text-[11px] text-slate-500">
                            {toTimeStringInTz(s.startTime, timezone)} –{' '}
                            {toTimeStringInTz(s.endTime, timezone)} · {s.sessionType}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
                            {formatDurationHuman(s.durationSeconds)}
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditModal(s)}
                            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit Session Modal */}
      {editingSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Edit Study Session
              </h3>
              <button
                type="button"
                onClick={() => setEditingSession(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-lg bg-red-50 text-xs text-red-700 border border-red-200">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Subject
                </label>
                <select
                  value={editSubjectId}
                  onChange={(e) => setEditSubjectId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  {data.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Start</label>
                  <input
                    type="time"
                    required
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">End</label>
                  <input
                    type="time"
                    required
                    value={editEnd}
                    onChange={(e) => setEditEnd(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Topic</label>
                <input
                  type="text"
                  required
                  value={editTopic}
                  onChange={(e) => setEditTopic(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notes (KaTeX math supported: e.g. $E=mc^2$)
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono text-xs"
                />
                {editNotes && editNotes.includes('$') && (
                  <div className="mt-1 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">KaTeX Preview:</span>
                    <MathRenderer content={editNotes} inline />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSession(null)}
                  className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
