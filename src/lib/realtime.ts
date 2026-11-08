import 'server-only';
import { EventEmitter } from 'events';
import { db } from './db/index';
import { syncEvents, syncCounters } from './db/schema';
import { and, asc, desc, eq, gt, lt, or, sql } from 'drizzle-orm';

export const ADMIN_BROADCAST_USER_ID = 'SYSTEM_ADMIN_BROADCAST';
export const ADMIN_REALTIME_CHANNEL = 'admin:events';

/** Events older than this are pruned. Clients that were offline longer get a `resync` instead. */
export const SYNC_EVENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export type RealtimeEventType =
  | 'timer:update'
  | 'timer:delete'
  | 'session:create'
  | 'session:update'
  | 'session:delete'
  | 'task:create'
  | 'task:update'
  | 'task:delete'
  | 'schedule:create'
  | 'schedule:update'
  | 'schedule:delete'
  | 'goal:create'
  | 'goal:update'
  | 'goal:delete'
  | 'subject:create'
  | 'subject:update'
  | 'subject:delete'
  | 'revision:toggle'
  | 'revision:detailed'
  | 'revision:delete'
  | 'revision:topic:create'
  | 'revision:subject:create'
  | 'revision:customization:update'
  | 'revision:resource:create'
  | 'revision:resource:delete'
  | 'revision:refresh'
  | 'profile:update'
  | 'preferences:update'
  | 'goals:recalculated'
  | 'resync'
  | 'workspace:refresh';

export interface RealtimeSyncEvent {
  /** Global bigserial id. Used by the legacy (v1) stream and admin events. */
  id: number;
  /** Gapless per-user sequence. null for admin broadcast rows / pre-migration rows. */
  seq: number | null;
  userId: string;
  eventType: RealtimeEventType | string;
  payload: string; // JSON stringified
  clientDeviceId: string;
  createdAt: string; // ISO string
}

export interface SyncEventInput {
  userId: string;
  eventType: RealtimeEventType | string;
  payload: unknown;
  clientDeviceId?: string;
}

/** The `db` handle or the transaction handle passed to `db.transaction(async (tx) => ...)`. */
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbOrTx = typeof db | DbTx;

declare global {
  var __scholarpulse_realtime_emitter: EventEmitter | undefined;
}

const realtimeEmitter: EventEmitter =
  global.__scholarpulse_realtime_emitter ||
  (global.__scholarpulse_realtime_emitter = new EventEmitter());
realtimeEmitter.setMaxListeners(250);

export function getRealtimeEmitter() {
  return realtimeEmitter;
}

function buildPayload(payload: unknown, clientDeviceId: string): string {
  if (typeof payload === 'object' && payload !== null) {
    return JSON.stringify({ ...(payload as object), _originDeviceId: clientDeviceId });
  }
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload);
      if (typeof parsed === 'object' && parsed !== null) {
        return JSON.stringify({ ...parsed, _originDeviceId: clientDeviceId });
      }
    } catch {
      // fall through
    }
  }
  return JSON.stringify({ value: payload, _originDeviceId: clientDeviceId });
}

