'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  Calendar,
  Clock,
  Flame,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  X,
  Target,
} from 'lucide-react';

interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

export function ExamCountdownAndBurndown() {
  const { data, revisionData, fetchRevisionWorkspace, updateExamTarget } = useWorkspace();
  const [editModalOpen, setEditModalOpen] = useState(false);

  const profile = data?.profile;
  const targetExamName = profile?.targetExamName || 'HSC 2026';
  const targetExamDate = profile?.targetExamDate || '2026-06-15';

  const [formExamName, setFormExamName] = useState(targetExamName);
  const [formExamDate, setFormExamDate] = useState(targetExamDate);
  const [saving, setSaving] = useState(false);

  // Load revision data if not present
  useEffect(() => {
    if (!revisionData) {
      fetchRevisionWorkspace();
    }
  }, [revisionData, fetchRevisionWorkspace]);

  // Live Countdown Ticker
  const [countdown, setCountdown] = useState<CountdownState>(() => calculateTimeLeft(targetExamDate));

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(calculateTimeLeft(targetExamDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [targetExamDate]);

  function calculateTimeLeft(targetYmd: string): CountdownState {
    const target = new Date(`${targetYmd}T09:00:00`);
    const now = new Date();
    const diff = target.getTime() - now.getTime();

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return { days, hours, minutes, seconds, isPast: false };
  }

  // Mathematical Burndown Projection
  const burndown = useMemo(() => {
    if (!revisionData || !revisionData.topics || revisionData.topics.length === 0) {
      return null;
    }

    const allTopics = revisionData.topics;
    const allRecords = revisionData.records;

    const totalTopics = allTopics.length;
    // A topic is considered started/revised if it has at least one completed record
    const completedTopicIds = new Set(
      allRecords.filter((r) => r.isCompleted).map((r) => r.topicId)
    );
    const completedCount = completedTopicIds.size;
    const remainingCount = Math.max(0, totalTopics - completedCount);
    const completionPct = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0;

    // Calculate daily velocity based on unique topics completed in the last 14 days
    const now = new Date();
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(now.getDate() - 14);

    const recentRecords = allRecords.filter((r) => {
      if (!r.isCompleted || !r.activityDate) return false;
      const act = new Date(r.activityDate);
      return act >= fourteenDaysAgo && act <= now;
    });

    const recentTopicCount = new Set(recentRecords.map((r) => r.topicId)).size;
    const dailyVelocity = Math.max(0.1, Number((recentTopicCount / 14).toFixed(2))); // minimum velocity fallback

    const daysNeeded = Math.ceil(remainingCount / dailyVelocity);

    const projectedFinishDate = new Date();
    projectedFinishDate.setDate(now.getDate() + daysNeeded);

    const examDateObj = new Date(`${targetExamDate}T09:00:00`);
    const daysUntilExam = Math.max(0, Math.ceil((examDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    const daysBuffer = daysUntilExam - daysNeeded;
    const isAhead = daysBuffer >= 0;

    const requiredVelocity = daysUntilExam > 0 ? Number((remainingCount / daysUntilExam).toFixed(2)) : 0;

    return {
      totalTopics,
      completedCount,
      remainingCount,
      completionPct,
      dailyVelocity,
      daysNeeded,
      daysUntilExam,
      daysBuffer,
      isAhead,
      requiredVelocity,
      projectedDateStr: projectedFinishDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    };
  }, [revisionData, targetExamDate]);

  const handleSaveExamTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formExamName.trim() || !formExamDate) return;
    setSaving(true);
    try {
      await updateExamTarget(formExamName.trim(), formExamDate);
      setEditModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {targetExamName}
              </h3>
              <button
                onClick={() => {
                  setFormExamName(targetExamName);
                  setFormExamDate(targetExamDate);
                  setEditModalOpen(true);
                }}
                className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-1 rounded-md transition-colors"
                title="Edit Target Exam & Date"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Target Exam Date: {new Date(targetExamDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Status Chip */}
        {burndown && (
          <div
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 ${
              burndown.isAhead
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
            }`}
          >
            {burndown.isAhead ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>On Track (+{burndown.daysBuffer}d buffer)</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Pace Warning ({burndown.requiredVelocity} ch/day req)</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Live Countdown Clock */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 text-center">
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
          <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-slate-100">
            {countdown.days}
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Days</div>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
          <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-slate-100">
            {String(countdown.hours).padStart(2, '0')}
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hours</div>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
          <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-slate-100">
            {String(countdown.minutes).padStart(2, '0')}
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mins</div>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
          <div className="text-xl sm:text-2xl font-black font-mono text-rose-600 dark:text-rose-400 animate-pulse">
            {String(countdown.seconds).padStart(2, '0')}
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Secs</div>
        </div>
      </div>

      {/* Burndown Forecaster Progress Bar & Insights */}
      {burndown && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Syllabus Burndown Progress</span>
            </span>
            <span className="font-mono text-slate-500">
              {burndown.completedCount} / {burndown.totalTopics} chapters ({burndown.completionPct}%)
            </span>
          </div>

          <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                burndown.isAhead
                  ? 'bg-gradient-to-r from-blue-600 to-emerald-500'
                  : 'bg-gradient-to-r from-blue-600 to-amber-500'
              }`}
              style={{ width: `${burndown.completionPct}%` }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400">
              Current Velocity: <strong className="text-slate-800 dark:text-slate-200">{burndown.dailyVelocity} chapters/day</strong>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400">
              Projected Finish: <strong className="text-slate-800 dark:text-slate-200">{burndown.projectedDateStr}</strong> ({burndown.daysNeeded} days needed)
            </div>
          </div>
        </div>
      )}

      {/* Edit Target Exam Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <form
            onSubmit={handleSaveExamTarget}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Configure Target Exam
              </h4>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Exam Name / Milestone
                </label>
                <input
                  type="text"
                  value={formExamName}
                  onChange={(e) => setFormExamName(e.target.value)}
                  placeholder="e.g. HSC 2026, Admission Exam"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Target Exam Date
                </label>
                <input
                  type="date"
                  value={formExamDate}
                  onChange={(e) => setFormExamDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                {saving ? 'Saving...' : 'Save Target'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
