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
import {
  BatchSyncPayloadSchema,
  StudySessionBatchItemSchema,
  TaskBatchItemSchema,
  RevisionBatchItemSchema,
  ActiveTimerBatchItemSchema,
  type StudySessionBatchItem,
  type TaskBatchItem,
  type RevisionBatchItem,
  type ActiveTimerBatchItem,
} from '@/lib/validations/sync';
import { publishSyncEvent, emitSyncEvent, RealtimeSyncEvent, DbTx } from '@/lib/realtime';
import { and, eq, sql } from 'drizzle-orm';

type Rejected = { key: string; reason: string };
type TimerStatus = 'none' | 'applied' | 'server_ahead' | 'rejected';

/** Integrity and data-exception errors that will fail identically on every retry */
function isPermanentDbError(err: any): boolean {
  const code = err?.code ?? err?.cause?.code;
  return typeof code === 'string' && (code.startsWith('23') || code.startsWith('22'));
}

function errorReason(err: any): string {
  const code = err?.code ?? err?.cause?.code;
  const msg = String(err?.cause?.message ?? err?.message ?? 'Database constraint error').slice(0, 200);
  return code ? `${code}: ${msg}` : msg;
}

/**
 * Runs one item. In legacy mode, errors bubble up and roll back the entire batch.
 * In Protocol 2 mode, each item runs in its own transaction savepoint so permanent errors
 * (e.g. deleted subject FK violation) are rejected cleanly without losing valid items.
 */
async function runItem<T>(
  tx: DbTx,
  isolated: boolean,
  fn: (t: DbTx) => Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; reason: string }> {
  if (!isolated) return { ok: true, value: await fn(tx) };
  try {
    const value = await (tx as any).transaction((t: DbTx) => fn(t));
    return { ok: true, value };
  } catch (err: any) {
    if (isPermanentDbError(err)) return { ok: false, reason: errorReason(err) };
    throw err;
  }
}

