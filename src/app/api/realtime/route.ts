import { NextRequest } from 'next/server';
import { getCurrentUser, isUserAdmin } from '@/lib/auth';
import {
  getRealtimeEmitter,
  getSyncEventsForUser,
  getLatestSyncEventId,
  RealtimeSyncEvent,
  ADMIN_REALTIME_CHANNEL,
} from '@/lib/realtime';
import { getUserActiveTimer } from '@/lib/db/repository';

export const maxDuration = 60; // Up to 60 seconds on Vercel

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.isBanned) {
    return new Response(user?.isBanned ? 'Account is banned' : 'Unauthorized', {
      status: user?.isBanned ? 403 : 401,
    });
  }

  const isAdmin = ((user as any).role === 'admin') || (await isUserAdmin(user));

  const searchParams = req.nextUrl.searchParams;
  const clientDeviceId = searchParams.get('deviceId') || '';
  const lastEventIdParam =
    searchParams.get('lastEventId') || req.headers.get('last-event-id');

  let lastSeenId = 0;
  if (lastEventIdParam) {
    const parsed = parseInt(lastEventIdParam, 10);
    if (!isNaN(parsed) && parsed > 0) {
      lastSeenId = parsed;
    }
  }

  // If no lastEventId was provided (fresh connection), start from current latest event ID
  if (lastSeenId === 0) {
    lastSeenId = await getLatestSyncEventId(user.uid, isAdmin);
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
      const safeEnqueue = (chunk: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          isClosed = true;
        }
      };

      const formatSseMessage = (id: number, eventType: string, payload: string) => {
        const lines = payload.split(/\r\n|\r|\n/);
        const dataLines = lines.map((l) => `data: ${l}`).join('\n');
        return `id: ${id}\nevent: ${eventType}\n${dataLines}\n\n`;
      };

      // 1. Configure SSE retry timeout to 1 second
      safeEnqueue('retry: 1000\n\n');

      // 2. Fetch current timer baseline and emit connected ack with baseline cursor ID
      const initialTimer = await getUserActiveTimer(user.uid);
      const connectedPayload = JSON.stringify({
        status: 'connected',
        serverTime: new Date().toISOString(),
        lastSeenId,
        activeTimer: initialTimer || null,
        isAdmin,
      });
      safeEnqueue(
        lastSeenId > 0
          ? `id: ${lastSeenId}\nevent: connected\ndata: ${connectedPayload}\n\n`
          : `event: connected\ndata: ${connectedPayload}\n\n`
      );

      // If there's an active timer running on connection start, emit immediate timer:update
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
      const emitter = getRealtimeEmitter();
      localListener = (ev: RealtimeSyncEvent) => {
        if (isClosed) return;
        if (ev.id > lastSeenId) {
          lastSeenId = ev.id;
          safeEnqueue(formatSseMessage(ev.id, ev.eventType, ev.payload));
        }
      };
      emitter.on(`user:${user.uid}`, localListener);

      // If user is allowlisted admin, subscribe to in-memory admin events channel
      if (isAdmin) {
        adminListener = (ev: RealtimeSyncEvent) => {
          if (isClosed) return;
          if (ev.id > lastSeenId) {
            lastSeenId = ev.id;
            safeEnqueue(formatSseMessage(ev.id, ev.eventType, ev.payload));
          }
        };
        emitter.on(ADMIN_REALTIME_CHANNEL, adminListener);
      }

      // 4. Polling function for cross-instance events from Neon PostgreSQL
      const pollDbEvents = async () => {
        if (isClosed) return;
        try {
          const events = await getSyncEventsForUser(user.uid, lastSeenId, 50, isAdmin);
          for (const ev of events) {
            if (isClosed) break;
            if (ev.id > lastSeenId) {
              lastSeenId = ev.id;
              safeEnqueue(formatSseMessage(ev.id, ev.eventType, ev.payload));
            }
          }
        } catch (err) {
          // Ignore transient polling query errors
        }
      };

      // Poll initially for any missed events since lastSeenId
      await pollDbEvents();

      // Poll database every 1000ms for updates from other devices/instances
      intervalTimer = setInterval(pollDbEvents, 1000);

      // 5. Heartbeat every 15s to keep connection alive through proxies
      heartbeatTimer = setInterval(() => {
        if (isClosed) return;
        safeEnqueue(': keepalive\n\n');
      }, 15000);

      // 6. Graceful closure at 55 seconds to prevent hard Vercel timeout errors
      maxDurationTimer = setTimeout(() => {
        if (!isClosed) {
          isClosed = true;
          if (localListener) {
            emitter.off(`user:${user.uid}`, localListener);
          }
          if (adminListener) {
            emitter.off(ADMIN_REALTIME_CHANNEL, adminListener);
          }
          if (intervalTimer) clearInterval(intervalTimer);
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          try {
            controller.close();
          } catch {}
        }
      }, 55000);
    },
    cancel() {
      isClosed = true;
      const emitter = getRealtimeEmitter();
      if (localListener) {
        emitter.off(`user:${user.uid}`, localListener);
      }
      if (adminListener) {
        emitter.off(ADMIN_REALTIME_CHANNEL, adminListener);
      }
      if (intervalTimer) clearInterval(intervalTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (maxDurationTimer) clearTimeout(maxDurationTimer);
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
