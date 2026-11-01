'use client';

import React, { useMemo, useState } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { ScheduleItem, TaskItem } from '@/types';
import {
  formatDurationHuman,
  getMinutesBetweenHHMM,
  toDateStringInTz,
} from '@/lib/timezone';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const WEEKDAYS = [
  { index: 1, name: 'Monday', short: 'Mon' },
  { index: 2, name: 'Tuesday', short: 'Tue' },
  { index: 3, name: 'Wednesday', short: 'Wed' },
  { index: 4, name: 'Thursday', short: 'Thu' },
  { index: 5, name: 'Friday', short: 'Fri' },
  { index: 6, name: 'Saturday', short: 'Sat' },
  { index: 0, name: 'Sunday', short: 'Sun' },
];

export function ScheduleAndTasksView() {
  const {
    data,
    createTask,
    updateTask,
    deleteTask,
    createSchedule,
    updateSchedule,
    deleteSchedule,
  } = useWorkspace();

  const [sectionMode, setSectionMode] = useState<'both' | 'timetable' | 'tasks'>('both');
  const [activeMobileDay, setActiveMobileDay] = useState<number | 'all'>('all');

  // Task Filters & Sorting
  const [taskSubjectFilter, setTaskSubjectFilter] = useState<string>('all');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  const [taskSortBy, setTaskSortBy] = useState<'deadline' | 'priority'>('deadline');

  // Task Modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskSubjectId, setTaskSubjectId] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskStatus, setTaskStatus] = useState<'pending' | 'in_progress' | 'completed'>(
    'pending'
  );

  // Schedule Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
  const [schedSubjectId, setSchedSubjectId] = useState('');
  const [schedDayOfWeek, setSchedDayOfWeek] = useState<number>(1);
  const [schedStartTime, setSchedStartTime] = useState('09:00');
  const [schedEndTime, setSchedEndTime] = useState('10:30');
  const [schedDescription, setSchedDescription] = useState('');

  const timezone = data?.profile?.timezone || 'Asia/Dhaka';
  const todayYmd = toDateStringInTz(new Date(), timezone);
  const activeSubjects = useMemo(() => data?.subjects?.filter((s) => !s.isArchived) || [], [data?.subjects]);
  const subjectMap = useMemo(() => new Map(data?.subjects?.map((s) => [s.id, s]) || []), [data?.subjects]);

  // Today's Tasks
  const todaysTasks = useMemo(
    () =>
      data?.tasks?.filter((t) => toDateStringInTz(t.dueDate, timezone) === todayYmd) || [],
    [data?.tasks, timezone, todayYmd]
  );

  // Filtered & Sorted Tasks
  const filteredTasks = useMemo(() => {
    if (!data?.tasks) return [];
    const priorityRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
    return data.tasks
      .filter((t) => {
        if (taskSubjectFilter !== 'all' && t.subjectId !== taskSubjectFilter) {
          return false;
        }
        if (taskStatusFilter !== 'all' && t.status !== taskStatusFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (taskSortBy === 'priority') {
          const diff =
            (priorityRank[b.priority] || 1) - (priorityRank[a.priority] || 1);
          if (diff !== 0) return diff;
        }
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
  }, [data?.tasks, taskSubjectFilter, taskStatusFilter, taskSortBy]);

  // Weekly Planned Minutes
  const weeklyPlannedMinutes = useMemo(
    () =>
      data?.schedules?.reduce(
        (acc, sch) => acc + getMinutesBetweenHHMM(sch.startTime, sch.endTime),
        0
      ) || 0,
    [data?.schedules]
  );

  const openCreateTask = () => {
    setEditingTask(null);
    setTaskTitle('');
    setTaskSubjectId(activeSubjects[0]?.id || data?.subjects[0]?.id || '');
    setTaskDescription('');
    setTaskDueDate(todayYmd);
    setTaskPriority('medium');
    setTaskStatus('pending');
    setShowTaskModal(true);
  };

  const openEditTask = (t: TaskItem) => {
    setEditingTask(t);
    setTaskTitle(t.title);
    setTaskSubjectId(t.subjectId);
    setTaskDescription(t.description || '');
    setTaskDueDate(toDateStringInTz(t.dueDate, timezone));
    setTaskPriority((t.priority as any) || 'medium');
    setTaskStatus((t.status as any) || 'pending');
    setShowTaskModal(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskSubjectId) return;
    const dueIso = new Date(`${taskDueDate}T23:59:00`).toISOString();
    if (editingTask) {
      await updateTask(editingTask.id, {
        subjectId: taskSubjectId,
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        dueDate: dueIso,
        priority: taskPriority,
        status: taskStatus,
      });
    } else {
      await createTask({
        subjectId: taskSubjectId,
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        dueDate: dueIso,
        priority: taskPriority,
        status: taskStatus,
      });
    }
    setShowTaskModal(false);
  };

  const openCreateSchedule = (defaultDay = 1) => {
    setEditingSchedule(null);
    setSchedSubjectId(activeSubjects[0]?.id || data?.subjects[0]?.id || '');
    setSchedDayOfWeek(defaultDay);
    setSchedStartTime('09:00');
    setSchedEndTime('10:30');
    setSchedDescription('');
    setShowScheduleModal(true);
  };

  const openEditSchedule = (sch: ScheduleItem) => {
    setEditingSchedule(sch);
    setSchedSubjectId(sch.subjectId);
    setSchedDayOfWeek(sch.dayOfWeek);
    setSchedStartTime(sch.startTime);
    setSchedEndTime(sch.endTime);
    setSchedDescription(sch.description || '');
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedSubjectId) return;
    if (editingSchedule) {
      await updateSchedule(editingSchedule.id, {
        subjectId: schedSubjectId,
        dayOfWeek: schedDayOfWeek,
        startTime: schedStartTime,
        endTime: schedEndTime,
        description: schedDescription,
      });
    } else {
      await createSchedule({
        subjectId: schedSubjectId,
        dayOfWeek: schedDayOfWeek,
        startTime: schedStartTime,
        endTime: schedEndTime,
        description: schedDescription,
      });
    }
    setShowScheduleModal(false);
  };

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Weekly Timetable & Task Manager
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Total scheduled routine: {formatDurationHuman(weeklyPlannedMinutes * 60)}/week ·{' '}
            {data.tasks.filter((t) => t.status !== 'completed').length} pending tasks
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setSectionMode('both')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                sectionMode === 'both'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Split View
            </button>
            <button
              type="button"
              onClick={() => setSectionMode('timetable')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                sectionMode === 'timetable'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Timetable Only
            </button>
            <button
              type="button"
              onClick={() => setSectionMode('tasks')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                sectionMode === 'tasks'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Tasks Only
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => openCreateSchedule(1)}
            className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-1.5 cursor-pointer h-auto border-transparent hover:bg-slate-800 dark:hover:bg-slate-200"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Add Timetable Slot</span>
          </Button>

          <Button
            type="button"
            onClick={openCreateTask}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer h-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Task</span>
          </Button>
        </div>
      </div>

      {/* Weekly Calendar Timetable */}
      {(sectionMode === 'both' || sectionMode === 'timetable') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Weekly Study Timetable
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Distinct subject colors · Scheduled study time is tracked separately from actual recorded sessions
              </p>
            </div>

            {/* Mobile Day Selector Tabs */}
            <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setActiveMobileDay('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  activeMobileDay === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                All Days
              </button>
              {WEEKDAYS.map((w) => (
                <button
                  key={w.index}
                  type="button"
                  onClick={() => setActiveMobileDay(w.index)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    activeMobileDay === w.index
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {w.short}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {WEEKDAYS.map((day) => {
              const daySlots = data.schedules
                .filter((s) => s.dayOfWeek === day.index)
                .sort((a, b) => a.startTime.localeCompare(b.startTime));

              const isHiddenOnMobile =
                activeMobileDay !== 'all' && activeMobileDay !== day.index;

              return (
                <div
                  key={day.index}
                  className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 p-3 flex flex-col justify-between space-y-3 min-h-[200px] ${
                    isHiddenOnMobile ? 'hidden lg:flex' : 'flex'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2">
                      <span className="font-display text-xs font-bold text-slate-900 dark:text-white">
                        {day.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => openCreateSchedule(day.index)}
                        title={`Add slot on ${day.name}`}
                        className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-900 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {daySlots.length === 0 ? (
                      <p className="text-[11px] text-slate-400 py-4 text-center">
                        No slots
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {daySlots.map((slot) => {
                          const subj = subjectMap.get(slot.subjectId);
                          return (
                            <div
                              key={slot.id}
                              className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1 group"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{
                                      backgroundColor: subj?.color || '#2563EB',
                                    }}
                                  />
                                  <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                    {subj?.name || 'Subject'}
                                  </span>
                                </div>
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => openEditSchedule(slot)}
                                    className="p-0.5 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteSchedule(slot.id)}
                                    className="p-0.5 text-slate-400 hover:text-red-600 cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <div className="font-mono tabular-nums text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                                {slot.startTime} – {slot.endTime}
                              </div>
                              {slot.description && (
                                <p className="text-[11px] text-slate-500 truncate">
                                  {slot.description}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Task and Assignment Management */}
      {(sectionMode === 'both' || sectionMode === 'tasks') && (
        <div className="space-y-6">
          {/* Separate Section for Today's Tasks */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Today's Tasks ({todayYmd})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Assignments and study tasks due today
                </p>
              </div>
              <span className="font-mono tabular-nums text-xs text-slate-500">
                {todaysTasks.filter((t) => t.status === 'completed').length} /{' '}
                {todaysTasks.length} completed
              </span>
            </div>

            {todaysTasks.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                No tasks have a deadline set for today ({todayYmd}).
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {todaysTasks.map((t) => {
                  const subj = subjectMap.get(t.subjectId);
                  return (
                    <div
                      key={t.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer min-w-0">
                        <input
                          type="checkbox"
                          checked={t.status === 'completed'}
                          onChange={() =>
                            updateTask(t.id, {
                              status:
                                t.status === 'completed' ? 'pending' : 'completed',
                            })
                          }
                          className="rounded accent-blue-600"
                        />
                        <div className="min-w-0">
                          <p
                            className={`text-xs font-semibold truncate ${
                              t.status === 'completed'
                                ? 'line-through text-slate-400'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {t.title}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <span>{subj?.name || 'Subject'}</span>
                            <span>·</span>
                            <span className="capitalize">{t.priority} priority</span>
                          </div>
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* All Tasks with Filters & Sorting */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  All Tasks & Assignments
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Filter by subject and status · Sort by deadline or priority · Overdue tasks highlighted
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={taskSubjectFilter}
                  onChange={(e) => setTaskSubjectFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="all">All Subjects</option>
                  {data.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <select
                  value={taskStatusFilter}
                  onChange={(e) => setTaskStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>

                <select
                  value={taskSortBy}
                  onChange={(e) => setTaskSortBy(e.target.value as any)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="deadline">Sort by Deadline</option>
                  <option value="priority">Sort by Priority</option>
                </select>
              </div>
            </div>

            {filteredTasks.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                No tasks match the current filters.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTasks.map((task) => {
                  const subj = subjectMap.get(task.subjectId);
                  const dueYmd = toDateStringInTz(task.dueDate, timezone);
                  const isOverdue =
                    task.status !== 'completed' && dueYmd < todayYmd;

                  return (
                    <div
                      key={task.id}
                      className={`py-3.5 px-3 rounded-lg flex items-center justify-between gap-4 ${
                        isOverdue ? 'bg-red-50/50 dark:bg-red-950/20' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={task.status === 'completed'}
                          onChange={() =>
                            updateTask(task.id, {
                              status:
                                task.status === 'completed' ? 'pending' : 'completed',
                            })
                          }
                          className="mt-1 rounded accent-blue-600 cursor-pointer"
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs font-semibold ${
                                task.status === 'completed'
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {task.title}
                            </span>
                            {isOverdue && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
                                <AlertTriangle className="w-3 h-3" />
                                Overdue
                              </span>
                            )}
                          </div>

                          {task.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {task.description}
                            </p>
                          )}

                          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: subj?.color || '#2563EB' }}
                              />
                              {subj?.name || 'Subject'}
                            </span>
                            <span>·</span>
                            <span className="font-mono tabular-nums">
                              Due {dueYmd}
                            </span>
                            <span>·</span>
                            <span className="capitalize">
                              {task.priority} priority
                            </span>
                            <span>·</span>
                            <span className="capitalize">
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <select
                          value={task.status}
                          onChange={(e) =>
                            updateTask(task.id, { status: e.target.value })
                          }
                          className="px-2 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => openEditTask(task)}
                          className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTask(task.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {editingTask ? 'Edit Task' : 'New Academic Task'}
              </h3>
              <button
                type="button"
                onClick={() => setShowTaskModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g., Complete Lab Report #3"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Subject
                </label>
                <select
                  value={taskSubjectId}
                  onChange={(e) => setTaskSubjectId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none"
                >
                  {data.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Details, chapters, or submission instructions..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={taskStatus}
                    onChange={(e) => setTaskStatus(e.target.value as any)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer h-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer h-auto"
                >
                  Save Task
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Slot Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {editingSchedule ? 'Edit Timetable Slot' : 'Add Timetable Slot'}
              </h3>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Subject
                  </label>
                  <select
                    value={schedSubjectId}
                    onChange={(e) => setSchedSubjectId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    {data.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Weekday
                  </label>
                  <select
                    value={schedDayOfWeek}
                    onChange={(e) => setSchedDayOfWeek(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    {WEEKDAYS.map((w) => (
                      <option key={w.index} value={w.index}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={schedStartTime}
                    onChange={(e) => setSchedStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={schedEndTime}
                    onChange={(e) => setSchedEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={schedDescription}
                  onChange={(e) => setSchedDescription(e.target.value)}
                  placeholder="e.g., Problem Solving & Past Papers"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer h-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer h-auto"
                >
                  Save Slot
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
