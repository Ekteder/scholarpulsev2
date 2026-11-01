'use client';

import React, { useMemo, useState } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Subject } from '@/types';
import {
  addDaysToYmd,
  formatDurationHuman,
  toDateStringInTz,
  toTimeStringInTz,
} from '@/lib/timezone';
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
  Archive,
  ArchiveRestore,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Edit3,
  FileText,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const COLOR_PALETTE = [
  '#2563EB',
  '#0284C7',
  '#0891B2',
  '#16A34A',
  '#D97706',
  '#DC2626',
  '#9333EA',
  '#DB2777',
];

export function SubjectsView() {
  const {
    data,
    selectedSubjectId,
    setSelectedSubjectId,
    createSubject,
    updateSubject,
    deleteSubject,
    createTask,
    updateTask,
  } = useWorkspace();

  const [tabFilter, setTabFilter] = useState<'active' | 'archived'>('active');
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);

  // Subject form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#2563EB');
  const [dailyTargetMinutes, setDailyTargetMinutes] = useState(60);
  const [weeklyTargetMinutes, setWeeklyTargetMinutes] = useState(300);
  const [submitting, setSubmitting] = useState(false);

  // Subject detail page state
  const [notesDraft, setNotesDraft] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>(
    'medium'
  );

  const timezone = data?.profile?.timezone || 'Asia/Dhaka';
  const todayYmd = toDateStringInTz(new Date(), timezone);
  const weekAgoYmd = addDaysToYmd(todayYmd, -6);
  const monthAgoYmd = addDaysToYmd(todayYmd, -29);

  // Compute aggregated metrics per subject
  const subjectStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        totalSeconds: number;
        todaySeconds: number;
        weekSeconds: number;
        monthSeconds: number;
        sessionCount: number;
        taskCount: number;
        completedTaskCount: number;
      }
    >();

    if (!data?.subjects) return map;

    for (const sub of data.subjects) {
      map.set(sub.id, {
        totalSeconds: 0,
        todaySeconds: 0,
        weekSeconds: 0,
        monthSeconds: 0,
        sessionCount: 0,
        taskCount: 0,
        completedTaskCount: 0,
      });
    }

    for (const sess of data.studySessions) {
      const entry = map.get(sess.subjectId);
      if (!entry) continue;
      const ymd = toDateStringInTz(sess.startTime, timezone);
      entry.totalSeconds += sess.durationSeconds;
      entry.sessionCount += 1;
      if (ymd === todayYmd) entry.todaySeconds += sess.durationSeconds;
      if (ymd >= weekAgoYmd && ymd <= todayYmd) {
        entry.weekSeconds += sess.durationSeconds;
      }
      if (ymd >= monthAgoYmd && ymd <= todayYmd) {
        entry.monthSeconds += sess.durationSeconds;
      }
    }

    for (const t of data.tasks) {
      const entry = map.get(t.subjectId);
      if (!entry) continue;
      entry.taskCount += 1;
      if (t.status === 'completed') entry.completedTaskCount += 1;
    }

    return map;
  }, [data?.subjects, data?.studySessions, data?.tasks, timezone, todayYmd, weekAgoYmd, monthAgoYmd]);

  const openCreateModal = () => {
    setEditingSubject(null);
    setName('');
    setDescription('');
    setColor('#2563EB');
    setDailyTargetMinutes(60);
    setWeeklyTargetMinutes(300);
    setShowModal(true);
  };

  const openEditModal = (sub: Subject) => {
    setEditingSubject(sub);
    setName(sub.name);
    setDescription(sub.description || '');
    setColor(sub.color || '#2563EB');
    setDailyTargetMinutes(sub.dailyTargetMinutes || 60);
    setWeeklyTargetMinutes(sub.weeklyTargetMinutes || 300);
    setShowModal(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      if (editingSubject) {
        await updateSubject(editingSubject.id, {
          name: name.trim(),
          description: description.trim(),
          color,
          dailyTargetMinutes,
          weeklyTargetMinutes,
        });
      } else {
        await createSubject({
          name: name.trim(),
          description: description.trim(),
          color,
          icon: 'BookOpen',
          dailyTargetMinutes,
          weeklyTargetMinutes,
        });
      }
      setShowModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!data) return null;

  // Selected Subject Detail View
  const selectedSubject = data.subjects.find((s) => s.id === selectedSubjectId);

  if (selectedSubject) {
    const stats = subjectStatsMap.get(selectedSubject.id) || {
      totalSeconds: 0,
      todaySeconds: 0,
      weekSeconds: 0,
      monthSeconds: 0,
      sessionCount: 0,
      taskCount: 0,
      completedTaskCount: 0,
    };

    const subjectSessions = data.studySessions.filter(
      (s) => s.subjectId === selectedSubject.id
    );
    const subjectTasks = data.tasks.filter((t) => t.subjectId === selectedSubject.id);

    // 14-day progress chart for this subject
    const chart14Days = [];
    for (let i = 13; i >= 0; i--) {
      const ymd = addDaysToYmd(todayYmd, -i);
      const daySec = subjectSessions
        .filter((s) => toDateStringInTz(s.startTime, timezone) === ymd)
        .reduce((acc, s) => acc + s.durationSeconds, 0);
      chart14Days.push({
        date: ymd.slice(5),
        hours: Number((daySec / 3600).toFixed(2)),
      });
    }

    const weeklyTargetSec = Math.max(60, selectedSubject.weeklyTargetMinutes * 60);
    const weeklyPct = Math.min(
      100,
      Math.round((stats.weekSeconds / weeklyTargetSec) * 100)
    );
    const monthlyTargetSec = weeklyTargetSec * 4;
    const monthlyPct = Math.min(
      100,
      Math.round((stats.monthSeconds / monthlyTargetSec) * 100)
    );

    const currentNotes = notesDirty ? notesDraft : selectedSubject.notes || '';

    const handleSaveNotes = async () => {
      await updateSubject(selectedSubject.id, { notes: currentNotes });
      setNotesDirty(false);
    };

    const handleQuickAddSubjectTask = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTaskTitle.trim()) return;
      await createTask({
        subjectId: selectedSubject.id,
        title: newTaskTitle.trim(),
        description: '',
        dueDate: newTaskDue ? new Date(newTaskDue).toISOString() : new Date().toISOString(),
        priority: newTaskPriority,
        status: 'pending',
      });
      setNewTaskTitle('');
    };

    return (
      <div className="space-y-6">
        {/* Back Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedSubjectId(null);
                setNotesDirty(false);
              }}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedSubject.color }}
                />
                <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  {selectedSubject.name}
                </h1>
                {selectedSubject.isArchived && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    · Archived
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedSubject.description || 'Subject Analytics, Tasks & Study Notes'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => openEditModal(selectedSubject)}
              className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer h-auto"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Subject</span>
            </Button>
          </div>
        </div>

        {/* Subject KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1 shadow-xs">
            <span className="text-xs text-slate-500">Total Time Studied</span>
            <div className="font-mono tabular-nums text-xl font-bold text-slate-900 dark:text-white">
              {formatDurationHuman(stats.totalSeconds)}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1 shadow-xs">
            <span className="text-xs text-slate-500">Weekly Progress</span>
            <div className="font-mono tabular-nums text-xl font-bold text-blue-600 dark:text-blue-400">
              {formatDurationHuman(stats.weekSeconds)} ({weeklyPct}%)
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1 shadow-xs">
            <span className="text-xs text-slate-500">Monthly Progress (30d)</span>
            <div className="font-mono tabular-nums text-xl font-bold text-slate-900 dark:text-white">
              {formatDurationHuman(stats.monthSeconds)} ({monthlyPct}%)
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1 shadow-xs">
            <span className="text-xs text-slate-500">Completed Sessions</span>
            <div className="font-mono tabular-nums text-xl font-bold text-slate-900 dark:text-white">
              {stats.sessionCount}
            </div>
          </div>
        </div>

        {/* 14-Day Progress Chart + Subject Study Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-xs">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              14-Day Study Progress Chart
            </h2>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chart14Days}
                  margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#94a3b8"
                    strokeOpacity={0.2}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    unit="h"
                  />
                  <Tooltip
                    formatter={(val: any) => [`${val} hrs`, selectedSubject.name]}
                  />
                  <Bar
                    dataKey="hours"
                    fill={selectedSubject.color || '#2563EB'}
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subject Study Notes */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Subject Study Notes
                </h2>
              </div>
              <Button
                type="button"
                onClick={handleSaveNotes}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer h-auto"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Notes</span>
              </Button>
            </div>

            <textarea
              rows={8}
              value={currentNotes}
              onChange={(e) => {
                setNotesDraft(e.target.value);
                setNotesDirty(true);
              }}
              placeholder={`Write syllabus checklists, key formulas, exam dates, or reference links for ${selectedSubject.name}...`}
              className="w-full flex-1 px-3 py-2.5 text-xs leading-relaxed rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Subject Tasks + Subject Session History */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Subject-Specific Tasks */}
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-xs">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              {selectedSubject.name} Tasks ({subjectTasks.length})
            </h2>

            <form
              onSubmit={handleQuickAddSubjectTask}
              className="flex flex-wrap items-center gap-2"
            >
              <input
                type="text"
                required
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Add a task for this subject..."
                className="flex-1 min-w-[160px] px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
              <input
                type="date"
                value={newTaskDue || todayYmd}
                onChange={(e) => setNewTaskDue(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <Button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold cursor-pointer h-auto"
              >
                Add
              </Button>
            </form>

            {subjectTasks.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">
                No tasks linked to {selectedSubject.name} yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {subjectTasks.map((t) => (
                  <div
                    key={t.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer min-w-0">
                      <input
                        type="checkbox"
                        checked={t.status === 'completed'}
                        onChange={() =>
                          updateTask(t.id, {
                            status: t.status === 'completed' ? 'pending' : 'completed',
                          })
                        }
                        className="rounded accent-blue-600"
                      />
                      <span
                        className={`truncate ${
                          t.status === 'completed'
                            ? 'line-through text-slate-400'
                            : 'text-slate-900 dark:text-white font-medium'
                        }`}
                      >
                        {t.title}
                      </span>
                    </label>
                    <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">
                      Due {toDateStringInTz(t.dueDate, timezone)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subject Study Session History */}
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-xs">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Study Session History ({subjectSessions.length})
            </h2>

            {subjectSessions.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">
                No sessions recorded for {selectedSubject.name} yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
                {subjectSessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white truncate">
                        {sess.topic}
                      </p>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {toDateStringInTz(sess.startTime, timezone)} ·{' '}
                        {toTimeStringInTz(sess.startTime, timezone)} –{' '}
                        {toTimeStringInTz(sess.endTime, timezone)}
                      </div>
                    </div>
                    <span className="font-mono tabular-nums font-bold text-blue-600 dark:text-blue-400 shrink-0">
                      {formatDurationHuman(sess.durationSeconds)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main Subjects Grid View
  const filteredSubjects = data.subjects.filter((s) =>
    tabFilter === 'active' ? !s.isArchived : s.isArchived
  );

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Academic Subjects
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Click any subject card to inspect its progress chart, session history, tasks, and notes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setTabFilter('active')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                tabFilter === 'active'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Active ({data.subjects.filter((s) => !s.isArchived).length})
            </button>
            <button
              type="button"
              onClick={() => setTabFilter('archived')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                tabFilter === 'archived'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Archived ({data.subjects.filter((s) => s.isArchived).length})
            </button>
          </div>

          <Button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer h-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Subject</span>
          </Button>
        </div>
      </div>

      {/* Subjects Grid */}
      {filteredSubjects.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-3 shadow-xs">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {tabFilter === 'active'
              ? 'No active subjects yet'
              : 'No archived subjects'}
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {tabFilter === 'active'
              ? 'Create subjects like Physics, Chemistry, Mathematics, or ICT to start organizing your study sessions and tasks.'
              : 'Archived subjects preserve all historical study logs and analytics without cluttering your active dropdowns.'}
          </p>
          {tabFilter === 'active' && (
            <Button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer h-auto"
            >
              Create First Subject
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSubjects.map((sub) => {
            const stats = subjectStatsMap.get(sub.id) || {
              totalSeconds: 0,
              todaySeconds: 0,
              weekSeconds: 0,
              monthSeconds: 0,
              sessionCount: 0,
              taskCount: 0,
              completedTaskCount: 0,
            };

            const weeklyTargetSec = Math.max(60, (sub.weeklyTargetMinutes || 300) * 60);
            const weeklyPct = Math.min(
              100,
              Math.round((stats.weekSeconds / weeklyTargetSec) * 100)
            );

            return (
              <div
                key={sub.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between space-y-4 sm:space-y-5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSubjectId(sub.id)}
                      className="flex items-center gap-2.5 text-left group cursor-pointer"
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: sub.color }}
                      />
                      <span className="font-display text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {sub.name}
                      </span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(sub)}
                        title="Edit Subject"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateSubject(sub.id, { isArchived: !sub.isArchived })
                        }
                        title={sub.isArchived ? 'Unarchive Subject' : 'Archive Subject'}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer transition-colors"
                      >
                        {sub.isArchived ? (
                          <ArchiveRestore className="w-3.5 h-3.5" />
                        ) : (
                          <Archive className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingSubject(sub)}
                        title="Delete Subject"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {sub.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {sub.description}
                    </p>
                  )}

                  {/* Clean unboxed metadata row */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    <span className="inline-flex items-center gap-1 text-slate-900 dark:text-white font-semibold">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      {formatDurationHuman(stats.totalSeconds)}
                    </span>
                    <span>·</span>
                    <span>{stats.sessionCount} sessions</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {stats.completedTaskCount}/{stats.taskCount} tasks
                    </span>
                  </div>
                </div>

                {/* Targets & Weekly Progress Bar */}
                <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    <span>
                      Daily Target: {formatDurationHuman(sub.dailyTargetMinutes * 60)}
                    </span>
                    <span>
                      7d: {formatDurationHuman(stats.weekSeconds)} /{' '}
                      {formatDurationHuman(weeklyTargetSec)} ({weeklyPct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${weeklyPct}%`,
                        backgroundColor: sub.color,
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSubjectId(sub.id)}
                    className="w-full pt-1 text-left text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Open Subject Details & Study Notes →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Subject Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {editingSubject ? 'Edit Subject' : 'Create New Subject'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Subject Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Physics, Organic Chemistry, Calculus"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Course code, syllabus focus, or instructor"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Subject Color
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full cursor-pointer transition-transform ${
                        color === c ? 'scale-110 ring-2 ring-offset-2 ring-slate-400' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Daily Target (Minutes)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={720}
                    value={dailyTargetMinutes}
                    onChange={(e) => setDailyTargetMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Weekly Target (Minutes)
                  </label>
                  <input
                    type="number"
                    min={30}
                    max={4000}
                    value={weeklyTargetMinutes}
                    onChange={(e) => setWeeklyTargetMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer h-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer h-auto"
                >
                  {submitting ? 'Saving...' : 'Save Subject'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safe Subject Deletion Policy Modal */}
      {deletingSubject && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Subject Deletion & History Policy
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong>"{deletingSubject.name}"</strong> has{' '}
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {subjectStatsMap.get(deletingSubject.id)?.sessionCount || 0}
              </span>{' '}
              recorded study sessions and{' '}
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {subjectStatsMap.get(deletingSubject.id)?.taskCount || 0}
              </span>{' '}
              tasks.
            </p>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
              <p>
                • <strong>Archive Instead (Recommended):</strong> Hides this subject
                from active dropdowns while preserving 100% of your historical study
                hours and analytics.
              </p>
              <p>
                • <strong>Permanently Delete:</strong> Removes the subject and cascades
                deletion across its linked sessions, tasks, and schedule blocks.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeletingSubject(null)}
                className="px-3.5 py-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer h-auto"
              >
                Cancel
              </Button>
              {!deletingSubject.isArchived && (
                <Button
                  type="button"
                  onClick={async () => {
                    const sub = deletingSubject;
                    setDeletingSubject(null);
                    await updateSubject(sub.id, { isArchived: true });
                  }}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer h-auto"
                >
                  Archive Subject Instead
                </Button>
              )}
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  const sub = deletingSubject;
                  setDeletingSubject(null);
                  await deleteSubject(sub.id);
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer h-auto"
              >
                Permanently Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
