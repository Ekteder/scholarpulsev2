'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useWorkspace } from './WorkspaceContext';
import { ActiveTimerSession, StudySession } from '../types/index';
import { playTimerChime, sendBrowserNotification } from '../lib/audio';
import { createStudySessionAction } from '../actions/sessions';

export interface TimerContextValue {
  activeTimer: ActiveTimerSession | null;
  timerElapsedSeconds: number;
  timerRemainingSeconds: number;
  recoveredSessionNotice: boolean;
  dismissRecoveredNotice: () => void;
  startTimer: (opts: {
    subjectId: string;
    topic: string;
    notes?: string;
    mode: 'stopwatch' | 'pomodoro';
  }) => Promise<void>;
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
  finishTimerSession: (opts?: {
    productivityRating?: number;
    notes?: string;
  }) => Promise<StudySession | null>;
  resetTimer: () => Promise<void>;
  skipPomodoroPhase: () => Promise<void>;
}

const TimerContext = createContext<TimerContextValue | null>(null);

function getClientDeviceId(): string {
  if (typeof window === 'undefined') return 'server_device';
  let id = localStorage.getItem('scholarpulse_device_id');
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    localStorage.setItem('scholarpulse_device_id', id);
  }
  return id;
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const {
    user,
    activeTimer,
    persistActiveTimer,
    data,
    addToast,
    refreshWorkspace,
    recoveredSessionNotice,
    dismissRecoveredNotice,
  } = useWorkspace();

  const [timerElapsedSeconds, setTimerElapsedSeconds] = useState<number>(0);
  const pomodoroTransitionLock = useRef<boolean>(false);

  const computeElapsedSeconds = useCallback((timer: ActiveTimerSession | null): number => {
    if (!timer) return 0;
    if (timer.status === 'paused') {
      return Math.max(0, timer.accumulatedSeconds);
    }
    const resumedMs = new Date(timer.lastResumedAt).getTime();
    if (isNaN(resumedMs)) return Math.max(0, timer.accumulatedSeconds);
    const deltaSeconds = Math.max(0, Math.floor((Date.now() - resumedMs) / 1000));
    return Math.max(0, timer.accumulatedSeconds + deltaSeconds);
  }, []);

  useEffect(() => {
    if (!activeTimer) {
      setTimerElapsedSeconds(0);
      return;
    }

    const updateTick = () => {
      const elapsed = computeElapsedSeconds(activeTimer);
      setTimerElapsedSeconds(elapsed);
    };

    updateTick();
    const interval = setInterval(updateTick, 1000);
    return () => clearInterval(interval);
  }, [activeTimer, computeElapsedSeconds]);

  const timerRemainingSeconds = useMemo(() => {
    if (!activeTimer || activeTimer.mode !== 'pomodoro') return 0;
    return Math.max(0, activeTimer.targetDurationSeconds - timerElapsedSeconds);
  }, [activeTimer, timerElapsedSeconds]);

  // Handle automatic Pomodoro phase completion
  useEffect(() => {
    if (
      !activeTimer ||
      activeTimer.mode !== 'pomodoro' ||
      activeTimer.status !== 'running' ||
      pomodoroTransitionLock.current
    ) {
      return;
    }

    if (timerElapsedSeconds >= activeTimer.targetDurationSeconds) {
      pomodoroTransitionLock.current = true;

      const handlePhaseComplete = async () => {
        try {
          const prefs = data?.notificationPreferences;
          const profile = data?.profile;
          const focusMins = profile?.pomodoroFocusMinutes || 25;
          const shortBreakMins = profile?.pomodoroShortBreakMinutes || 5;
          const longBreakMins = profile?.pomodoroLongBreakMinutes || 15;
          const longBreakInterval = profile?.pomodoroLongBreakInterval || 4;

          if (activeTimer.phase === 'focus') {
            if (prefs?.soundChimesEnabled !== false) {
              playTimerChime('focus_end');
            }
            if (prefs?.browserNotificationsEnabled) {
              sendBrowserNotification(
                'Pomodoro Focus Complete!',
                `Great work on "${activeTimer.topic}". Time for a rejuvenating break.`
              );
            }

            const focusDurationSec = activeTimer.targetDurationSeconds;
            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - focusDurationSec * 1000);
            const cycleIdempotencyKey = `${activeTimer.idempotencyKey}_pomo_${
              activeTimer.completedPomodoros + 1
            }`;

            // Save completed session block via Server Action
            createStudySessionAction({
              subjectId: activeTimer.subjectId,
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              durationSeconds: focusDurationSec,
              topic: activeTimer.topic,
              notes: activeTimer.notes || 'Pomodoro focus cycle completed',
              productivityRating: 5,
              sessionType: 'timer',
              idempotencyKey: cycleIdempotencyKey,
            }).catch(() => {});

            const nextCompletedCount = activeTimer.completedPomodoros + 1;
            const isLongBreak = nextCompletedCount % longBreakInterval === 0;
            const breakDurationSeconds = (isLongBreak ? longBreakMins : shortBreakMins) * 60;
            const nowIso = new Date().toISOString();

            const nextTimer: ActiveTimerSession = {
              ...activeTimer,
              phase: isLongBreak ? 'long_break' : 'short_break',
              status: 'running',
              startedAt: nowIso,
              lastResumedAt: nowIso,
              accumulatedSeconds: 0,
              targetDurationSeconds: breakDurationSeconds,
              completedPomodoros: nextCompletedCount,
              stateVersion: (activeTimer.stateVersion || 1) + 1,
            };

            await persistActiveTimer(nextTimer);
            addToast({
              title: isLongBreak ? 'Long Break Started' : 'Short Break Started',
              description: `Rest for ${Math.round(breakDurationSeconds / 60)} minutes.`,
              variant: 'default',
            });
          } else {
            // Break completed -> Transition to next focus
            if (prefs?.soundChimesEnabled !== false) {
              playTimerChime('break_end');
            }
            if (prefs?.browserNotificationsEnabled) {
              sendBrowserNotification(
                'Break Finished!',
                `Ready to jump back into "${activeTimer.topic}"?`
              );
            }

            const nowIso = new Date().toISOString();
            const nextTimer: ActiveTimerSession = {
              ...activeTimer,
              phase: 'focus',
              status: 'running',
              startedAt: nowIso,
              lastResumedAt: nowIso,
              accumulatedSeconds: 0,
              targetDurationSeconds: focusMins * 60,
              stateVersion: (activeTimer.stateVersion || 1) + 1,
            };

            await persistActiveTimer(nextTimer);
            addToast({
              title: 'Break Finished',
              description: 'Next focus interval started.',
              variant: 'default',
            });
          }
        } finally {
          pomodoroTransitionLock.current = false;
        }
      };

      handlePhaseComplete();
    }
  }, [
    activeTimer,
    timerElapsedSeconds,
    data?.notificationPreferences,
    data?.profile,
    persistActiveTimer,
    addToast,
  ]);

  const startTimer = useCallback(
    async (opts: {
      subjectId: string;
      topic: string;
      notes?: string;
      mode: 'stopwatch' | 'pomodoro';
    }) => {
      dismissRecoveredNotice();
      const profile = data?.profile;
      const targetDuration =
        opts.mode === 'pomodoro' ? (profile?.pomodoroFocusMinutes || 25) * 60 : 0;
      const nowIso = new Date().toISOString();
      const deviceId = getClientDeviceId();
      const idempotencyKey = `timer_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const newTimer: ActiveTimerSession = {
        userId: user?.uid || '',
        subjectId: opts.subjectId,
        topic: opts.topic.trim() || 'Focused Study',
        notes: opts.notes?.trim() || '',
        mode: opts.mode,
        phase: 'focus',
        status: 'running',
        startedAt: nowIso,
        lastResumedAt: nowIso,
        accumulatedSeconds: 0,
        targetDurationSeconds: targetDuration,
        completedPomodoros: 0,
        stateVersion: 1,
        clientDeviceId: deviceId,
        idempotencyKey,
      };

      await persistActiveTimer(newTimer);

      if (data?.notificationPreferences?.soundChimesEnabled !== false) {
        playTimerChime('focus_start');
      }

      addToast({
        title: opts.mode === 'pomodoro' ? 'Pomodoro Started' : 'Stopwatch Started',
        description: `Tracking session for "${newTimer.topic}".`,
        variant: 'success',
      });
    },
    [
      user,
      data?.profile,
      data?.notificationPreferences?.soundChimesEnabled,
      dismissRecoveredNotice,
      persistActiveTimer,
      addToast,
    ]
  );

  const pauseTimer = useCallback(async () => {
    if (!activeTimer || activeTimer.status !== 'running') return;
    const currentElapsed = computeElapsedSeconds(activeTimer);
    const nowIso = new Date().toISOString();

    const pausedTimer: ActiveTimerSession = {
      ...activeTimer,
      status: 'paused',
      lastResumedAt: nowIso,
      accumulatedSeconds: currentElapsed,
      stateVersion: (activeTimer.stateVersion || 1) + 1,
    };

    await persistActiveTimer(pausedTimer);
  }, [activeTimer, computeElapsedSeconds, persistActiveTimer]);

  const resumeTimer = useCallback(async () => {
    if (!activeTimer || activeTimer.status !== 'paused') return;
    const nowIso = new Date().toISOString();

    const runningTimer: ActiveTimerSession = {
      ...activeTimer,
      status: 'running',
      lastResumedAt: nowIso,
      stateVersion: (activeTimer.stateVersion || 1) + 1,
    };

    await persistActiveTimer(runningTimer);
  }, [activeTimer, persistActiveTimer]);

  const finishTimerSession = useCallback(
    async (opts?: {
      productivityRating?: number;
      notes?: string;
    }): Promise<StudySession | null> => {
      if (!activeTimer) return null;

      const finalDurationSeconds = computeElapsedSeconds(activeTimer);
      if (finalDurationSeconds < 30) {
        addToast({
          title: 'Session Discarded',
          description: 'Sessions shorter than 30 seconds are not saved.',
          variant: 'default',
        });
        await persistActiveTimer(null);
        return null;
      }

      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - finalDurationSeconds * 1000);

      const payload = {
        subjectId: activeTimer.subjectId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationSeconds: finalDurationSeconds,
        topic: activeTimer.topic,
        notes: opts?.notes !== undefined ? opts.notes : activeTimer.notes,
        productivityRating: opts?.productivityRating || 5,
        sessionType: 'timer' as const,
        idempotencyKey: `${activeTimer.idempotencyKey}_final`,
      };

      persistActiveTimer(null);

      if (data?.notificationPreferences?.soundChimesEnabled !== false) {
        playTimerChime('focus_end');
      }

      addToast({
        title: 'Study Session Saved',
        description: `Recorded ${Math.max(1, Math.round(finalDurationSeconds / 60))} minutes of study.`,
        variant: 'success',
      });

      try {
        const res = await createStudySessionAction(payload);
        if (res.success && (res as any).newlyUnlockedAchievements?.length > 0) {
          for (const achTitle of (res as any).newlyUnlockedAchievements) {
            addToast({
              title: `Achievement Unlocked: ${achTitle}`,
              description: 'New milestone earned!',
              variant: 'success',
            });
          }
        }
        await refreshWorkspace();
        return (res as any).session || null;
      } catch (err: any) {
        addToast({
          title: 'Could Not Save Session',
          description: err.message || 'Please check your connection and try again.',
          variant: 'error',
        });
        return null;
      }
    },
    [
      activeTimer,
      computeElapsedSeconds,
      persistActiveTimer,
      refreshWorkspace,
      data?.notificationPreferences?.soundChimesEnabled,
      addToast,
    ]
  );

  const resetTimer = useCallback(async () => {
    dismissRecoveredNotice();
    await persistActiveTimer(null);
    addToast({
      title: 'Timer Reset',
      description: 'Unfinished timer session was discarded.',
      variant: 'default',
    });
  }, [dismissRecoveredNotice, persistActiveTimer, addToast]);

  const skipPomodoroPhase = useCallback(async () => {
    if (!activeTimer || activeTimer.mode !== 'pomodoro') return;
    const profile = data?.profile;
    const focusMins = profile?.pomodoroFocusMinutes || 25;
    const shortBreakMins = profile?.pomodoroShortBreakMinutes || 5;
    const nowIso = new Date().toISOString();

    if (activeTimer.phase === 'focus') {
      const nextTimer: ActiveTimerSession = {
        ...activeTimer,
        phase: 'short_break',
        status: 'running',
        startedAt: nowIso,
        lastResumedAt: nowIso,
        accumulatedSeconds: 0,
        targetDurationSeconds: shortBreakMins * 60,
        stateVersion: (activeTimer.stateVersion || 1) + 1,
      };
      await persistActiveTimer(nextTimer);
    } else {
      const nextTimer: ActiveTimerSession = {
        ...activeTimer,
        phase: 'focus',
        status: 'running',
        startedAt: nowIso,
        lastResumedAt: nowIso,
        accumulatedSeconds: 0,
        targetDurationSeconds: focusMins * 60,
        stateVersion: (activeTimer.stateVersion || 1) + 1,
      };
      await persistActiveTimer(nextTimer);
    }
  }, [activeTimer, data?.profile, persistActiveTimer]);

  const value = useMemo(
    () => ({
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
    }),
    [
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
    ]
  );

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer(): TimerContextValue {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
}
