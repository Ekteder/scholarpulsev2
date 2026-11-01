'use server';

import { getCurrentUser } from '@/lib/auth';
import {
  createGoal,
  updateGoal,
  deleteGoal,
} from '@/lib/db/repository';
import { GoalSchema } from '@/lib/validations';
import { publishSyncEvent } from '@/lib/realtime';
import { revalidatePath } from 'next/cache';

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

export async function createGoalAction(raw: unknown) {
  const user = await requireUser();
  const parsed = GoalSchema.parse(raw);
  const clientDeviceId = (raw as any)?.clientDeviceId;
  const goal = await createGoal(user.uid, parsed);

  if (goal) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'goal:create',
      payload: { goal },
      clientDeviceId,
    });
  }

  revalidatePath('/');
  return { success: true, goal };
}

export async function updateGoalAction(id: string, raw: unknown) {
  const user = await requireUser();
  const parsed = GoalSchema.partial().parse(raw);
  const clientDeviceId = (raw as any)?.clientDeviceId;
  const goal = await updateGoal(user.uid, id, parsed);

  if (goal) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'goal:update',
      payload: { goal },
      clientDeviceId,
    });
  }

  revalidatePath('/');
  return { success: true, goal };
}

export async function deleteGoalAction(id: string, clientDeviceId?: string) {
  const user = await requireUser();
  await deleteGoal(user.uid, id);

  await publishSyncEvent({
    userId: user.uid,
    eventType: 'goal:delete',
    payload: { goalId: id },
    clientDeviceId,
  });

  revalidatePath('/');
  return { success: true };
}
