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
import { completePomodoroPhaseAction } from '../actions/timer';
import { getClientDeviceId } from '../hooks/useRealtimeSync';
import { useAndroidBridge } from '../hooks/useAndroidBridge';

export interface TimerContextValue {
  activeTimer: ActiveTimerSession | null;
  timerElapsedSeconds: number;
  timerRemainingSeconds: number;
  timerTotalFocusSeconds: number;
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

  const {
    isNativeApp,
    startForegroundTimer,
    pauseForegroundTimer,
    resumeForegroundTimer,
    stopForegroundTimer,
    skipPomodoroPhase: skipPomodoroPhaseBridge,
    subscribe,
  } = useAndroidBridge();

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

  const computeTotalFocusSeconds = useCallback(
    (timer: ActiveTimerSession | null): number => {
      if (!timer) return 0;
      if (timer.mode === 'stopwatch') {
        return computeElapsedSeconds(timer);
      }
      const accumulatedCycle = timer.totalFocusSeconds || 0;
      if (timer.phase === 'focus') {
        return Math.max(0, accumulatedCycle + computeElapsedSeconds(timer));
      }
      // During break (short_break or long_break):
      // Return accumulated focus time from completed focus intervals. Break time is NEVER counted towards study time.
      return Math.max(0, accumulatedCycle);
    },
    [computeElapsedSeconds]
  );

  const timerTotalFocusSeconds = useMemo(() => {
    return computeTotalFocusSeconds(activeTimer);
  }, [activeTimer, computeTotalFocusSeconds, timerElapsedSeconds]);

  // Offline recovery queue processor: automatically sync queued study sessions on startup, login, and when coming online
  useEffect(() => {
    if (!user) return;

    const syncOfflineStudySessions = async () => {
      if (typeof window === 'undefined') return;
      const queueKey = 'sp_unsaved_study_sessions';
      try {
        const rawQueue = localStorage.getItem(queueKey);
        if (!rawQueue) return;
        const queue = JSON.parse(rawQueue);
        if (!Array.isArray(queue) || queue.length === 0) return;

        const remaining = [];
        let syncedCount = 0;
        for (const item of queue) {
          try {
            const { queuedAt, error, attempts = 0, ...sessionPayload } = item;
            const res = await createStudySessionAction(sessionPayload);
            if (res && res.success) {
              syncedCount++;
            } else {
              remaining.push({ ...item, attempts: attempts + 1 });
            }
          } catch (syncErr: any) {
            const errMsg = syncErr?.message || '';
            // If the subject does not exist or access is permanently denied, drop from queue after 3 retries
            if (errMsg.includes('does not exist') || errMsg.includes('access denied') || (item.attempts && item.attempts >= 3)) {
              console.error('Dropping unrecoverable offline session:', item, errMsg);
            } else {
              remaining.push({ ...item, attempts: (item.attempts || 0) + 1 });
            }
          }
        }

        if (remaining.length > 0) {
          localStorage.setItem(queueKey, JSON.stringify(remaining));
        } else {
          localStorage.removeItem(queueKey);
        }

        if (syncedCount > 0) {
          addToast({
            title: 'Offline Sessions Synced',
            description: `Successfully uploaded ${syncedCount} study session(s).`,
            variant: 'success',
          });
          await refreshWorkspace();
        }
      } catch (err) {
        console.error('Failed to sync offline sessions:', err);
      }
    };

    syncOfflineStudySessions();
    window.addEventListener('online', syncOfflineStudySessions);
    return () => window.removeEventListener('online', syncOfflineStudySessions);
  }, [user, addToast, refreshWorkspace]);

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
          const deviceId = getClientDeviceId();
          const res = await completePomodoroPhaseAction({
            idempotencyKey: activeTimer.idempotencyKey,
            completedPhase: activeTimer.phase as any,
            completedPomodoros: activeTimer.completedPomodoros,
            clientDeviceId: deviceId,
          });

