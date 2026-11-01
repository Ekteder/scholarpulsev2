'use server';

import { getCurrentUser } from '@/lib/auth';
import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from '@/lib/db/repository';
import { ScheduleSchema } from '@/lib/validations';
import { revalidatePath } from 'next/cache';

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

export async function createScheduleAction(raw: unknown) {
  const user = await requireUser();
  const parsed = ScheduleSchema.parse(raw);
  const schedule = await createSchedule(user.uid, parsed);
  revalidatePath('/');
  return { success: true, schedule };
}

export async function updateScheduleAction(id: string, raw: unknown) {
  const user = await requireUser();
  const parsed = ScheduleSchema.partial().parse(raw);
  const schedule = await updateSchedule(user.uid, id, parsed);
  revalidatePath('/');
  return { success: true, schedule };
}

export async function deleteScheduleAction(id: string) {
  const user = await requireUser();
  await deleteSchedule(user.uid, id);
  revalidatePath('/');
  return { success: true };
}
