'use client';

import React from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTimer } from '@/context/TimerContext';
import { formatDigitalClock } from '@/lib/timezone';
import { Pause, Play, Square, Maximize2, Timer } from 'lucide-react';
import { AmbientNoiseMixer } from './AmbientNoiseMixer';

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
      ? 'Focus'
      : activeTimer.phase === 'short_break'
      ? 'Short Break'
      : 'Long Break';

  return (
    <div
      role="region"
      aria-label="Active floating study timer"
      data-testid="floating-mini-timer"
      className="fixed bottom-20 left-2 right-2 sm:bottom-4 sm:left-auto sm:right-4 z-40 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white border border-slate-700/80 rounded-2xl px-2.5 sm:px-4 py-2 sm:py-3 shadow-xl flex items-center justify-between sm:justify-start gap-2 sm:gap-4 max-w-md animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1 sm:flex-initial">
        <div
          className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 shadow-xs"
          style={{ backgroundColor: subject?.color || '#2563EB' }}
        >
          <Timer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] text-slate-300 leading-tight min-w-0">
            <span
              data-testid="floating-timer-subject"
              className="font-medium truncate min-w-0"
            >
              {subject?.name || 'Study'}
            </span>
            <span className="text-slate-500 shrink-0">·</span>
            <span
              data-testid="floating-timer-phase"
              className="text-blue-300 whitespace-nowrap shrink-0"
            >
              {phaseLabel}
            </span>
          </div>
          <div
            data-testid="floating-timer-digits"
            className="font-mono tabular-nums text-[15px] sm:text-lg font-bold tracking-tight text-white leading-tight"
          >
            {formatDigitalClock(displaySeconds, displaySeconds >= 3600)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <AmbientNoiseMixer compact />

        {activeTimer.status === 'running' ? (
          <button
            type="button"
            onClick={pauseTimer}
            title="Pause Timer"
            aria-label="Pause Timer"
            data-testid="floating-timer-pause"
            className="p-1.5 sm:p-2 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-amber-300 transition-colors cursor-pointer"
          >
            <Pause className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={resumeTimer}
            title="Resume Timer"
            aria-label="Resume Timer"
            data-testid="floating-timer-resume"
            className="p-1.5 sm:p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer shadow-xs"
          >
            <Play className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={() => finishTimerSession()}
          title="Finish & Save Session"
          aria-label="Finish and Save Session"
          data-testid="floating-timer-finish"
          className="p-1.5 sm:p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-xs"
        >
          <Square className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('timer')}
          title="Open Full Timer View"
          aria-label="Open Full Timer View"
          data-testid="floating-timer-expand"
          className="p-1.5 sm:p-2 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
export default FloatingMiniTimer;