function describeZodError(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  return error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join('.') || 'item'}: ${i.message}`)
    .join('; ')
    .slice(0, 300);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        },
        { status: 401 }
      );
    }

    if (user.isBanned) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'ACCOUNT_BANNED', message: 'Account has been suspended' },
        },
        { status: 403 }
      );
    }

    const protocol2 = req.headers.get('x-sync-protocol') === '2';
    const rawBody = await req.json().catch(() => null);

    let clientDeviceId: string;
    let studySessions: StudySessionBatchItem[] = [];
    let tasks: TaskBatchItem[] = [];
    let revisionRecords: RevisionBatchItem[] = [];
    let activeTimer: ActiveTimerBatchItem | undefined;
    const accepted: string[] = [];
    const rejected: Rejected[] = [];
    let timerRejectedReason: string | null = null;

    if (!protocol2) {
      // Legacy behavior: entire batch is validated together; one bad item rejects whole request
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
      clientDeviceId = parsed.data.clientDeviceId;
      studySessions = parsed.data.studySessions ?? [];
      tasks = parsed.data.tasks ?? [];
      revisionRecords = parsed.data.revisionRecords ?? [];
      activeTimer = parsed.data.activeTimer ?? undefined;
    } else {
      // Protocol 2: validate envelope first; then validate each item individually
      const {
        studySessions: rawSessions,
        tasks: rawTasks,
        revisionRecords: rawRevisions,
        activeTimer: rawTimer,
        ...envelope
      } = (rawBody ?? {}) as Record<string, any>;

      const empty = { studySessions: [], tasks: [], revisionRecords: [], activeTimer: undefined };
      const envelopeCheck = BatchSyncPayloadSchema.safeParse({ ...envelope, ...empty });
      if (!envelopeCheck.success) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid batch sync envelope',
              details: envelopeCheck.error.flatten(),
            },
          },
          { status: 400 }
        );
      }
      clientDeviceId = envelopeCheck.data.clientDeviceId;

      if (Array.isArray(rawSessions)) {
        for (const raw of rawSessions) {
          const itemKey = raw?.idempotencyKey || raw?.clientSessionId || `session_${Math.random()}`;
          const itemCheck = StudySessionBatchItemSchema.safeParse(raw);
          if (itemCheck.success) {
            studySessions.push(itemCheck.data);
          } else {
            rejected.push({ key: itemKey, reason: describeZodError(itemCheck.error) });
          }
        }
      }

      if (Array.isArray(rawTasks)) {
        for (const raw of rawTasks) {
          const itemKey = raw?.idempotencyKey || raw?.id || raw?.clientTaskId || `task_${Math.random()}`;
          const itemCheck = TaskBatchItemSchema.safeParse(raw);
          if (itemCheck.success) {
            tasks.push(itemCheck.data);
          } else {
            rejected.push({ key: itemKey, reason: describeZodError(itemCheck.error) });
          }
        }
      }

      if (Array.isArray(rawRevisions)) {
        for (const raw of rawRevisions) {
          const itemKey = `${raw?.topicId || 'unknown'}:${raw?.category || 'unknown'}`;
          const itemCheck = RevisionBatchItemSchema.safeParse(raw);
          if (itemCheck.success) {
            revisionRecords.push(itemCheck.data);
          } else {
            rejected.push({ key: itemKey, reason: describeZodError(itemCheck.error) });
          }
        }
      }

      if (rawTimer) {
        const timerCheck = ActiveTimerBatchItemSchema.safeParse(rawTimer);
        if (timerCheck.success) {
          activeTimer = timerCheck.data;
        } else {
          timerRejectedReason = describeZodError(timerCheck.error);
        }
      }
    }

    const isolated = protocol2;

    // Execute interactive transaction over Neon WebSocket Pool
    const result = await db.transaction(async (tx) => {
      let sessionsInserted = 0;
      let sessionsDuplicates = 0;
      let tasksUpdated = 0;
      let tasksInserted = 0;
      let revisionsUpserted = 0;

      // 1. Process Study Sessions
      for (const item of studySessions) {
        const r = await runItem(tx, isolated, async (t) => {
          const start = new Date(item.startTime);
          const end = new Date(item.endTime);
          const computedDuration = Math.max(1, Math.round((end.getTime() - start.getTime()) / 1000));
          const duration =
            item.durationSeconds && item.durationSeconds > 0
              ? item.durationSeconds
              : computedDuration;

          const inserted = await t
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

          return inserted.length > 0 ? 'inserted' : 'duplicate';
        });

        if (r.ok) {
          if (r.value === 'inserted') sessionsInserted++;
          else sessionsDuplicates++;
          accepted.push(item.idempotencyKey);
        } else {
          rejected.push({ key: item.idempotencyKey, reason: r.reason });
        }
      }

      // 2. Process Tasks
      for (const item of tasks) {
        const fields = {
          subjectId: item.subjectId,
          title: item.title,
          description: item.description ?? '',
          dueDate: new Date(item.dueDate),
          priority: item.priority || 'medium',
          status: item.status || 'pending',
          completedAt: item.completedAt ? new Date(item.completedAt) : null,
          updatedAt: new Date(),
        };

        const r = await runItem(tx, isolated, async (t) => {
          // If explicit task ID was passed
          if (item.id) {
            const [existing] = await t
              .select()
              .from(tasksTable)
              .where(and(eq(tasksTable.id, item.id), eq(tasksTable.userId, user.uid)))
              .limit(1);

            if (existing) {
              if ((item.version ?? 1) >= existing.version) {
                await t
                  .update(tasksTable)
                  .set({ ...fields, version: (item.version ?? existing.version) + 1 })
                  .where(eq(tasksTable.id, item.id));
                return 'updated';
              }
              return 'noop';
            }
          }

          // If matched by idempotencyKey
          if (item.idempotencyKey) {
            const [existing] = await t
              .select()
              .from(tasksTable)
              .where(
                and(
                  eq(tasksTable.userId, user.uid),
                  eq(tasksTable.idempotencyKey, item.idempotencyKey)
                )
              )
              .limit(1);

            if (existing) {
              if ((item.version ?? 1) >= existing.version) {
                await t
                  .update(tasksTable)
                  .set({ ...fields, version: (item.version ?? existing.version) + 1 })
                  .where(eq(tasksTable.id, existing.id));
                return 'updated';
              }
              return 'noop';
            }
          }

          // Insert new task
          const inserted = await t
            .insert(tasksTable)
            .values({
              userId: user.uid,
              ...fields,
              idempotencyKey: item.idempotencyKey || null,
              version: item.version ?? 1,
            })
            .onConflictDoNothing({ target: tasksTable.idempotencyKey })
            .returning({ id: tasksTable.id });

          return inserted.length > 0 ? 'inserted' : 'noop';
        });

        const key = item.idempotencyKey ?? item.id ?? `task:${tasks.indexOf(item)}`;
        if (r.ok) {
          if (r.value === 'inserted') tasksInserted++;
          if (r.value === 'updated') tasksUpdated++;
          accepted.push(key);
        } else {
          rejected.push({ key, reason: r.reason });
        }
      }

      // 3. Process Revision Records
      for (const item of revisionRecords) {
        const r = await runItem(tx, isolated, async (t) => {
          const [existing] = await t
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

          await t
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
            await t
              .update(profiles)
              .set({ gamificationXp: sql`${profiles.gamificationXp} + 25` })
              .where(eq(profiles.userId, user.uid));
          } else if (wasCompleted && !item.isCompleted) {
            await t
              .update(profiles)
              .set({ gamificationXp: sql`GREATEST(0, ${profiles.gamificationXp} - 25)` })
              .where(eq(profiles.userId, user.uid));
          }
        });

        const key = `${item.topicId}:${item.category}`;
        if (r.ok) {
          revisionsUpserted++;
          accepted.push(key);
        } else {
          rejected.push({ key, reason: r.reason });
        }
      }

      // 4. Process Active Timer
      let timerStatus: TimerStatus = timerRejectedReason ? 'rejected' : 'none';
      let updatedTimerRecord: any = null;
      let serverTimer: any = null;

      if (activeTimer) {
        const r = await runItem(tx, isolated, async (t) => {
          const [current] = await t
            .select()
            .from(activeTimerSessions)
            .where(eq(activeTimerSessions.userId, user.uid))
            .limit(1);

          if (current && activeTimer!.stateVersion < current.stateVersion) {
            return { status: 'server_ahead' as const, current, saved: null };
          }

          const timerKey = activeTimer!.idempotencyKey || `timer_${user.uid}_${Date.now()}`;
          const values = {
            subjectId: activeTimer!.subjectId,
            topic: activeTimer!.topic || 'Focused Study',
            notes: activeTimer!.notes || '',
            mode: activeTimer!.mode || 'stopwatch',
            phase: activeTimer!.phase || 'focus',
            status: activeTimer!.status || 'running',
            startedAt: new Date(activeTimer!.startedAt),
            lastResumedAt: new Date(activeTimer!.lastResumedAt),
            accumulatedSeconds: activeTimer!.accumulatedSeconds ?? 0,
            totalFocusSeconds: activeTimer!.totalFocusSeconds ?? 0,
            targetDurationSeconds: activeTimer!.targetDurationSeconds ?? 1500,
            completedPomodoros: activeTimer!.completedPomodoros ?? 0,
            stateVersion: activeTimer!.stateVersion,
            clientDeviceId,
            idempotencyKey: timerKey,
            updatedAt: new Date(),
          };

          const [saved] = await t
            .insert(activeTimerSessions)
            .values({ userId: user.uid, ...values })
            .onConflictDoUpdate({ target: [activeTimerSessions.userId], set: values })
            .returning();

          return { status: 'applied' as const, current: null, saved };
        });

        if (r.ok) {
          timerStatus = r.value.status;
          if (r.value.status === 'applied') updatedTimerRecord = r.value.saved;
          else serverTimer = r.value.current;
        } else {
          timerStatus = 'rejected';
          timerRejectedReason = r.reason;
        }
      }

      // 4b. Clear active timer ONLY on strict idempotency key match.
      // Never clear on fuzzy timestamps or unrelated sessions to avoid killing active timers.
      let timerCleared = false;
      if (!activeTimer && studySessions.length > 0) {
        const [current] = await tx
          .select()
          .from(activeTimerSessions)
          .where(eq(activeTimerSessions.userId, user.uid))
          .limit(1);

        if (current && current.idempotencyKey) {
          const sessionKeys = new Set(studySessions.map((s) => s.idempotencyKey).filter(Boolean));
          if (sessionKeys.has(current.idempotencyKey)) {
            await tx
              .delete(activeTimerSessions)
              .where(
                and(
                  eq(activeTimerSessions.userId, user.uid),
                  eq(activeTimerSessions.idempotencyKey, current.idempotencyKey)
                )
              );
            timerCleared = true;
          }
        }
      }

      // 5. Transactional Outbox: events are written in the SAME transaction as the data
      const timerApplied = timerStatus === 'applied';
      const changed =
        sessionsInserted > 0 ||
        tasksInserted > 0 ||
        tasksUpdated > 0 ||
        revisionsUpserted > 0 ||
        timerApplied ||
        timerCleared;

      const events: RealtimeSyncEvent[] = [];
      if (timerCleared) {
        events.push(
          await publishSyncEvent(
            { userId: user.uid, eventType: 'timer:delete', payload: {}, clientDeviceId },
            tx
          )
        );
      }
      if (timerApplied && updatedTimerRecord) {
        events.push(
          await publishSyncEvent(
            {
              userId: user.uid,
              eventType: 'timer:update',
              payload: { timer: updatedTimerRecord },
              clientDeviceId,
            },
            tx
          )
        );
      }
      if (changed) {
        events.push(
          await publishSyncEvent(
            {
              userId: user.uid,
              eventType: 'workspace:refresh',
              payload: { source: 'batch_sync', timestamp: new Date().toISOString() },
              clientDeviceId,
            },
            tx
          )
        );
      }

      return {
        stats: {
          studySessions: { inserted: sessionsInserted, duplicates: sessionsDuplicates },
          tasks: { updated: tasksUpdated, inserted: tasksInserted },
          revisionRecords: { upserted: revisionsUpserted },
          activeTimer: { updated: timerApplied, cleared: timerCleared },
          timerCleared,
        },
        events,
        timerStatus,
        serverTimer,
      };
    });

    // Transaction committed: safe to wake up same-process SSE listeners
    for (const ev of result.events) {
      emitSyncEvent(ev);
    }

    const syncedAt = new Date().toISOString();
    const protocol2Fields = protocol2
      ? {
          protocol: 2,
          accepted,
          rejected,
          timer: {
            status: result.timerStatus,
            reason: timerRejectedReason ?? undefined,
            serverTimer: result.timerStatus === 'server_ahead' ? result.serverTimer : undefined,
          },
        }
      : {};

    return NextResponse.json({
      success: true,
      synced: result.stats,
      ...protocol2Fields,
      data: {
        success: true,
        synced: result.stats,
        syncedAt,
        ...protocol2Fields,
      },
      error: null,
    });
  } catch (error) {
    console.error('Error in batch sync:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to process batch sync' },
      },
      { status: 500 }
    );
  }
}