function toEvent(r: typeof syncEvents.$inferSelect): RealtimeSyncEvent {
  return {
    id: Number(r.id),
    seq: r.seq === null || r.seq === undefined ? null : Number(r.seq),
    userId: r.userId,
    eventType: r.eventType,
    payload: r.payload,
    clientDeviceId: r.clientDeviceId || '',
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * Allocates the next per-user seq and inserts the event row using the given executor.
 * Must run inside the same transaction as the domain write for the outbox guarantee.
 * Throws on failure (never swallows).
 */
async function insertSyncEvent(
  executor: DbOrTx,
  { userId, eventType, payload, clientDeviceId = '' }: SyncEventInput
): Promise<RealtimeSyncEvent> {
  const ex = executor as unknown as typeof db;

  // Atomic counter increment guarantees gapless monotonically increasing sequence
  const [counter] = await ex
    .insert(syncCounters)
    .values({ userId, seq: 1 })
    .onConflictDoUpdate({
      target: syncCounters.userId,
      set: { seq: sql`${syncCounters.seq} + 1` },
    })
    .returning({ seq: syncCounters.seq });

  const [inserted] = await ex
    .insert(syncEvents)
    .values({
      userId,
      eventType,
      payload: buildPayload(payload, clientDeviceId),
      clientDeviceId,
      seq: Number(counter.seq),
      createdAt: new Date(),
    })
    .returning();

  return toEvent(inserted);
}

/**
 * Publish a sync event.
 *
 * - WITH `tx`: the event is written inside the caller's transaction (transactional outbox).
 *   Throws on failure so the domain write rolls back with it.
 *   Does NOT emit immediately: call `emitSyncEvent(event)` AFTER the transaction commits.
 * - WITHOUT `tx` (legacy call sites not yet converted): writes in its own transaction,
 *   retries once, emits, and returns null on failure.
 */
export async function publishSyncEvent(input: SyncEventInput, tx: DbOrTx): Promise<RealtimeSyncEvent>;
export async function publishSyncEvent(input: SyncEventInput): Promise<RealtimeSyncEvent | null>;
export async function publishSyncEvent(
  input: SyncEventInput,
  tx?: DbOrTx
): Promise<RealtimeSyncEvent | null> {
  if (tx) {
    return insertSyncEvent(tx, input);
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const event = await db.transaction((t) => insertSyncEvent(t, input));
      emitSyncEvent(event);
      return event;
    } catch (err) {
      lastErr = err;
    }
  }
  console.error('Error publishing real-time sync event:', lastErr);
  return null;
}

/** Push to same-process SSE listeners (0 ms fast path). Call only AFTER transaction commits. */
export function emitSyncEvent(event: RealtimeSyncEvent | null | undefined): void {
  if (!event) return;
  realtimeEmitter.emit(`user:${event.userId}`, event);

  // Opportunistic retention pruning (1% of mutations)
  if (Math.random() < 0.01) {
    void pruneSyncEvents().catch(() => {});
  }
}

export async function pruneSyncEvents(retentionMs = SYNC_EVENT_RETENTION_MS): Promise<void> {
  await db.delete(syncEvents).where(lt(syncEvents.createdAt, new Date(Date.now() - retentionMs)));
}

/**
 * Broadcast an administrative event to in-memory listeners and persist to sync_events.
 * Admin events live on the legacy global-id stream (seq stays NULL).
 */
export async function emitAdminSyncEvent(
  eventType: string,
  payload: unknown,
  clientDeviceId = ''
): Promise<RealtimeSyncEvent | null> {
  try {
    const payloadStr = buildPayload(payload, clientDeviceId);

    const [inserted] = await db
      .insert(syncEvents)
      .values({
        userId: ADMIN_BROADCAST_USER_ID,
        eventType,
        payload: payloadStr,
        clientDeviceId,
        createdAt: new Date(),
      })
      .returning();

    if (!inserted) return null;

    const formatted: RealtimeSyncEvent = toEvent(inserted);

    // Emit to in-memory bus for 0ms same-process SSE delivery to connected admins
    realtimeEmitter.emit(ADMIN_REALTIME_CHANNEL, formatted);

    // Opportunistically prune events older than 2 hours (5% of requests)
    if (Math.random() < 0.05) {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      db.delete(syncEvents)
        .where(
          and(
            eq(syncEvents.userId, ADMIN_BROADCAST_USER_ID),
            lt(syncEvents.createdAt, twoHoursAgo)
          )
        )
        .catch(() => {});
    }

    return formatted;
  } catch (err) {
    console.error('Error emitting admin sync event:', err);
    return null;
  }
}

/**
 * Retrieve newer sync events for a user after a given gapless sequence number.
 */
export async function getSyncEventsAfterSeq(
  userId: string,
  afterSeq: number,
  limit = 50
): Promise<RealtimeSyncEvent[]> {
  try {
    const rows = await db
      .select()
      .from(syncEvents)
      .where(and(eq(syncEvents.userId, userId), gt(syncEvents.seq, afterSeq)))
      .orderBy(asc(syncEvents.seq))
      .limit(limit);

    return rows.map(toEvent);
  } catch (err) {
    console.error('Error fetching sync events after seq:', err);
    return [];
  }
}

/**
 * Returns the highest sequence number allocated to a user (0 if none).
 */
export async function getMaxSeq(userId: string): Promise<number> {
  try {
    const [row] = await db
      .select({ seq: syncCounters.seq })
      .from(syncCounters)
      .where(eq(syncCounters.userId, userId))
      .limit(1);

    return row ? Number(row.seq) : 0;
  } catch {
    return 0;
  }
}

/**
 * Returns the smallest sequence number for a user strictly greater than `afterSeq`.
 * Used for gap detection: if the client is at seq 40, the next row in the DB should be 41.
 * If next is greater than 41, events were pruned and the client has a gap.
 */
export async function getNextRetainedSeq(
  userId: string,
  afterSeq: number
): Promise<number | null> {
  try {
    const [row] = await db
      .select({ seq: syncEvents.seq })
      .from(syncEvents)
      .where(and(eq(syncEvents.userId, userId), gt(syncEvents.seq, afterSeq)))
      .orderBy(asc(syncEvents.seq))
      .limit(1);

    return row && row.seq !== null ? Number(row.seq) : null;
  } catch {
    return null;
  }
}

/**
 * Retrieve newer sync events for a user after a given global event ID.
 * If includeAdmin is true, also retrieves SYSTEM_ADMIN_BROADCAST events.
 */
export async function getSyncEventsForUser(
  userId: string,
  afterId: number,
  limit = 50,
  includeAdmin = false
): Promise<RealtimeSyncEvent[]> {
  try {
    const userCondition = includeAdmin
      ? or(eq(syncEvents.userId, userId), eq(syncEvents.userId, ADMIN_BROADCAST_USER_ID))
      : eq(syncEvents.userId, userId);

    const rows = await db
      .select()
      .from(syncEvents)
      .where(and(userCondition, gt(syncEvents.id, afterId)))
      .orderBy(asc(syncEvents.id))
      .limit(limit);

    return rows.map(toEvent);
  } catch (err) {
    console.error('Error fetching sync events for user:', err);
    return [];
  }
}

/**
 * Retrieve the latest event ID for initial connection sync baseline.
 * If includeAdmin is true, checks latest among both user events and admin broadcast events.
 */
export async function getLatestSyncEventId(
  userId: string,
  includeAdmin = false
): Promise<number> {
  try {
    const userCondition = includeAdmin
      ? or(eq(syncEvents.userId, userId), eq(syncEvents.userId, ADMIN_BROADCAST_USER_ID))
      : eq(syncEvents.userId, userId);

    const [row] = await db
      .select({ id: syncEvents.id })
      .from(syncEvents)
      .where(userCondition)
      .orderBy(desc(syncEvents.id))
      .limit(1);

    return row ? Number(row.id) : 0;
  } catch {
    return 0;
  }
}
