'use server';

import { getCurrentUser } from '@/lib/auth';
import {
  getUserActiveTimer,
  upsertActiveTimer,
  deleteActiveTimer,
} from '@/lib/db/repository';
import { ActiveTimerSyncSchema } from '@/lib/validations';
import { publishSyncEvent } from '@/lib/realtime';

async function requireUser() {
  const user = await getCurrentUser();
  if (!user || user.isBanned) throw new Error(user?.isBanned ? 'Account is banned' : 'Unauthorized');
  return user;
}

export async function getActiveTimerAction() {
  const user = await requireUser();
  const timer = await getUserActiveTimer(user.uid);
  return { success: true, timer };
}

export async function syncActiveTimerAction(raw: unknown) {
  const user = await requireUser();
  const parsed = ActiveTimerSyncSchema.parse(raw);
  const result = await upsertActiveTimer(user.uid, {
    ...parsed,
    startedAt: new Date(parsed.startedAt),
    lastResumedAt: new Date(parsed.lastResumedAt),
  });

  if (result.timer) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'timer:update',
      payload: { timer: result.timer },
      clientDeviceId: parsed.clientDeviceId,
    });

    // Fan out to Android native TimerForegroundService via high-priority data push
    try {
      const { sendMulticastFCM } = await import('@/lib/fcm');
      const action = result.timer.status === 'paused' ? 'PAUSE' : 'RESUME';
      await sendMulticastFCM(user.uid, {
        title: '',
        body: '',
        priority: 'high',
        channelId: 'scholarpulse_timer_channel',
        data: {
          type: 'timer_state',
          action,
          accumulatedSeconds: String(result.timer.accumulatedSeconds || 0),
          updatedAt: String(Date.now()),
          originDeviceId: parsed.clientDeviceId || '',
          userId: user.uid,
        },
      });
    } catch (fcmErr) {
      console.warn('Failed to fan out timer update to FCM:', fcmErr);
    }
  }

  return { success: true, ...result };
}

export async function deleteActiveTimerAction(clientDeviceId?: string) {
  const user = await requireUser();
  await deleteActiveTimer(user.uid);

  await publishSyncEvent({
    userId: user.uid,
    eventType: 'timer:delete',
    payload: {},
    clientDeviceId,
  });

  // Fan out STOP to Android native TimerForegroundService
  try {
    const { sendMulticastFCM } = await import('@/lib/fcm');
    await sendMulticastFCM(user.uid, {
      title: '',
      body: '',
      priority: 'high',
      channelId: 'scholarpulse_timer_channel',
      data: {
        type: 'timer_state',
        action: 'STOP',
        updatedAt: String(Date.now()),
        originDeviceId: clientDeviceId || '',
        userId: user.uid,
      },
    });
  } catch (fcmErr) {
    console.warn('Failed to fan out timer stop to FCM:', fcmErr);
  }

  return { success: true };
}

export async function completePomodoroPhaseAction({
  idempotencyKey,
  completedPhase,
  completedPomodoros,
  clientDeviceId,
}: {
  idempotencyKey: string;
  completedPhase: 'focus' | 'short_break' | 'long_break';
  completedPomodoros: number;
  clientDeviceId?: string;
}) {
  const user = await requireUser();
  const current = await getUserActiveTimer(user.uid);
  if (!current) {
    return { success: false, reason: 'no_active_timer' as const };
  }

  // Concurrency check: if another device already transitioned this timer, gracefully return current timer
  if (
    current.idempotencyKey !== idempotencyKey ||
    current.phase !== completedPhase ||
    current.completedPomodoros !== completedPomodoros
  ) {
    return {
      success: true,
      alreadyTransitioned: true,
      timer: current,
    };
  }

  // Fetch profile for intervals
  const { db } = await import('@/lib/db');
  const { profiles } = await import('@/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, user.uid));

  const focusMins = profile?.pomodoroFocusMinutes || 25;
  const shortBreakMins = profile?.pomodoroShortBreakMinutes || 5;
  const longBreakMins = profile?.pomodoroLongBreakMinutes || 15;
  const longBreakInterval = profile?.pomodoroLongBreakInterval || 4;

  const now = new Date();
  let nextPhase: 'focus' | 'short_break' | 'long_break';
  let nextCompletedPomodoros = current.completedPomodoros;
  let nextTargetDuration = focusMins * 60;
  let nextTotalFocusSeconds = current.totalFocusSeconds || 0;

  if (completedPhase === 'focus') {
    // Accumulate completed focus duration into totalFocusSeconds across this pomodoro cycle
    nextTotalFocusSeconds += current.targetDurationSeconds;
    nextCompletedPomodoros = completedPomodoros + 1;
    const isLongBreak = nextCompletedPomodoros % longBreakInterval === 0;
    nextPhase = isLongBreak ? 'long_break' : 'short_break';
    nextTargetDuration = (isLongBreak ? longBreakMins : shortBreakMins) * 60;
  } else {
    // Break completed -> Return to focus phase without modifying totalFocusSeconds
    nextPhase = 'focus';
    nextTargetDuration = focusMins * 60;
  }

  const updateRes = await upsertActiveTimer(user.uid, {
    subjectId: current.subjectId,
    topic: current.topic,
    notes: current.notes ?? '',
    mode: 'pomodoro',
    phase: nextPhase,
    status: 'running',
    startedAt: now,
    lastResumedAt: now,
    accumulatedSeconds: 0,
    totalFocusSeconds: nextTotalFocusSeconds,
    targetDurationSeconds: nextTargetDuration,
    completedPomodoros: nextCompletedPomodoros,
    stateVersion: (current.stateVersion || 1) + 1,
    clientDeviceId: clientDeviceId || current.clientDeviceId || '',
    idempotencyKey: current.idempotencyKey,
  });

  const nextTimer = updateRes.timer;

  if (nextTimer) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'timer:update',
      payload: { timer: nextTimer },
      clientDeviceId,
    });
  }

  return {
    success: true,
    alreadyTransitioned: false,
    timer: nextTimer,
    session: null,
  };
}

