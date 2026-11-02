import 'server-only';
import { EventEmitter } from 'events';
import { db } from './db/index';
import { syncEvents } from './db/schema';
import { and, asc, desc, eq, gt, lt, or } from 'drizzle-orm';

export const ADMIN_BROADCAST_USER_ID = 'SYSTEM_ADMIN_BROADCAST';
export const ADMIN_REALTIME_CHANNEL = 'admin:events';

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
  | 'workspace:refresh';

export interface RealtimeSyncEvent {
  id: number;
  userId: string;
  eventType: RealtimeEventType | string;
  payload: string; // JSON stringified
  clientDeviceId: string;
  createdAt: string; // ISO string
}

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

/**
 * Publish a real-time event to PostgreSQL and local worker listeners.
 */
export async function publishSyncEvent({
  userId,
  eventType,
  payload,
  clientDeviceId = '',
}: {
  userId: string;
  eventType: RealtimeEventType | string;
  payload: unknown;
  clientDeviceId?: string;
}): Promise<RealtimeSyncEvent | null> {
  try {
    let payloadStr = '';
    if (typeof payload === 'object' && payload !== null) {
      payloadStr = JSON.stringify({
        ...payload,
        _originDeviceId: clientDeviceId,
      });
    } else if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        if (typeof parsed === 'object' && parsed !== null) {
          payloadStr = JSON.stringify({
            ...parsed,
            _originDeviceId: clientDeviceId,
          });
        } else {
          payloadStr = JSON.stringify({ value: payload, _originDeviceId: clientDeviceId });
        }
      } catch {
        payloadStr = JSON.stringify({ value: payload, _originDeviceId: clientDeviceId });
      }
    } else {
      payloadStr = JSON.stringify({ value: payload, _originDeviceId: clientDeviceId });
    }

    const [inserted] = await db
      .insert(syncEvents)
      .values({
        userId,
        eventType,
        payload: payloadStr,
        clientDeviceId,
        createdAt: new Date(),
      })
      .returning();

    if (!inserted) return null;

    const formatted: RealtimeSyncEvent = {
      id: Number(inserted.id),
      userId: inserted.userId,
      eventType: inserted.eventType,
      payload: inserted.payload,
      clientDeviceId: inserted.clientDeviceId || '',
      createdAt: inserted.createdAt.toISOString(),
    };

    // Emit to in-memory bus for 0ms same-process SSE delivery
    realtimeEmitter.emit(`user:${userId}`, formatted);

    // Opportunistically prune events older than 2 hours (5% of requests)
    if (Math.random() < 0.05) {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      db.delete(syncEvents)
        .where(
          and(eq(syncEvents.userId, userId), lt(syncEvents.createdAt, twoHoursAgo))
        )
        .catch(() => {});
    }

    return formatted;
  } catch (err) {
    console.error('Error publishing real-time sync event:', err);
    return null;
  }
}

/**
 * Broadcast an administrative event to in-memory listeners and persist to Neon sync_events.
 * Admin events are stored with user_id = 'SYSTEM_ADMIN_BROADCAST' and emitted on channel 'admin:events'.
 */
export async function emitAdminSyncEvent(
  eventType: string,
  payload: unknown,
  clientDeviceId = ''
): Promise<RealtimeSyncEvent | null> {
  try {
    let payloadStr = '';
    if (typeof payload === 'object' && payload !== null) {
      payloadStr = JSON.stringify({
        ...payload,
        _originDeviceId: clientDeviceId,
      });
    } else if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        if (typeof parsed === 'object' && parsed !== null) {
          payloadStr = JSON.stringify({
            ...parsed,
            _originDeviceId: clientDeviceId,
          });
        } else {
          payloadStr = JSON.stringify({ value: payload, _originDeviceId: clientDeviceId });
        }
      } catch {
        payloadStr = JSON.stringify({ value: payload, _originDeviceId: clientDeviceId });
      }
    } else {
      payloadStr = JSON.stringify({ value: payload, _originDeviceId: clientDeviceId });
    }

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

    const formatted: RealtimeSyncEvent = {
      id: Number(inserted.id),
      userId: inserted.userId,
      eventType: inserted.eventType,
      payload: inserted.payload,
      clientDeviceId: inserted.clientDeviceId || '',
      createdAt: inserted.createdAt.toISOString(),
    };

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
 * Retrieve newer sync events for a user after a given event ID.
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

    return rows.map((r) => ({
      id: Number(r.id),
      userId: r.userId,
      eventType: r.eventType,
      payload: r.payload,
      clientDeviceId: r.clientDeviceId || '',
      createdAt: r.createdAt.toISOString(),
    }));
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
