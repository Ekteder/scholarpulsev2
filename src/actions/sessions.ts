'use server';

import { after } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  createStudySession,
  updateStudySession,
  deleteStudySession,
  recalculateGoalsAndAchievements,
} from '@/lib/db/repository';
import { StudySessionSchema } from '@/lib/validations';
import { publishSyncEvent, emitSyncEvent, type RealtimeSyncEvent } from '@/lib/realtime';

async function requireUser() {
  const user = await getCurrentUser();
  if (!user || user.isBanned) throw new Error(user?.isBanned ? 'Account is banned' : 'Unauthorized');
  return user;
}

export async function createStudySessionAction(raw: unknown) {
  const user = await requireUser();
  const parsed = StudySessionSchema.parse(raw);
  const clientDeviceId = (raw as any)?.clientDeviceId;

  // The sync event is written in the SAME transaction as the session (transactional outbox)
  // and pushed to live listeners after that transaction commits.
  const outbox: { event: RealtimeSyncEvent | null } = { event: null };
  const result = await createStudySession(
    user.uid,
    {
      ...parsed,
      startTime: new Date(parsed.startTime),
      endTime: new Date(parsed.endTime),
    },
    {
      inTx: async (tx, created) => {
        if (created.duplicate) return; // already announced when originally created
        outbox.event = await publishSyncEvent(
          {
            userId: user.uid,
            eventType: 'session:create',
            payload: { session: created.session, newlyUnlockedAchievements: [] },
            clientDeviceId,
          },
          tx
        );
      },
    }
  );
  emitSyncEvent(outbox.event);

  if (result.session) {
    const targetUid = user.uid;
    after(async () => {
      try {
        const stats = await recalculateGoalsAndAchievements(targetUid);
        if (stats?.newlyUnlocked && stats.newlyUnlocked.length > 0) {
          await publishSyncEvent({
            userId: targetUid,
            eventType: 'goals:recalculated',
            payload: {
              newlyUnlockedAchievements: stats.newlyUnlocked,
            },
          });
        }
      } catch (err) {
        console.warn('Background goal/achievement recalculation warning:', err);
      }
    });
  }

  return { success: true, ...result };
}

export async function updateStudySessionAction(id: string, raw: unknown) {
  const user = await requireUser();
  const parsed = StudySessionSchema.partial().parse(raw);
  const clientDeviceId = (raw as any)?.clientDeviceId;

  const outbox: { event: RealtimeSyncEvent | null } = { event: null };
  const session = await updateStudySession(
    user.uid,
    id,
    {
      ...parsed,
      startTime: parsed.startTime ? new Date(parsed.startTime) : undefined,
      endTime: parsed.endTime ? new Date(parsed.endTime) : undefined,
    },
    {
      inTx: async (tx, updated) => {
        outbox.event = await publishSyncEvent(
          {
            userId: user.uid,
            eventType: 'session:update',
            payload: { session: updated },
            clientDeviceId,
          },
          tx
        );
      },
    }
  );
  emitSyncEvent(outbox.event);

  if (session) {
    const targetUid = user.uid;
    after(async () => {
      try {
        const stats = await recalculateGoalsAndAchievements(targetUid);
        if (stats?.newlyUnlocked && stats.newlyUnlocked.length > 0) {
          await publishSyncEvent({
            userId: targetUid,
            eventType: 'goals:recalculated',
            payload: {
              newlyUnlockedAchievements: stats.newlyUnlocked,
            },
          });
        }
      } catch (err) {
        console.warn('Background goal/achievement recalculation warning:', err);
      }
    });
  }

  return { success: true, session };
}

export async function deleteStudySessionAction(id: string, clientDeviceId?: string) {
  const user = await requireUser();

  const outbox: { event: RealtimeSyncEvent | null } = { event: null };
  await deleteStudySession(user.uid, id, {
    inTx: async (tx) => {
      outbox.event = await publishSyncEvent(
        {
          userId: user.uid,
          eventType: 'session:delete',
          payload: { sessionId: id },
          clientDeviceId,
        },
        tx
      );
    },
  });
  emitSyncEvent(outbox.event);

  return { success: true };
}
