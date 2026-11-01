'use client';

import React from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTimer } from '@/context/TimerContext';
import { formatDigitalClock } from '@/lib/timezone';
import { Pause, Play, Square, Maximize2, Timer } from 'lucide-react';

export function FloatingMiniTimer() {
  const { activeTab, setActiveTab, data } = useWorkspace();
  const {
    activeTimer,
    timerElapsedSeconds,
    timerRemainingSeconds,
    pauseTimer,
    resumeTimer,
    finishTimerSession,
  } = useTimer();

  if (!activeTimer || activeTab === 'timer') {
    return null;
  }

  const subject = data?.subjects.find((s) => s.id === activeTimer.subjectId);
  const isPomodoro = activeTimer.mode === 'pomodoro';
  const displaySeconds = isPomodoro ? timerRemainingSeconds : timerElapsedSeconds;

  const phaseLabel =
    !isPomodoro
      ? 'Stopwatch'
      : activeTimer.phase === 'focus'
      ? 'Pomodoro Focus'
      : activeTimer.phase === 'short_break'
      ? 'Short Break'
      : 'Long Break';

  return (
    <div
      role="region"
      aria-label="Active floating study timer"
      className="fixed bottom-20 left-3 right-3 sm:bottom-4 sm:left-auto sm:right-4 z-40 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white border border-slate-700/80 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 shadow-xl flex items-center justify-between sm:justify-start gap-2.5 sm:gap-4 max-w-md animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
          style={{ backgroundColor: subject?.color || '#2563EB' }}
        >
          <Timer className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
            <span className="font-medium truncate">{subject?.name || 'Study'}</span>
            <span>·</span>
            <span className="text-blue-300 whitespace-nowrap">{phaseLabel}</span>
          </div>
          <div className="font-mono tabular-nums text-lg font-bold tracking-tight text-white">
            {formatDigitalClock(displaySeconds, displaySeconds >= 3600)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {activeTimer.status === 'running' ? (
          <button
            type="button"
            onClick={pauseTimer}
            title="Pause Timer"
            aria-label="Pause Timer"
            className="p-2 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-amber-300 transition-colors cursor-pointer"
          >
            <Pause className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={resumeTimer}
            title="Resume Timer"
            aria-label="Resume Timer"
            className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer shadow-xs"
          >
            <Play className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={() => finishTimerSession()}
          title="Finish & Save Session"
          aria-label="Finish and Save Session"
          className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-xs"
        >
          <Square className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('timer')}
          title="Open Full Timer View"
          aria-label="Open Full Timer View"
          className="p-2 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
export default FloatingMiniTimer;
