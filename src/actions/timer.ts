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
  if (!user) throw new Error('Unauthorized');
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
  const { createStudySession } = await import('@/lib/db/repository');

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, user.uid));

  const focusMins = profile?.pomodoroFocusMinutes || 25;
  const shortBreakMins = profile?.pomodoroShortBreakMinutes || 5;
  const longBreakMins = profile?.pomodoroLongBreakMinutes || 15;
  const longBreakInterval = profile?.pomodoroLongBreakInterval || 4;

  const now = new Date();
  let createdSession: any = null;
  let nextPhase: 'focus' | 'short_break' | 'long_break';
  let nextCompletedPomodoros = current.completedPomodoros;
  let nextTargetDuration = focusMins * 60;

  if (completedPhase === 'focus') {
    const focusDurationSec = current.targetDurationSeconds;
    const startTime = new Date(now.getTime() - focusDurationSec * 1000);
    const cycleIdempotencyKey = `${current.idempotencyKey}_pomo_${completedPomodoros + 1}`;

    const sessionRes = await createStudySession(user.uid, {
      subjectId: current.subjectId,
      startTime,
      endTime: now,
      topic: current.topic,
      notes: current.notes || 'Pomodoro focus cycle completed',
      productivityRating: 5,
      sessionType: 'timer',
      idempotencyKey: cycleIdempotencyKey,
    });
    createdSession = sessionRes.session;

    nextCompletedPomodoros = completedPomodoros + 1;
    const isLongBreak = nextCompletedPomodoros % longBreakInterval === 0;
    nextPhase = isLongBreak ? 'long_break' : 'short_break';
    nextTargetDuration = (isLongBreak ? longBreakMins : shortBreakMins) * 60;
  } else {
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
    targetDurationSeconds: nextTargetDuration,
    completedPomodoros: nextCompletedPomodoros,
    stateVersion: (current.stateVersion || 1) + 1,
    clientDeviceId: clientDeviceId || current.clientDeviceId || '',
    idempotencyKey: current.idempotencyKey,
  });

  const nextTimer = updateRes.timer;

  if (createdSession) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'session:create',
      payload: { session: createdSession },
      clientDeviceId,
    });
  }

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
    session: createdSession,
  };
}

