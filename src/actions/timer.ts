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
