import { NextRequest } from 'next/server';
import { getCurrentUser, isUserAdmin } from '@/lib/auth';
import {
  getRealtimeEmitter,
  getSyncEventsForUser,
  getLatestSyncEventId,
  getSyncEventsAfterSeq,
  getMaxSeq,
  getNextRetainedSeq,
  RealtimeSyncEvent,
  ADMIN_REALTIME_CHANNEL,
} from '@/lib/realtime';
import { getUserActiveTimer } from '@/lib/db/repository';

export const maxDuration = 60; // Up to 60 seconds on Vercel

/**
 * Two protocols share this endpoint:
 *
 *  v2 (?v=2, sent by useRealtimeSync): cursor = per-user gapless seq.
 *      Detects stale/gapped cursors and prompts the client to resync.
 *  v1 (no v param: legacy clients and admin hook): cursor = global id.
 *      Behaviour unchanged for full backward compatibility.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.isBanned) {
    return new Response(user?.isBanned ? 'Account is banned' : 'Unauthorized', {
      status: user?.isBanned ? 403 : 401,
    });
  }

  const isAdmin = ((user as any).role === 'admin') || (await isUserAdmin(user));

  const searchParams = req.nextUrl.searchParams;
  const protocol: 1 | 2 = searchParams.get('v') === '2' ? 2 : 1;

  // The ?lastEventId= param is frozen when the client creates the EventSource, while the browser's
  // automatic reconnects send an up-to-date Last-Event-ID header. Take the larger so a stale param
  // cannot make reconnects replay old events.
  let cursor = 0;
  for (const raw of [searchParams.get('lastEventId'), req.headers.get('last-event-id')]) {
    const parsed = raw ? parseInt(raw, 10) : NaN;
    if (!isNaN(parsed) && parsed > cursor) cursor = parsed;
  }

  // Establish starting cursor and check if client cursor has a gap due to pruning
  let lastSeen = cursor;
  let resyncNeeded = false;

  if (protocol === 2) {
    const maxSeq = await getMaxSeq(user.uid);
    if (cursor === 0) {
      lastSeen = maxSeq;
    } else if (cursor > maxSeq) {
      resyncNeeded = true;
      lastSeen = maxSeq;
    } else if (cursor < maxSeq) {
      const next = await getNextRetainedSeq(user.uid, cursor);
      if (next !== cursor + 1) {
        resyncNeeded = true;
        lastSeen = maxSeq;
      }
    }
  } else if (lastSeen === 0) {
    lastSeen = await getLatestSyncEventId(user.uid, isAdmin);
  }

  const encoder = new TextEncoder();
  let isClosed = false;
  let intervalTimer: NodeJS.Timeout | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let maxDurationTimer: NodeJS.Timeout | null = null;
  let localListener: ((ev: RealtimeSyncEvent) => void) | null = null;
  let adminListener: ((ev: RealtimeSyncEvent) => void) | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const emitter = getRealtimeEmitter();

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        if (localListener) {
          emitter.off(`user:${user.uid}`, localListener);
          localListener = null;
        }
        if (adminListener) {
          emitter.off(ADMIN_REALTIME_CHANNEL, adminListener);
          adminListener = null;
        }
        if (intervalTimer) {
          clearTimeout(intervalTimer);
          intervalTimer = null;
        }
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        if (maxDurationTimer) {
          clearTimeout(maxDurationTimer);
          maxDurationTimer = null;
        }
        try {
          controller.close();
        } catch {}
      };

      const safeEnqueue = (chunk: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      const formatSseMessage = (id: number | null, eventType: string, payload: string) => {
        const lines = payload.split(/\r\n|\r|\n/);
        const dataLines = lines.map((l) => `data: ${l}`).join('\n');
        return id !== null && id > 0
          ? `id: ${id}\nevent: ${eventType}\n${dataLines}\n\n`
          : `event: ${eventType}\n${dataLines}\n\n`;
      };

      const cursorOf = (ev: RealtimeSyncEvent): number | null =>
        protocol === 2 ? ev.seq : ev.id;

      // 1. Configure SSE retry timeout to 1 second
      safeEnqueue('retry: 1000\n\n');

      // 2. Fetch current timer baseline and emit connected ack with baseline cursor
      const initialTimer = await getUserActiveTimer(user.uid);
      const connectedPayload = JSON.stringify({
        status: 'connected',
        protocol,
        serverTime: new Date().toISOString(),
        lastSeenId: lastSeen,
        seq: protocol === 2 ? lastSeen : undefined,
        activeTimer: initialTimer || null,
        isAdmin,
      });
      safeEnqueue(
        formatSseMessage(lastSeen > 0 ? lastSeen : null, 'connected', connectedPayload)
      );

      // If resync is needed due to a sequence gap, emit resync immediately
      if (resyncNeeded) {
        safeEnqueue(
          formatSseMessage(
            lastSeen > 0 ? lastSeen : null,
            'resync',
            JSON.stringify({ reason: 'cursor_gap', seq: lastSeen })
          )
        );
      }

      // If there's an active timer running on connection start, emit immediate timer baseline
      if (initialTimer) {
        safeEnqueue(
          `event: timer:update\ndata: ${JSON.stringify({
            timer: initialTimer,
            fromBaseline: true,
            _originDeviceId: 'server_baseline',
          })}\n\n`
        );
      } else {
        safeEnqueue(
          `event: timer:delete\ndata: ${JSON.stringify({
            fromBaseline: true,
            _originDeviceId: 'server_baseline',
          })}\n\n`
        );
      }

      // 3. Fast In-Memory Listener for 0ms delivery within same worker process
      localListener = (ev: RealtimeSyncEvent) => {
        if (isClosed) return;
        const c = cursorOf(ev);
        if (c !== null && c > lastSeen) {
          lastSeen = c;
          safeEnqueue(formatSseMessage(c, ev.eventType, ev.payload));
        }
      };
      emitter.on(`user:${user.uid}`, localListener);

      // Admin broadcasts delivered to admins regardless of protocol version
      if (isAdmin) {
        adminListener = (ev: RealtimeSyncEvent) => {
          if (isClosed) return;
          safeEnqueue(formatSseMessage(ev.id, ev.eventType, ev.payload));
        };
        emitter.on(ADMIN_REALTIME_CHANNEL, adminListener);
      }

      // 4. Polling function for cross-instance events from Neon PostgreSQL with adaptive backoff
      let currentIntervalMs = 2500;
      let consecutiveEmptyPolls = 0;

      const pollDbEvents = async () => {
        if (isClosed) return;
        try {
          const events: RealtimeSyncEvent[] =
            protocol === 2
              ? await getSyncEventsAfterSeq(user.uid, lastSeen, 50)
              : await getSyncEventsForUser(user.uid, lastSeen, 50, isAdmin);

          if (events.length > 0) {
            consecutiveEmptyPolls = 0;
            currentIntervalMs = 2000;
            for (const ev of events) {
              if (isClosed) break;
              const c = cursorOf(ev);
              if (c !== null && c > lastSeen) {
                lastSeen = c;
                safeEnqueue(formatSseMessage(c, ev.eventType, ev.payload));
              }
            }
          } else {
            consecutiveEmptyPolls++;
            if (consecutiveEmptyPolls > 3) {
              currentIntervalMs = Math.min(4000, currentIntervalMs + 500);
            }
          }
        } catch {
          // Ignore transient polling query errors
        }
      };

      const scheduleNextPoll = () => {
        if (isClosed) return;
        intervalTimer = setTimeout(async () => {
          await pollDbEvents();
          scheduleNextPoll();
        }, currentIntervalMs);
      };

      // Poll initially for any missed events since lastSeen
      await pollDbEvents();
      scheduleNextPoll();

      // 5. Heartbeat every 15s to keep connection alive through proxies
      heartbeatTimer = setInterval(() => {
        if (isClosed) return;
        safeEnqueue(': keepalive\n\n');
      }, 15000);

      // 6. Graceful closure at 55 seconds to prevent hard Vercel timeout errors
      maxDurationTimer = setTimeout(() => {
        cleanup();
      }, 55000);
    },
    cancel() {
      isClosed = true;
      const emitter = getRealtimeEmitter();
      if (localListener) {
        emitter.off(`user:${user.uid}`, localListener);
        localListener = null;
      }
      if (adminListener) {
        emitter.off(ADMIN_REALTIME_CHANNEL, adminListener);
        adminListener = null;
      }
      if (intervalTimer) {
        clearTimeout(intervalTimer);
        intervalTimer = null;
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (maxDurationTimer) {
        clearTimeout(maxDurationTimer);
        maxDurationTimer = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform, no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
