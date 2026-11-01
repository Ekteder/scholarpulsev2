'use client';

import React, { useState } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { GoalItem } from '@/types';
import { addDaysToYmd, formatDurationHuman, toDateStringInTz } from '@/lib/timezone';
import { CheckCircle2, Edit3, Plus, Target, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function GoalsView() {
  const { data, createGoal, updateGoal, deleteGoal } = useWorkspace();
  const [statusTab, setStatusTab] = useState<'active' | 'completed' | 'expired'>('active');
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalItem | null>(null);

  const timezone = data?.profile?.timezone || 'Asia/Dhaka';
  const todayYmd = toDateStringInTz(new Date(), timezone);

  const [title, setTitle] = useState('');
  const [goalType, setGoalType] = useState<
    'daily' | 'weekly' | 'monthly' | 'subject' | 'streak' | 'sessions'
  >('weekly');
  const [subjectId, setSubjectId] = useState<string>('');
  const [unit, setUnit] = useState<'minutes' | 'sessions' | 'days'>('minutes');
  const [targetHoursOrValue, setTargetHoursOrValue] = useState<number>(10);
  const [startDate, setStartDate] = useState(todayYmd);
  const [endDate, setEndDate] = useState(addDaysToYmd(todayYmd, 7));

  if (!data) return null;

  const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));

  const filteredGoals = data.goals.filter((g) => g.status === statusTab);

  const openCreateModal = () => {
    setEditingGoal(null);
    setTitle('');
    setGoalType('weekly');
    setSubjectId('');
    setUnit('minutes');
    setTargetHoursOrValue(10); // 10 hours default
    setStartDate(todayYmd);
    setEndDate(addDaysToYmd(todayYmd, 7));
    setShowModal(true);
  };

  const openEditModal = (g: GoalItem) => {
    setEditingGoal(g);
    setTitle(g.title);
    setGoalType(g.goalType as any);
    setSubjectId(g.subjectId || '');
    setUnit(g.unit as any);
    setTargetHoursOrValue(
      g.unit === 'minutes' ? Number((g.targetValue / 60).toFixed(1)) : g.targetValue
    );
    setStartDate(g.startDate);
    setEndDate(g.endDate);
    setShowModal(true);
  };

  const handleGoalTypePreset = (
    nextType: 'daily' | 'weekly' | 'monthly' | 'subject' | 'streak' | 'sessions'
  ) => {
    setGoalType(nextType);
    if (nextType === 'daily') {
      setUnit('minutes');
      setTargetHoursOrValue(6);
      setStartDate(todayYmd);
      setEndDate(todayYmd);
    } else if (nextType === 'weekly') {
      setUnit('minutes');
      setTargetHoursOrValue(25);
      setStartDate(todayYmd);
      setEndDate(addDaysToYmd(todayYmd, 7));
    } else if (nextType === 'monthly') {
      setUnit('minutes');
      setTargetHoursOrValue(80);
      setStartDate(todayYmd);
      setEndDate(addDaysToYmd(todayYmd, 30));
    } else if (nextType === 'subject') {
      setUnit('minutes');
      setTargetHoursOrValue(10);
      setSubjectId(data.subjects[0]?.id || '');
      setStartDate(todayYmd);
      setEndDate(addDaysToYmd(todayYmd, 7));
    } else if (nextType === 'sessions') {
      setUnit('sessions');
      setTargetHoursOrValue(20);
      setStartDate(todayYmd);
      setEndDate(addDaysToYmd(todayYmd, 30));
    } else if (nextType === 'streak') {
      setUnit('days');
      setTargetHoursOrValue(30);
      setStartDate(todayYmd);
      setEndDate(addDaysToYmd(todayYmd, 30));
    }
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const finalTargetValue =
      unit === 'minutes'
        ? Math.max(15, Math.round(targetHoursOrValue * 60))
        : Math.max(1, Math.round(targetHoursOrValue));

    const payload = {
      title: title.trim(),
      goalType,
      subjectId: subjectId || null,
      targetValue: finalTargetValue,
      unit,
      startDate,
      endDate,
    };

    if (editingGoal) {
      await updateGoal(editingGoal.id, payload);
    } else {
      await createGoal(payload);
    }
    setShowModal(false);
  };

  const formatGoalMetric = (val: number, u: GoalItem['unit']) => {
    if (u === 'minutes') return formatDurationHuman(val * 60);
    if (u === 'sessions') return `${val} sessions`;
    return `${val} days`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Study Goals & Targets
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Daily, weekly, monthly, subject-specific, and consistency targets updated automatically
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['active', 'completed', 'expired'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusTab(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
                  statusTab === st
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {st} ({data.goals.filter((g) => g.status === st).length})
              </button>
            ))}
          </div>

          <Button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer h-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create Goal</span>
          </Button>
        </div>
      </div>

      {/* Goals Grid */}
      {filteredGoals.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-3 shadow-xs">
          <Target className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            No {statusTab} study goals
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Set measurable targets such as "Study 6 hours today", "Study Physics for 10 hours this week", or "Complete 20 study sessions this month".
          </p>
          {statusTab === 'active' && (
            <Button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer h-auto"
            >
              Set Your First Goal
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredGoals.map((goal) => {
            const subj = goal.subjectId ? subjectMap.get(goal.subjectId) : null;
            const pct = Math.min(
              100,
              Math.round((goal.currentValue / Math.max(1, goal.targetValue)) * 100)
            );

            return (
              <div
                key={goal.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 capitalize">
                        <span>{goal.goalType} Goal</span>
                        {subj && (
                          <>
                            <span>·</span>
                            <span
                              className="font-semibold"
                              style={{ color: subj.color }}
                            >
                              {subj.name}
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        {goal.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(goal)}
                        className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteGoal(goal.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                    Window: {goal.startDate} → {goal.endDate}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="text-slate-600 dark:text-slate-300">
                      {formatGoalMetric(goal.currentValue, goal.unit)} /{' '}
                      {formatGoalMetric(goal.targetValue, goal.unit)}
                    </span>
                    <span
                      className={`font-bold ${
                        goal.status === 'completed'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        goal.status === 'completed'
                          ? 'bg-emerald-600'
                          : 'bg-blue-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {goal.status === 'completed' && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 pt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Target Achieved!</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Goal Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {editingGoal ? 'Edit Study Goal' : 'Create Study Goal'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Goal Category
                </label>
                <select
                  value={goalType}
                  onChange={(e) => handleGoalTypePreset(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="daily">Daily Study Goal</option>
                  <option value="weekly">Weekly Study Goal</option>
                  <option value="monthly">Monthly Study Goal</option>
                  <option value="subject">Subject-Specific Goal</option>
                  <option value="sessions">Session Count Goal</option>
                  <option value="streak">Consistency Streak Goal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Goal Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Study Physics for 10 hours this week"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Metric Unit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="minutes">Study Hours</option>
                    <option value="sessions">Completed Sessions</option>
                    <option value="days">Consecutive Streak Days</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Target {unit === 'minutes' ? '(Hours)' : unit === 'sessions' ? '(Sessions)' : '(Days)'}
                  </label>
                  <input
                    type="number"
                    step={unit === 'minutes' ? '0.5' : '1'}
                    min={0.5}
                    required
                    value={targetHoursOrValue}
                    onChange={(e) => setTargetHoursOrValue(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Filter by Subject (Optional)
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  <option value="">All Subjects Combined</option>
                  {data.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
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
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer h-auto"
                >
                  Save Goal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
