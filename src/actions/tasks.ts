'use server';

import { getCurrentUser } from '@/lib/auth';
import {
  createTask,
  updateTask,
  deleteTask,
} from '@/lib/db/repository';
import { TaskSchema } from '@/lib/validations';
import { publishSyncEvent } from '@/lib/realtime';
import { revalidatePath } from 'next/cache';

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

export async function createTaskAction(raw: unknown) {
  const user = await requireUser();
  const parsed = TaskSchema.parse(raw);
  const task = await createTask(user.uid, {
    ...parsed,
    dueDate: new Date(parsed.dueDate),
  });

  if (task) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'task:create',
      payload: { task },
    });
  }

  revalidatePath('/');
  return { success: true, task };
}

export async function updateTaskAction(id: string, raw: unknown) {
  const user = await requireUser();
  const parsed = TaskSchema.partial().parse(raw);
  const task = await updateTask(user.uid, id, {
    ...parsed,
    dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
  });

  if (task) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'task:update',
      payload: { task },
    });
  }

  revalidatePath('/');
  return { success: true, task };
}

export async function deleteTaskAction(id: string) {
  const user = await requireUser();
  await deleteTask(user.uid, id);

  await publishSyncEvent({
    userId: user.uid,
    eventType: 'task:delete',
    payload: { taskId: id },
  });

  revalidatePath('/');
  return { success: true };
}
