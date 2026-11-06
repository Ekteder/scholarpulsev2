import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  studySessions as studySessionsTable,
  tasks as tasksTable,
  revisionRecords as revisionRecordsTable,
  activeTimerSessions,
  profiles,
} from '@/lib/db/schema';
import { BatchSyncPayloadSchema } from '@/lib/validations/sync';
import { publishSyncEvent } from '@/lib/realtime';
import { and, eq, sql } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    if (user.isBanned) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'ACCOUNT_BANNED',
            message: 'Account has been suspended',
          },
        },
        { status: 403 }
      );
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = BatchSyncPayloadSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid batch sync payload structure',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const {
      clientDeviceId,
      studySessions = [],
      tasks = [],
      revisionRecords = [],
      activeTimer,
    } = parsed.data;

    // Execute interactive transaction over Neon WebSocket Pool
    const syncStats = await db.transaction(async (tx) => {
      let sessionsInserted = 0;
      let sessionsDuplicates = 0;
      let tasksUpdated = 0;
      let tasksInserted = 0;
      let revisionsUpserted = 0;
      let timerUpdated = false;

      // 1. Process Study Sessions
      for (const item of studySessions) {
        const start = new Date(item.startTime);
        const end = new Date(item.endTime);
        const computedDuration = Math.max(
          1,
          Math.round((end.getTime() - start.getTime()) / 1000)
        );
        const duration =
          item.durationSeconds && item.durationSeconds > 0
            ? item.durationSeconds
            : computedDuration;

        const inserted = await tx
          .insert(studySessionsTable)
          .values({
            userId: user.uid,
            subjectId: item.subjectId,
            startTime: start,
            endTime: end,
            durationSeconds: duration,
            topic: item.topic || 'General Study',
            notes: item.notes || '',
            productivityRating: item.productivityRating ?? 4,
            sessionType: item.sessionType || 'manual',
            idempotencyKey: item.idempotencyKey,
          })
          .onConflictDoNothing({ target: studySessionsTable.idempotencyKey })
          .returning({ id: studySessionsTable.id });

        if (inserted.length > 0) {
          sessionsInserted++;
        } else {
          sessionsDuplicates++;
        }
      }

      // 2. Process Tasks
      for (const item of tasks) {
        let handled = false;

        if (item.id) {
          const [existing] = await tx
            .select()
            .from(tasksTable)
            .where(and(eq(tasksTable.id, item.id), eq(tasksTable.userId, user.uid)))
            .limit(1);

          if (existing) {
            handled = true;
            if ((item.version ?? 1) >= existing.version) {
              await tx
                .update(tasksTable)
                .set({
                  subjectId: item.subjectId,
                  title: item.title,
                  description: item.description ?? '',
                  dueDate: new Date(item.dueDate),
                  priority: item.priority || 'medium',
                  status: item.status || 'pending',
                  completedAt: item.completedAt ? new Date(item.completedAt) : null,
                  version: (item.version ?? existing.version) + 1,
                  updatedAt: new Date(),
                })
                .where(eq(tasksTable.id, item.id));
              tasksUpdated++;
            }
          }
        }

        if (!handled && item.idempotencyKey) {
          const [existingByKey] = await tx
            .select()
            .from(tasksTable)
            .where(
              and(
                eq(tasksTable.userId, user.uid),
                eq(tasksTable.idempotencyKey, item.idempotencyKey)
              )
            )
            .limit(1);

          if (existingByKey) {
            handled = true;
            if ((item.version ?? 1) >= existingByKey.version) {
              await tx
                .update(tasksTable)
                .set({
                  subjectId: item.subjectId,
                  title: item.title,
                  description: item.description ?? '',
                  dueDate: new Date(item.dueDate),
                  priority: item.priority || 'medium',
                  status: item.status || 'pending',
                  completedAt: item.completedAt ? new Date(item.completedAt) : null,
                  version: (item.version ?? existingByKey.version) + 1,
                  updatedAt: new Date(),
                })
                .where(eq(tasksTable.id, existingByKey.id));
              tasksUpdated++;
            }
          }
        }

        if (!handled) {
          const inserted = await tx
            .insert(tasksTable)
            .values({
              userId: user.uid,
              subjectId: item.subjectId,
              title: item.title,
              description: item.description ?? '',
              dueDate: new Date(item.dueDate),
              priority: item.priority || 'medium',
              status: item.status || 'pending',
              completedAt: item.completedAt ? new Date(item.completedAt) : null,
              idempotencyKey: item.idempotencyKey || null,
              version: item.version ?? 1,
            })
            .onConflictDoNothing({ target: tasksTable.idempotencyKey })
            .returning({ id: tasksTable.id });

          if (inserted.length > 0) {
            tasksInserted++;
          }
        }
      }

      // 3. Process Revision Records
      for (const item of revisionRecords) {
        const [existing] = await tx
          .select({ isCompleted: revisionRecordsTable.isCompleted })
          .from(revisionRecordsTable)
          .where(
            and(
              eq(revisionRecordsTable.userId, user.uid),
              eq(revisionRecordsTable.topicId, item.topicId),
              eq(revisionRecordsTable.category, item.category)
            )
          )
          .limit(1);

        const wasCompleted = existing?.isCompleted ?? false;

        await tx
          .insert(revisionRecordsTable)
          .values({
            userId: user.uid,
            subjectId: item.subjectId,
            topicId: item.topicId,
            category: item.category,
            isCompleted: item.isCompleted,
            activityDate: item.activityDate || new Date().toISOString().slice(0, 10),
            bookName: item.bookName || null,
            pagesRead: item.pagesRead || null,
            questionsSolved: item.questionsSolved || null,
            correctCount: item.correctCount || null,
            notes: item.notes || null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              revisionRecordsTable.userId,
              revisionRecordsTable.topicId,
              revisionRecordsTable.category,
            ],
            set: {
              isCompleted: item.isCompleted,
              activityDate: item.activityDate || new Date().toISOString().slice(0, 10),
              bookName: item.bookName !== undefined ? item.bookName : undefined,
              pagesRead: item.pagesRead !== undefined ? item.pagesRead : undefined,
              questionsSolved: item.questionsSolved !== undefined ? item.questionsSolved : undefined,
              correctCount: item.correctCount !== undefined ? item.correctCount : undefined,
              notes: item.notes !== undefined ? item.notes : undefined,
              updatedAt: new Date(),
            },
          });

        if (!wasCompleted && item.isCompleted) {
          await tx
            .update(profiles)
            .set({ gamificationXp: sql`${profiles.gamificationXp} + 25` })
            .where(eq(profiles.userId, user.uid));
        } else if (wasCompleted && !item.isCompleted) {
          await tx
            .update(profiles)
            .set({ gamificationXp: sql`GREATEST(0, ${profiles.gamificationXp} - 25)` })
            .where(eq(profiles.userId, user.uid));
        }

        revisionsUpserted++;
      }

      // 4. Process Active Timer
      let updatedTimerRecord: any = null;
      if (activeTimer) {
        const [currentServerTimer] = await tx
          .select()
          .from(activeTimerSessions)
          .where(eq(activeTimerSessions.userId, user.uid))
          .limit(1);

        if (!currentServerTimer || activeTimer.stateVersion >= currentServerTimer.stateVersion) {
          const timerKey = activeTimer.idempotencyKey || `timer_${user.uid}_${Date.now()}`;

          const [savedTimer] = await tx
            .insert(activeTimerSessions)
            .values({
              userId: user.uid,
              subjectId: activeTimer.subjectId,
              topic: activeTimer.topic || 'Focused Study',
              notes: activeTimer.notes || '',
              mode: activeTimer.mode || 'stopwatch',
              phase: activeTimer.phase || 'focus',
              status: activeTimer.status || 'running',
              startedAt: new Date(activeTimer.startedAt),
              lastResumedAt: new Date(activeTimer.lastResumedAt),
              accumulatedSeconds: activeTimer.accumulatedSeconds ?? 0,
              totalFocusSeconds: activeTimer.totalFocusSeconds ?? 0,
              targetDurationSeconds: activeTimer.targetDurationSeconds ?? 1500,
              completedPomodoros: activeTimer.completedPomodoros ?? 0,
              stateVersion: activeTimer.stateVersion,
              clientDeviceId,
              idempotencyKey: timerKey,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [activeTimerSessions.userId],
              set: {
                subjectId: activeTimer.subjectId,
                topic: activeTimer.topic || 'Focused Study',
                notes: activeTimer.notes || '',
                mode: activeTimer.mode || 'stopwatch',
                phase: activeTimer.phase || 'focus',
                status: activeTimer.status || 'running',
                startedAt: new Date(activeTimer.startedAt),
                lastResumedAt: new Date(activeTimer.lastResumedAt),
                accumulatedSeconds: activeTimer.accumulatedSeconds ?? 0,
                totalFocusSeconds: activeTimer.totalFocusSeconds ?? 0,
                targetDurationSeconds: activeTimer.targetDurationSeconds ?? 1500,
                completedPomodoros: activeTimer.completedPomodoros ?? 0,
                stateVersion: activeTimer.stateVersion,
                clientDeviceId,
                idempotencyKey: timerKey,
                updatedAt: new Date(),
              },
            })
            .returning();
          timerUpdated = true;
          updatedTimerRecord = savedTimer;
        }
      }

      // 4b. Auto-clear active timer in database if a completed timer session was synced
      let timerCleared = false;
      const hasCompletedTimerSession = studySessions.some((s) => s.sessionType === 'timer' || s.sessionType === 'stopwatch' || s.sessionType === 'manual');
      if (hasCompletedTimerSession && !activeTimer) {
        await tx
          .delete(activeTimerSessions)
          .where(eq(activeTimerSessions.userId, user.uid));
        timerCleared = true;
      }

      return {
        studySessions: { inserted: sessionsInserted, duplicates: sessionsDuplicates },
        tasks: { updated: tasksUpdated, inserted: tasksInserted },
        revisionRecords: { upserted: revisionsUpserted },
        activeTimer: { updated: timerUpdated, cleared: timerCleared },
        timerCleared,
        updatedTimerRecord,
      };
    });

    // Broadcast timer:delete across all active devices if a timer session was completed
    if (syncStats.timerCleared) {
      await publishSyncEvent({
        userId: user.uid,
        eventType: 'timer:delete',
        payload: {},
        clientDeviceId,
      });
    }

    // Broadcast timer:update across all active devices in real time if active timer was updated
    if (syncStats.activeTimer?.updated && syncStats.updatedTimerRecord) {
      await publishSyncEvent({
        userId: user.uid,
        eventType: 'timer:update',
        payload: { timer: syncStats.updatedTimerRecord },
        clientDeviceId,
      });
    }

    // Publish workspace refresh sync event across active sessions
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'workspace:refresh',
      payload: { source: 'batch_sync', timestamp: new Date().toISOString() },
      clientDeviceId,
    });

    return NextResponse.json({
      success: true,
      synced: syncStats,
      data: {
        success: true,
        synced: syncStats,
        syncedAt: new Date().toISOString(),
      },
      error: null,
    });
  } catch (error) {
    console.error('Error in batch sync:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process batch sync',
        },
      },
      { status: 500 }
    );
  }
}
