'use server';

import { getCurrentUser } from '@/lib/auth';
import {
  createGoal,
  updateGoal,
  deleteGoal,
} from '@/lib/db/repository';
import { GoalSchema } from '@/lib/validations';
import { revalidatePath } from 'next/cache';

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

export async function createGoalAction(raw: unknown) {
  const user = await requireUser();
  const parsed = GoalSchema.parse(raw);
  const goal = await createGoal(user.uid, parsed);
  revalidatePath('/');
  return { success: true, goal };
}

export async function updateGoalAction(id: string, raw: unknown) {
  const user = await requireUser();
  const parsed = GoalSchema.partial().parse(raw);
  const goal = await updateGoal(user.uid, id, parsed);
  revalidatePath('/');
  return { success: true, goal };
}

export async function deleteGoalAction(id: string) {
  const user = await requireUser();
  await deleteGoal(user.uid, id);
  revalidatePath('/');
  return { success: true };
}