          if (res?.success && res.timer) {
            if (user && typeof window !== 'undefined') {
              localStorage.setItem(`scholarpulse_timer_${user.uid}`, JSON.stringify(res.timer));
            }

            if (!res.alreadyTransitioned) {
              const prefs = data?.notificationPreferences;
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
                addToast({
                  title: res.timer.phase === 'long_break' ? 'Long Break Started' : 'Short Break Started',
                  description: `Rest for ${Math.round(res.timer.targetDurationSeconds / 60)} minutes.`,
                  variant: 'default',
                });
              } else {
                if (prefs?.soundChimesEnabled !== false) {
                  playTimerChime('break_end');
                }
                if (prefs?.browserNotificationsEnabled) {
                  sendBrowserNotification(
                    'Break Finished!',
                    `Ready to jump back into "${activeTimer.topic}"?`
                  );
                }
                addToast({
                  title: 'Break Finished',
                  description: 'Next focus interval started.',
                  variant: 'default',
                });
              }
              await refreshWorkspace();
            }
          }
        } catch (err) {
          console.error('completePomodoroPhase error:', err);
        } finally {
          pomodoroTransitionLock.current = false;
        }
      };

      handlePhaseComplete();
    }
  }, [
    activeTimer,
    timerElapsedSeconds,
    user,
    data?.notificationPreferences,
    data?.profile,
    refreshWorkspace,
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
        totalFocusSeconds: 0,
        targetDurationSeconds: targetDuration,
        completedPomodoros: 0,
        stateVersion: 1,
        clientDeviceId: deviceId,
        idempotencyKey,
      };

      await persistActiveTimer(newTimer);

      if (isNativeApp) {
        try {
          await startForegroundTimer({
            subjectId: newTimer.subjectId,
            topic: newTimer.topic,
            notes: newTimer.notes,
            mode: newTimer.mode,
            targetDurationSeconds: newTimer.targetDurationSeconds,
            idempotencyKey: newTimer.idempotencyKey,
          });
        } catch (bridgeErr) {
          console.warn('[TimerContext] Failed to start native foreground timer:', bridgeErr);
        }
      }

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
      isNativeApp,
      startForegroundTimer,
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

    if (isNativeApp) {
      try {
        await pauseForegroundTimer();
      } catch (bridgeErr) {
        console.warn('[TimerContext] Failed to pause native foreground timer:', bridgeErr);
      }
    }
  }, [activeTimer, computeElapsedSeconds, persistActiveTimer, isNativeApp, pauseForegroundTimer]);

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

    if (isNativeApp) {
      try {
        await resumeForegroundTimer();
      } catch (bridgeErr) {
        console.warn('[TimerContext] Failed to resume native foreground timer:', bridgeErr);
      }
    }
  }, [activeTimer, persistActiveTimer, isNativeApp, resumeForegroundTimer]);

  const finishTimerSession = useCallback(
    async (opts?: {
      productivityRating?: number;
      notes?: string;
    }): Promise<StudySession | null> => {
      if (!activeTimer) return null;

      const finalDurationSeconds = computeTotalFocusSeconds(activeTimer);
      if (finalDurationSeconds < 30) {
        addToast({
          title: 'Session Discarded',
          description: 'Sessions shorter than 30 seconds are not saved.',
          variant: 'default',
        });
        await persistActiveTimer(null);
        if (isNativeApp) {
          try {
            await stopForegroundTimer({ discard: true });
          } catch (bridgeErr) {
            console.warn('[TimerContext] Failed to stop native timer (discard):', bridgeErr);
          }
        }
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
        clientDeviceId: getClientDeviceId(),
      };

      try {
        const res = await createStudySessionAction(payload);
        await persistActiveTimer(null);

        if (isNativeApp) {
          try {
            await stopForegroundTimer({
              productivityRating: payload.productivityRating,
              notes: payload.notes,
              discard: false,
            });
          } catch (bridgeErr) {
            console.warn('[TimerContext] Failed to stop native timer:', bridgeErr);
          }
        }

        if (data?.notificationPreferences?.soundChimesEnabled !== false) {
          playTimerChime('focus_end');
        }

        addToast({
          title: 'Study Session Saved',
          description: `Recorded ${Math.max(1, Math.round(finalDurationSeconds / 60))} minutes of study.`,
          variant: 'success',
        });

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
        console.error('Failed to persist study session over network:', err);
        let queueSaved = false;
        try {
          const queueKey = 'sp_unsaved_study_sessions';
          const rawQueue = localStorage.getItem(queueKey);
          const queue = rawQueue ? JSON.parse(rawQueue) : [];
          queue.push({
            ...payload,
            queuedAt: new Date().toISOString(),
            error: err.message || 'Network error',
          });
          localStorage.setItem(queueKey, JSON.stringify(queue));
          queueSaved = true;
        } catch (queueErr) {
          console.error('Failed to write to sp_unsaved_study_sessions:', queueErr);
        }

        if (queueSaved) {
          await persistActiveTimer(null);
          if (isNativeApp) {
            try {
              await stopForegroundTimer({
                productivityRating: payload.productivityRating,
                notes: payload.notes,
                discard: false,
              });
            } catch (bridgeErr) {
              console.warn('[TimerContext] Failed to stop native timer on offline save:', bridgeErr);
            }
          }
          addToast({
            title: 'Session Saved to Offline Queue',
            description: 'Network issue detected. Session saved locally on device and will sync automatically.',
            variant: 'default',
          });
        } else {
          // If queue saving failed, DO NOT wipe active timer! Retain it and alert the user so study time is never lost
          addToast({
            title: 'Failed to Save Study Session',
            description: 'Network and offline storage both failed. Your timer has been kept active so you can retry.',
            variant: 'error',
          });
        }
        return null;
      }
    },
    [
      activeTimer,
      computeTotalFocusSeconds,
      persistActiveTimer,
      refreshWorkspace,
      data?.notificationPreferences?.soundChimesEnabled,
      addToast,
      isNativeApp,
      stopForegroundTimer,
    ]
  );

  const resetTimer = useCallback(async () => {
    dismissRecoveredNotice();
    await persistActiveTimer(null);
    if (isNativeApp) {
      try {
        await stopForegroundTimer({ discard: true });
      } catch (bridgeErr) {
        console.warn('[TimerContext] Failed to stop native timer on reset:', bridgeErr);
      }
    }
    addToast({
      title: 'Timer Reset',
      description: 'Unfinished timer session was discarded.',
      variant: 'default',
    });
  }, [dismissRecoveredNotice, persistActiveTimer, addToast, isNativeApp, stopForegroundTimer]);

  const skipPomodoroPhase = useCallback(async () => {
    if (!activeTimer || activeTimer.mode !== 'pomodoro') return;
    const profile = data?.profile;
    const focusMins = profile?.pomodoroFocusMinutes || 25;
    const shortBreakMins = profile?.pomodoroShortBreakMinutes || 5;
    const nowIso = new Date().toISOString();

    if (activeTimer.phase === 'focus') {
      const currentFocusElapsed = computeElapsedSeconds(activeTimer);
      const nextTotalFocusSeconds = (activeTimer.totalFocusSeconds || 0) + currentFocusElapsed;
      const nextTimer: ActiveTimerSession = {
        ...activeTimer,
        phase: 'short_break',
        status: 'running',
        startedAt: nowIso,
        lastResumedAt: nowIso,
        accumulatedSeconds: 0,
        totalFocusSeconds: nextTotalFocusSeconds,
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
        totalFocusSeconds: activeTimer.totalFocusSeconds || 0,
        targetDurationSeconds: focusMins * 60,
        stateVersion: (activeTimer.stateVersion || 1) + 1,
      };
      await persistActiveTimer(nextTimer);
    }

    if (isNativeApp) {
      try {
        await skipPomodoroPhaseBridge();
      } catch (bridgeErr) {
        console.warn('[TimerContext] Failed to skip native pomodoro phase:', bridgeErr);
      }
    }
  }, [
    activeTimer,
    data?.profile,
    computeElapsedSeconds,
    persistActiveTimer,
    isNativeApp,
    skipPomodoroPhaseBridge,
  ]);

  // Keep refs fresh so listeners never close over stale handlers
  const pauseTimerRef = useRef(pauseTimer);
  const resumeTimerRef = useRef(resumeTimer);
  const finishTimerSessionRef = useRef(finishTimerSession);
  const skipPomodoroPhaseRef = useRef(skipPomodoroPhase);

  useEffect(() => {
    pauseTimerRef.current = pauseTimer;
    resumeTimerRef.current = resumeTimer;
    finishTimerSessionRef.current = finishTimerSession;
    skipPomodoroPhaseRef.current = skipPomodoroPhase;
  });

  // Native notification action listener (lock-screen notification actions: pause, resume, stop, skip)
  useEffect(() => {
    if (!isNativeApp) return;

    const unsubscribe = subscribe<{ action: string; source?: string }>(
      'timer.actionTriggered',
      (payload) => {
        const action = payload?.action;
        if (action === 'pause') {
          pauseTimerRef.current();
        } else if (action === 'resume') {
          resumeTimerRef.current();
        } else if (action === 'stop' || action === 'finish') {
          finishTimerSessionRef.current();
        } else if (action === 'skipPhase' || action === 'skip_break') {
          skipPomodoroPhaseRef.current();
        }
      }
    );

    return unsubscribe;
  }, [isNativeApp, subscribe]);

  // Synchronize elapsed seconds when Android foreground service emits high-precision ticks
  useEffect(() => {
    if (!isNativeApp) return;

    const unsubscribe = subscribe<{ elapsedSeconds: number }>(
      'timer.tick',
      (payload) => {
        if (typeof payload?.elapsedSeconds === 'number' && payload.elapsedSeconds >= 0) {
          setTimerElapsedSeconds(payload.elapsedSeconds);
        }
      }
    );

    return unsubscribe;
  }, [isNativeApp, subscribe]);

  // Cross-device sync: reconcile native Android notification when activeTimer changes from web/desktop
  useEffect(() => {
    if (!isNativeApp) return;
    if (!activeTimer) {
      // If timer was saved or reset on the web, dismiss the native Android notification
      stopForegroundTimer({ discard: false }).catch(() => {});
      return;
    }
    if (activeTimer.status === 'paused') {
      // If paused on web/desktop, pause the native notification
      pauseForegroundTimer().catch(() => {});
    } else if (activeTimer.status === 'running') {
      // If running (started on web or resumed on web), ensure native notification is active
      startForegroundTimer({
        subjectId: activeTimer.subjectId,
        topic: activeTimer.topic,
        notes: activeTimer.notes,
        mode: activeTimer.mode,
        targetDurationSeconds: activeTimer.targetDurationSeconds,
        idempotencyKey: activeTimer.idempotencyKey,
      }).catch(() => {});
    }
  }, [
    isNativeApp,
    activeTimer?.status,
    activeTimer?.idempotencyKey,
    activeTimer?.subjectId,
    activeTimer?.topic,
    activeTimer?.notes,
    activeTimer?.mode,
    activeTimer?.targetDurationSeconds,
    startForegroundTimer,
    pauseForegroundTimer,
    stopForegroundTimer,
  ]);

  const value = useMemo(
    () => ({
      activeTimer,
      timerElapsedSeconds,
      timerRemainingSeconds,
      timerTotalFocusSeconds,
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
      timerTotalFocusSeconds,
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
