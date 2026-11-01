'use server';

import { getCurrentUser } from '@/lib/auth';
import {
  createStudySession,
  updateStudySession,
  deleteStudySession,
} from '@/lib/db/repository';
import { StudySessionSchema } from '@/lib/validations';
import { publishSyncEvent } from '@/lib/realtime';
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

  if (result.session) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'session:create',
      payload: {
        session: result.session,
        newlyUnlockedAchievements: (result as any).newlyUnlockedAchievements || [],
      },
    });
  }

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

  if (session) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'session:update',
      payload: { session },
    });
  }

  revalidatePath('/');
  return { success: true, session };
}

export async function deleteStudySessionAction(id: string) {
  const user = await requireUser();
  await deleteStudySession(user.uid, id);

  await publishSyncEvent({
    userId: user.uid,
    eventType: 'session:delete',
    payload: { sessionId: id },
  });

  revalidatePath('/');
  return { success: true };
}
