'use server';

import { getCurrentUser } from '@/lib/auth';
import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from '@/lib/db/repository';
import { ScheduleSchema } from '@/lib/validations';
import { publishSyncEvent } from '@/lib/realtime';
import { revalidatePath } from 'next/cache';

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

export async function createScheduleAction(raw: unknown) {
  const user = await requireUser();
  const parsed = ScheduleSchema.parse(raw);
  const clientDeviceId = (raw as any)?.clientDeviceId;
  const schedule = await createSchedule(user.uid, parsed);

  if (schedule) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'schedule:create',
      payload: { schedule },
      clientDeviceId,
    });
  }

  revalidatePath('/');
  return { success: true, schedule };
}

export async function updateScheduleAction(id: string, raw: unknown) {
  const user = await requireUser();
  const parsed = ScheduleSchema.partial().parse(raw);
  const clientDeviceId = (raw as any)?.clientDeviceId;
  const schedule = await updateSchedule(user.uid, id, parsed);

  if (schedule) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'schedule:update',
      payload: { schedule },
      clientDeviceId,
    });
  }

  revalidatePath('/');
  return { success: true, schedule };
}

export async function deleteScheduleAction(id: string, clientDeviceId?: string) {
  const user = await requireUser();
  await deleteSchedule(user.uid, id);

  await publishSyncEvent({
    userId: user.uid,
    eventType: 'schedule:delete',
    payload: { scheduleId: id },
    clientDeviceId,
  });

  revalidatePath('/');
  return { success: true };
}
