'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export type SyncStatus = 'connected' | 'connecting' | 'disconnected';

export interface UseRealtimeSyncOptions {
  userId: string | undefined;
  onEvent: (eventType: string, payload: any, originDeviceId?: string) => void;
}

export function getClientDeviceId(): string {
  if (typeof window === 'undefined') return 'server_device';
  const key = 'scholarpulse_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

const SYNC_EVENT_TYPES = [
  'connected',
  'timer:update',
  'timer:delete',
  'task:create',
  'task:update',
  'task:delete',
  'session:create',
  'session:update',
  'session:delete',
  'schedule:create',
  'schedule:update',
  'schedule:delete',
  'goal:create',
  'goal:update',
  'goal:delete',
  'subject:create',
  'subject:update',
  'subject:delete',
  'revision:toggle',
  'revision:detailed',
  'revision:delete',
  'revision:topic:create',
  'revision:subject:create',
  'revision:customization:update',
  'revision:resource:create',
  'revision:resource:delete',
  'revision:refresh',
  'profile:update',
  'preferences:update',
  'workspace:refresh',
] as const;

export function useRealtimeSync({ userId, onEvent }: UseRealtimeSyncOptions) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('disconnected');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const lastEventIdRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // Initialize cursor from session storage if available
  useEffect(() => {
    if (!userId || typeof window === 'undefined') return;
    try {
      const stored = sessionStorage.getItem(`scholarpulse_last_event_${userId}`);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed > 0) {
          lastEventIdRef.current = Math.max(lastEventIdRef.current, parsed);
        }
      }
    } catch {}
  }, [userId]);

  const updateLastEventId = useCallback((id: number, uid?: string) => {
    if (id > lastEventIdRef.current) {
      lastEventIdRef.current = id;
      if (uid && typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(`scholarpulse_last_event_${uid}`, String(id));
        } catch {}
      }
    }
  }, []);

  // 1. BroadcastChannel for 0ms cross-tab sync on the same device
  const broadcastLocal = useCallback(
    (eventType: string, payload: any) => {
      if (typeof window === 'undefined') return;
      const deviceId = getClientDeviceId();
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            eventType,
            payload,
            clientDeviceId: deviceId,
            originDeviceId: deviceId,
            timestamp: Date.now(),
          });
        } catch (err) {
          console.warn('BroadcastChannel error:', err);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!userId || typeof window === 'undefined') {
      setSyncStatus('disconnected');
      return;
    }

    const deviceId = getClientDeviceId();
    let isCleanedUp = false;

    // Setup BroadcastChannel
    const channelName = `scholarpulse_sync_${userId}`;
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(channelName);
        bc.onmessage = (event) => {
          if (isCleanedUp) return;
          const { eventType, payload, clientDeviceId, originDeviceId } = event.data || {};
          const origin = 'crosstab_' + (originDeviceId || clientDeviceId || 'tab');
          if (eventType && onEventRef.current) {
            setLastSyncTime(new Date());
            onEventRef.current(eventType, payload, origin);
          }
        };
        broadcastChannelRef.current = bc;
      } catch (err) {
        console.warn('Could not initialize BroadcastChannel:', err);
      }
    }

    // Setup Server-Sent Events (SSE)
    let es: EventSource | null = null;

    const connectSSE = () => {
      if (isCleanedUp) return;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (es) {
        try {
          es.close();
        } catch {}
      }

      setSyncStatus('connecting');
      const lastId = lastEventIdRef.current;
      const lastParam = lastId > 0 ? `&lastEventId=${lastId}` : '';
      const url = `/api/realtime?deviceId=${encodeURIComponent(deviceId)}${lastParam}`;
      es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (isCleanedUp) return;
        setSyncStatus('connected');
        setLastSyncTime(new Date());
      };

      es.onerror = () => {
        if (isCleanedUp) return;
        setSyncStatus('connecting');
        // If native EventSource closed, schedule explicit reconnect fallback
        if (es?.readyState === EventSource.CLOSED) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isCleanedUp) connectSSE();
          }, 2000);
        }
      };

      const handleEventData = (evType: string, event: MessageEvent) => {
        if (isCleanedUp) return;
        setLastSyncTime(new Date());
        setSyncStatus('connected');

        if (event.lastEventId) {
          const parsedId = parseInt(event.lastEventId, 10);
          if (!isNaN(parsedId) && parsedId > 0) {
            updateLastEventId(parsedId, userId);
          }
        }

        try {
          const data = event.data ? JSON.parse(event.data) : {};
          if (data?._eventId) {
            updateLastEventId(data._eventId, userId);
          }
          const origin = data?._originDeviceId || data?.clientDeviceId;
          if (onEventRef.current) {
            onEventRef.current(evType, data, origin);
          }
        } catch (err) {
          console.warn(`Error parsing SSE data for ${evType}:`, err);
        }
      };

      // Register listener for each distinct academic/timer sync event
      for (const evType of SYNC_EVENT_TYPES) {
        es.addEventListener(evType, (event: MessageEvent) => {
          handleEventData(evType, event);
        });
      }

      // Fallback message listener
      es.onmessage = (event: MessageEvent) => {
        if (isCleanedUp) return;
        try {
          const data = event.data ? JSON.parse(event.data) : {};
          const evType = data?.eventType || 'message';
          handleEventData(evType, event);
        } catch {}
      };
    };

    connectSSE();

    // Reconnection handling on tab visibility change or network coming back online
    const handleVisibilityOrOnline = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        if (!es || es.readyState === EventSource.CLOSED) {
          connectSSE();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrOnline);
    window.addEventListener('online', handleVisibilityOrOnline);

    return () => {
      isCleanedUp = true;
      document.removeEventListener('visibilitychange', handleVisibilityOrOnline);
      window.removeEventListener('online', handleVisibilityOrOnline);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (es) {
        try {
          es.close();
        } catch {}
        eventSourceRef.current = null;
      }
      if (bc) {
        try {
          bc.close();
        } catch {}
        broadcastChannelRef.current = null;
      }
      setSyncStatus('disconnected');
    };
  }, [userId, updateLastEventId]);

  return {
    syncStatus,
    lastSyncTime,
    broadcastLocal,
  };
}
