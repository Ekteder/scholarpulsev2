'use server';

import { getCurrentUser } from '@/lib/auth';
import {
  createStudySession,
  updateStudySession,
  deleteStudySession,
  getUserWorkspaceData,
} from '@/lib/db/repository';
import { StudySessionSchema } from '@/lib/validations';
import { revalidatePath } from 'next/cache';

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

export async function createStudySessionAction(raw: unknown) {
  const user = await requireUser();
  const parsed = StudySessionSchema.parse(raw);
  const result = await createStudySession(user.uid, {
    ...parsed,
    startTime: new Date(parsed.startTime),
    endTime: new Date(parsed.endTime),
  });
  revalidatePath('/');
  return { success: true, ...result };
}

export async function updateStudySessionAction(id: string, raw: unknown) {
  const user = await requireUser();
  const parsed = StudySessionSchema.partial().parse(raw);
  const session = await updateStudySession(user.uid, id, {
    ...parsed,
    startTime: parsed.startTime ? new Date(parsed.startTime) : undefined,
    endTime: parsed.endTime ? new Date(parsed.endTime) : undefined,
  });
  revalidatePath('/');
  return { success: true, session };
}

export async function deleteStudySessionAction(id: string) {
  const user = await requireUser();
  await deleteStudySession(user.uid, id);
  revalidatePath('/');
  return { success: true };
}
