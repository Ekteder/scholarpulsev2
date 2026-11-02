'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getClientDeviceId } from '@/hooks/useRealtimeSync';

export type AdminSyncStatus = 'connected' | 'connecting' | 'disconnected';

export interface AdminUserChangeEventPayload {
  userId: string;
  user?: any;
  timestamp?: string;
  [key: string]: any;
}

export interface AdminUserBanEventPayload {
  userId: string;
  isBanned: boolean;
  bannedReason?: string | null;
  bannedAt?: string | null;
  user?: any;
  timestamp?: string;
  [key: string]: any;
}

export interface AdminAnnouncementEventPayload {
  userId: string;
  targetedAnnouncement?: string;
  targetedAnnouncementCreatedAt?: string;
  user?: any;
  timestamp?: string;
  [key: string]: any;
}

export interface UseAdminRealtimeSyncOptions {
  enabled?: boolean;
  onUserChange?: (payload: AdminUserChangeEventPayload) => void;
  onUserBanToggle?: (payload: AdminUserBanEventPayload) => void;
  onAnnouncementDispatched?: (payload: AdminAnnouncementEventPayload) => void;
  onAdminEvent?: (eventType: string, payload: any) => void;
}

const ADMIN_SYNC_EVENT_TYPES = [
  'connected',
  'admin:user:change',
  'admin:user:banned',
  'admin:user:unbanned',
  'admin:announcement:dispatched',
] as const;

export function useAdminRealtimeSync(options: UseAdminRealtimeSyncOptions = {}) {
  const {
    enabled = true,
    onUserChange,
    onUserBanToggle,
    onAnnouncementDispatched,
    onAdminEvent,
  } = options;

  const [syncStatus, setSyncStatus] = useState<AdminSyncStatus>('disconnected');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const lastEventIdRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onUserChangeRef = useRef(onUserChange);
  const onUserBanToggleRef = useRef(onUserBanToggle);
  const onAnnouncementDispatchedRef = useRef(onAnnouncementDispatched);
  const onAdminEventRef = useRef(onAdminEvent);

  useEffect(() => {
    onUserChangeRef.current = onUserChange;
    onUserBanToggleRef.current = onUserBanToggle;
    onAnnouncementDispatchedRef.current = onAnnouncementDispatched;
    onAdminEventRef.current = onAdminEvent;
  }, [onUserChange, onUserBanToggle, onAnnouncementDispatched, onAdminEvent]);

  // Restore baseline cursor from sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = sessionStorage.getItem('scholarpulse_last_admin_event_id');
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed > 0) {
          lastEventIdRef.current = Math.max(lastEventIdRef.current, parsed);
        }
      }
    } catch {}
  }, []);

  const updateLastEventId = useCallback((id: number) => {
    if (id > lastEventIdRef.current) {
      lastEventIdRef.current = id;
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('scholarpulse_last_admin_event_id', String(id));
        } catch {}
      }
    }
  }, []);

  // BroadcastChannel for 0ms cross-tab synchronization across admin console tabs
  const broadcastAdminLocal = useCallback(
    (eventType: string, payload: any) => {
      if (typeof window === 'undefined') return;
      const deviceId = getClientDeviceId();
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            eventType,
            payload,
            originDeviceId: deviceId,
            timestamp: Date.now(),
          });
        } catch (err) {
          console.warn('Admin BroadcastChannel postMessage error:', err);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setSyncStatus('disconnected');
      return;
    }

    const deviceId = getClientDeviceId();
    let isCleanedUp = false;

    // 1. BroadcastChannel setup
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('scholarpulse_admin_sync');
        bc.onmessage = (event) => {
          if (isCleanedUp) return;
          const { eventType, payload } = event.data || {};
          if (!eventType || !payload) return;

          setLastSyncTime(new Date());

          if (eventType === 'admin:user:change') {
            onUserChangeRef.current?.(payload);
          } else if (eventType === 'admin:user:banned' || eventType === 'admin:user:unbanned') {
            onUserBanToggleRef.current?.(payload);
          } else if (eventType === 'admin:announcement:dispatched') {
            onAnnouncementDispatchedRef.current?.(payload);
          }
          onAdminEventRef.current?.(eventType, payload);
        };
        broadcastChannelRef.current = bc;
      } catch (err) {
        console.warn('Could not initialize admin BroadcastChannel:', err);
      }
    }

    // 2. EventSource setup
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
        if (es?.readyState === EventSource.CLOSED) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isCleanedUp) connectSSE();
          }, 1500);
        }
      };

      const handleEventData = (evType: string, event: MessageEvent) => {
        if (isCleanedUp) return;
        setLastSyncTime(new Date());
        setSyncStatus('connected');

        if (event.lastEventId) {
          const parsedId = parseInt(event.lastEventId, 10);
          if (!isNaN(parsedId) && parsedId > 0) {
            updateLastEventId(parsedId);
          }
        }

        try {
          const data = event.data ? JSON.parse(event.data) : {};
          if (data?._eventId) {
            updateLastEventId(data._eventId);
          }

          if (evType === 'admin:user:change') {
            onUserChangeRef.current?.(data);
          } else if (evType === 'admin:user:banned' || evType === 'admin:user:unbanned') {
            onUserBanToggleRef.current?.(data);
          } else if (evType === 'admin:announcement:dispatched') {
            onAnnouncementDispatchedRef.current?.(data);
          }

          onAdminEventRef.current?.(evType, data);
        } catch (err) {
          console.warn(`Error parsing SSE data for admin event ${evType}:`, err);
        }
      };

      for (const evType of ADMIN_SYNC_EVENT_TYPES) {
        es.addEventListener(evType, (event: MessageEvent) => {
          handleEventData(evType, event);
        });
      }

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
  }, [enabled, updateLastEventId]);

  return {
    syncStatus,
    lastSyncTime,
    broadcastAdminLocal,
  };
}
