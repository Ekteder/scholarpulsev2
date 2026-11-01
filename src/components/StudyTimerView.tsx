'use client';

import React, { useEffect, useState } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTimer } from '@/context/TimerContext';
import { formatDigitalClock, formatDurationHuman } from '@/lib/timezone';
import {
  CheckCircle2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  SkipForward,
  Square,
  Timer,
  Volume2,
  X,
} from 'lucide-react';
import { AmbientNoiseMixer } from './AmbientNoiseMixer';
import { MathRenderer, MathCheatSheetPopover } from './MathRenderer';

export function StudyTimerView() {
  const { data, updateProfile, setActiveTab } = useWorkspace();
  const {
    activeTimer,
    timerElapsedSeconds,
    timerRemainingSeconds,
    recoveredSessionNotice,
    dismissRecoveredNotice,
    startTimer,
    pauseTimer,
    resumeTimer,
    finishTimerSession,
    resetTimer,
    skipPomodoroPhase,
  } = useTimer();

  const activeSubjects = React.useMemo(
    () => (data?.subjects || []).filter((s) => !s.isArchived),
    [data?.subjects]
  );

  const [mode, setMode] = useState<'stopwatch' | 'pomodoro'>(
    activeTimer?.mode === 'stopwatch' ? 'stopwatch' : 'pomodoro'
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    activeTimer?.subjectId || activeSubjects[0]?.id || ''
  );
  const [topic, setTopic] = useState<string>(activeTimer?.topic || '');
  const [notes, setNotes] = useState<string>(activeTimer?.notes || '');

  // Pomodoro configuration modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [focusMins, setFocusMins] = useState(
    data?.profile?.pomodoroFocusMinutes || 25
  );
  const [shortBreakMins, setShortBreakMins] = useState(
    data?.profile?.pomodoroShortBreakMinutes || 5
  );
  const [longBreakMins, setLongBreakMins] = useState(
    data?.profile?.pomodoroLongBreakMinutes || 15
  );
  const [longBreakInterval, setLongBreakInterval] = useState(
    data?.profile?.pomodoroLongBreakInterval || 4
  );

  useEffect(() => {
    if (data?.profile) {
      setFocusMins(data.profile.pomodoroFocusMinutes || 25);
      setShortBreakMins(data.profile.pomodoroShortBreakMinutes || 5);
      setLongBreakMins(data.profile.pomodoroLongBreakMinutes || 15);
      setLongBreakInterval(data.profile.pomodoroLongBreakInterval || 4);
    }
  }, [data?.profile]);

  // Finish Session Summary Modal
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [finishRating, setFinishRating] = useState(5);
  const [finishNotes, setFinishNotes] = useState('');
  const [savingFinish, setSavingFinish] = useState(false);

  // Zen Mode & Screen Wake Lock
  const [isZenMode, setIsZenMode] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [zenNoiseOpen, setZenNoiseOpen] = useState(false);
  const wakeLockRef = React.useRef<any>(null);

  const requestWakeLock = React.useCallback(async () => {
    if (typeof window !== 'undefined' && 'wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        setWakeLockActive(true);
        wakeLockRef.current.addEventListener('release', () => {
          setWakeLockActive(false);
        });
      } catch (err) {
        console.warn('Screen Wake Lock request failed:', err);
      }
    }
  }, []);

  const releaseWakeLock = React.useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setWakeLockActive(false);
      } catch (err) {
        console.warn('Screen Wake Lock release failed:', err);
      }
    }
  }, []);

  const toggleZenMode = React.useCallback(async () => {
    if (!isZenMode) {
      setIsZenMode(true);
      await requestWakeLock();
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {}
    } else {
      setIsZenMode(false);
      await releaseWakeLock();
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch {}
    }
  }, [isZenMode, requestWakeLock, releaseWakeLock]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isZenMode) {
        requestWakeLock();
      }
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isZenMode) {
        setIsZenMode(false);
        releaseWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isZenMode, requestWakeLock, releaseWakeLock]);

  useEffect(() => {
    if (activeTimer) {
      setMode(activeTimer.mode === 'stopwatch' ? 'stopwatch' : 'pomodoro');
      setSelectedSubjectId(activeTimer.subjectId);
      setTopic(activeTimer.topic);
      setNotes(activeTimer.notes || '');
    } else if (!selectedSubjectId && activeSubjects.length > 0) {
      setSelectedSubjectId(activeSubjects[0].id);
    }
  }, [activeTimer, activeSubjects, selectedSubjectId]);

  const currentSubject = data?.subjects.find(
    (s) => s.id === (activeTimer?.subjectId || selectedSubjectId)
  );

  const isRunning = activeTimer?.status === 'running';
  const isPomodoro = (activeTimer?.mode || mode) === 'pomodoro';

  const displaySeconds = activeTimer
    ? activeTimer.mode === 'pomodoro'
      ? timerRemainingSeconds
      : timerElapsedSeconds
    : isPomodoro
    ? (data?.profile?.pomodoroFocusMinutes || 25) * 60
    : 0;

  const progressRatio =
    activeTimer && activeTimer.mode === 'pomodoro' && activeTimer.targetDurationSeconds > 0
      ? Math.min(1, timerElapsedSeconds / activeTimer.targetDurationSeconds)
      : 0;

  const radius = 115;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - progressRatio * circumference;

  const handleStart = React.useCallback(async () => {
    if (!selectedSubjectId) return;
    await startTimer({
      subjectId: selectedSubjectId,
      topic: topic.trim() || 'Focused Study',
      notes: notes.trim(),
      mode,
    });
  }, [selectedSubjectId, startTimer, topic, notes, mode]);

  // Global Keyboard Shortcuts for distraction-free study
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (activeTimer) {
          if (activeTimer.status === 'running') pauseTimer();
          else resumeTimer();
        } else {
          handleStart();
        }
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleZenMode();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (activeTimer) resetTimer();
      } else if (e.key === 'Escape' && isZenMode) {
        e.preventDefault();
        toggleZenMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTimer, isZenMode, toggleZenMode, pauseTimer, resumeTimer, resetTimer, handleStart]);

  const handleOpenFinishModal = () => {
    if (!activeTimer) return;
    if (activeTimer.status === 'running') {
      pauseTimer();
    }
    setFinishNotes(activeTimer.notes || notes);
    setFinishRating(5);
    setShowFinishModal(true);
  };

  const handleConfirmFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFinish(true);
    try {
      setShowFinishModal(false);
      if (isZenMode) {
        toggleZenMode();
      }
      setTopic('');
      setNotes('');
      await finishTimerSession({
        productivityRating: finishRating,
        notes: finishNotes,
      });
    } finally {
      setSavingFinish(false);
    }
  };

  const handleSavePomodoroConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      pomodoroFocusMinutes: focusMins,
      pomodoroShortBreakMinutes: shortBreakMins,
      pomodoroLongBreakMinutes: longBreakMins,
      pomodoroLongBreakInterval: longBreakInterval,
    });
    setShowConfigModal(false);
  };

  if (!data) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Recovery Notification Banner */}
      {recoveredSessionNotice && activeTimer && (
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 flex items-center justify-between gap-4 text-xs text-blue-900 dark:text-blue-200 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              <strong>Active Session Recovered:</strong> Your timer for{' '}
              <strong>&quot;{activeTimer.topic}&quot;</strong> was seamlessly restored from
              authoritative cloud timestamps without losing any focus time.
            </span>
          </div>
          <button
            type="button"
            onClick={dismissRecoveredNotice}
            className="text-blue-600 dark:text-blue-400 hover:underline shrink-0 cursor-pointer font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Distraction-Free Timer Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-8 space-y-6 sm:space-y-8 shadow-xs">
        {/* Top Mode Selector & Pomodoro Settings Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 border-b border-slate-100 dark:border-slate-800 pb-4 sm:pb-5">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full sm:w-auto">
            <button
              type="button"
              disabled={Boolean(activeTimer)}
              onClick={() => setMode('pomodoro')}
              className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed ${
                (activeTimer?.mode || mode) === 'pomodoro'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Pomodoro<span className="hidden sm:inline"> Timer</span>
            </button>
            <button
              type="button"
              disabled={Boolean(activeTimer)}
              onClick={() => setMode('stopwatch')}
              className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed ${
                (activeTimer?.mode || mode) === 'stopwatch'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Stopwatch<span className="hidden sm:inline"> Mode</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={toggleZenMode}
              className="flex-1 sm:flex-initial justify-center px-3 sm:px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-900 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-900 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="Fullscreen Zen Mode with Screen Wake Lock"
            >
              <Maximize2 className="w-3.5 h-3.5 text-blue-500" />
              <span>Zen Mode (F)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className="flex-1 sm:flex-initial justify-center px-3 sm:px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>
                <span className="sm:hidden">
                  Settings ({data.profile.pomodoroFocusMinutes}/{data.profile.pomodoroShortBreakMinutes}m)
                </span>
                <span className="hidden sm:inline">
                  Pomodoro Settings ({data.profile.pomodoroFocusMinutes}/
                  {data.profile.pomodoroShortBreakMinutes}/
                  {data.profile.pomodoroLongBreakMinutes}m)
                </span>
              </span>
            </button>
          </div>
        </div>

        {/* Center Clock Display */}
        <div className="flex flex-col items-center justify-center py-2 sm:py-4 space-y-5 sm:space-y-6">
          {isPomodoro && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 text-center">
              <span
                className={
                  !activeTimer || activeTimer.phase === 'focus'
                    ? 'text-blue-600 dark:text-blue-400 font-semibold'
                    : ''
                }
              >
                Focus ({data.profile.pomodoroFocusMinutes}m)
              </span>
              <span>·</span>
              <span
                className={
                  activeTimer?.phase === 'short_break'
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : ''
                }
              >
                Short Break ({data.profile.pomodoroShortBreakMinutes}m)
              </span>
              <span>·</span>
              <span
                className={
                  activeTimer?.phase === 'long_break'
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : ''
                }
              >
                Long Break ({data.profile.pomodoroLongBreakMinutes}m)
              </span>
              {activeTimer && (
                <>
                  <span>·</span>
                  <span className="font-mono tabular-nums">
                    Cycles: {activeTimer.completedPomodoros}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Circular Timer Ring */}
          <div className="relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
            <svg className="w-56 h-56 sm:w-64 sm:h-64 -rotate-90" viewBox="0 0 260 260">
              <circle
                cx="130"
                cy="130"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                className="text-slate-100 dark:text-slate-800"
              />
              {isPomodoro && (
                <circle
                  cx="130"
                  cy="130"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="text-blue-600 dark:text-blue-500 transition-all duration-300"
                />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
              {currentSubject && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 max-w-[200px] truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: currentSubject.color }}
                  />
                  <span className="truncate">{currentSubject.name}</span>
                </div>
              )}
              <div className="font-mono tabular-nums text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                {formatDigitalClock(displaySeconds, displaySeconds >= 3600)}
              </div>
              <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-[200px] truncate">
                {!activeTimer
                  ? 'Ready to start'
                  : activeTimer.status === 'paused'
                  ? 'Paused (not counting)'
                  : activeTimer.phase === 'focus'
                  ? 'Actively recording'
                  : 'Break interval'}
              </span>
            </div>
          </div>

          {/* Subject & Topic Inputs (When idle or editable) */}
          {!activeTimer ? (
            activeSubjects.length === 0 ? (
              <div className="text-center space-y-2">
                <p className="text-xs text-slate-500">
                  Please create at least one active subject before starting the timer.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('subjects')}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold cursor-pointer shadow-xs hover:bg-blue-700 transition-colors"
                >
                  Create Subject
                </button>
              </div>
            ) : (
              <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Select Subject
                  </label>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {activeSubjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Study Topic (Optional)
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., Chapter 4 Thermodynamics"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )
          ) : (
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {activeTimer.topic}
              </p>
              {activeTimer.notes && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  <MathRenderer content={activeTimer.notes} inline />
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Elapsed Focus Time: {formatDurationHuman(timerElapsedSeconds, true)}
              </p>
            </div>
          )}

          {/* Primary Controls */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {!activeTimer ? (
              <button
                type="button"
                disabled={activeSubjects.length === 0}
                onClick={handleStart}
                className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <Play className="w-4 h-4" />
                <span>Start Study Session</span>
              </button>
            ) : (
              <>
                {isRunning ? (
                  <button
                    type="button"
                    onClick={pauseTimer}
                    className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                  >
                    <Pause className="w-4 h-4" />
                    <span>Pause</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={resumeTimer}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                  >
                    <Play className="w-4 h-4" />
                    <span>Resume</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleOpenFinishModal}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  <Square className="w-4 h-4" />
                  <span>Finish & Save</span>
                </button>

                {isPomodoro && (
                  <button
                    type="button"
                    onClick={skipPomodoroPhase}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <SkipForward className="w-4 h-4" />
                    <span>
                      {activeTimer.phase === 'focus' ? 'Skip to Break' : 'Skip Break'}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={resetTimer}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Browser-Synthesized Ambient Noise Mixer */}
      <AmbientNoiseMixer />

      {/* FULLSCREEN AMOLED ZEN MODE VIEW */}
      {isZenMode && (
        <div className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col justify-between p-6 sm:p-10 animate-in fade-in select-none">
          {/* Zen Top Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="w-3.5 h-3.5 rounded-full animate-pulse"
                style={{ backgroundColor: currentSubject?.color || '#2563EB' }}
              />
              <div className="space-y-0.5">
                <span className="text-sm font-bold tracking-wide text-neutral-200">
                  {currentSubject?.name || 'Study Focus'}
                </span>
                {activeTimer?.topic && (
                  <p className="text-xs text-neutral-400 font-medium">
                    {activeTimer.topic}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {wakeLockActive && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-[11px] font-medium text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Screen Kept Awake</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setZenNoiseOpen(!zenNoiseOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-300 transition-colors"
                title="Ambient Sound Mixer"
              >
                <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Ambient Noise</span>
              </button>

              <button
                type="button"
                onClick={toggleZenMode}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-neutral-200 transition-colors"
                title="Exit Fullscreen Zen Mode (Esc or F)"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Exit Zen (Esc)</span>
              </button>
            </div>
          </div>

          {/* Quick Ambient Noise Drawer in Zen Mode */}
          {zenNoiseOpen && (
            <div className="max-w-md mx-auto w-full z-10 animate-in slide-in-from-top-4">
              <AmbientNoiseMixer />
            </div>
          )}

          {/* Center Giant AMOLED Clock */}
          <div className="my-auto flex flex-col items-center justify-center text-center space-y-6">
            {isPomodoro && (
              <div className="text-xs uppercase tracking-widest font-bold text-neutral-500">
                {activeTimer?.phase === 'focus' ? '🎯 Focus Session' : '☕ Break Period'}
              </div>
            )}

            <div className="font-mono text-7xl sm:text-9xl md:text-[11rem] font-bold tracking-tight text-white drop-shadow-[0_0_40px_rgba(37,99,235,0.3)]">
              {formatDigitalClock(displaySeconds, displaySeconds >= 3600)}
            </div>

            {/* Zen Mode Primary Action Controls */}
            <div className="flex items-center gap-3.5 pt-2">
              {!activeTimer ? (
                <button
                  type="button"
                  onClick={handleStart}
                  className="px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm sm:text-base flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-all active:scale-95"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Start (Space)</span>
                </button>
              ) : (
                <>
                  {isRunning ? (
                    <button
                      type="button"
                      onClick={pauseTimer}
                      className="px-8 py-3.5 rounded-2xl bg-amber-500/20 border border-amber-500/50 hover:bg-amber-500/30 text-amber-300 font-bold text-sm sm:text-base flex items-center gap-2 transition-all active:scale-95"
                    >
                      <Pause className="w-5 h-5 fill-current" />
                      <span>Pause (Space)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={resumeTimer}
                      className="px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm sm:text-base flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-all active:scale-95"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      <span>Resume (Space)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleOpenFinishModal}
                    className="px-6 py-3.5 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 hover:bg-emerald-600/30 text-emerald-300 font-semibold text-sm flex items-center gap-2 transition-all active:scale-95"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Finish</span>
                  </button>

                  <button
                    type="button"
                    onClick={resetTimer}
                    className="px-5 py-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-white font-semibold text-sm flex items-center gap-2 transition-all"
                    title="Reset Timer (R)"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reset (R)</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Bottom Shortcuts Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-500 border-t border-neutral-900/80 pt-4">
            <div className="flex items-center gap-3 text-[11px]">
              <span><kbd className="px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-300 font-mono">Space</kbd> Pause/Resume</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-300 font-mono">F</kbd> Fullscreen</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-300 font-mono">R</kbd> Reset</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-300 font-mono">Esc</kbd> Exit</span>
            </div>
            <span className="text-[11px] text-neutral-500">AMOLED True Black #000000 • Screen Sleep Disabled</span>
          </div>
        </div>
      )}

      {/* Session Summary Confirmation Modal */}
      {showFinishModal && activeTimer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="finish-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3
                id="finish-modal-title"
                className="font-display text-lg font-bold text-slate-900 dark:text-white"
              >
                Session Summary
              </h3>
              <button
                type="button"
                onClick={() => setShowFinishModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Subject:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {currentSubject?.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Topic:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {activeTimer.topic}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Verified Active Duration:</span>
                <span className="font-mono tabular-nums font-bold text-blue-600 dark:text-blue-400">
                  {formatDurationHuman(timerElapsedSeconds, true)}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmFinish} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Productivity Rating (1 – 5)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setFinishRating(rating)}
                      className={`flex-1 py-2 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                        finishRating === rating
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {rating} / 5
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Session Reflection / Study Notes
                  </label>
                  <MathCheatSheetPopover />
                </div>
                <textarea
                  rows={3}
                  value={finishNotes}
                  onChange={(e) => setFinishNotes(e.target.value)}
                  placeholder="Key takeaways, formulas covered (e.g. $E=mc^2$), or next steps..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                />
                {finishNotes && finishNotes.includes('$') && (
                  <div className="mt-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">KaTeX Formula Preview:</span>
                    <MathRenderer content={finishNotes} inline />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFinishModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Back to Timer
                </button>
                <button
                  type="submit"
                  disabled={savingFinish}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-60 shadow-xs transition-colors"
                >
                  {savingFinish ? 'Saving...' : 'Save Completed Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pomodoro Configuration Modal */}
      {showConfigModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="config-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-blue-600" />
                <h3
                  id="config-modal-title"
                  className="font-display text-base font-bold text-slate-900 dark:text-white"
                >
                  Configure Pomodoro Durations
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePomodoroConfig} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Focus Duration (mins)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={focusMins}
                    onChange={(e) => setFocusMins(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Short Break (mins)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={shortBreakMins}
                    onChange={(e) => setShortBreakMins(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Long Break (mins)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={longBreakMins}
                    onChange={(e) => setLongBreakMins(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Long Break Interval
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={longBreakInterval}
                    onChange={(e) => setLongBreakInterval(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                >
                  Save Defaults
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default StudyTimerView;
