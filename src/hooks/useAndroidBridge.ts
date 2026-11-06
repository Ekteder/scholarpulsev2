'use client';

import { useEffect, useCallback, useSyncExternalStore } from 'react';

export type BridgeErrorCode =
  | 'E_UNAUTHORIZED_ORIGIN'
  | 'E_INVALID_PARAMS'
  | 'E_PERMISSION_DENIED'
  | 'E_AUTH_CANCELLED'
  | 'E_AUTH_FAILED'
  | 'E_SERVICE_UNAVAILABLE'
  | 'E_TIMEOUT'
  | 'E_INTERNAL_ERROR'
  | string;

export interface BridgeRequest<T = unknown> {
  id: string;          // Cryptographically unique correlation ID
  method: string;      // Namespace.action format (e.g. 'timer.start')
  params: T;           // Typed parameter payload object
  timestamp: number;   // Epoch timestamp in milliseconds
}

export interface BridgeResponse<T = unknown> {
  id: string;          // Matches the request ID
  success: boolean;    // Execution status flag
  result?: T;          // Typed return data on success
  error?: {
    code: BridgeErrorCode; // Standardized error identifier
    message: string;       // Human-readable diagnostic description
    details?: unknown;     // Optional debug metadata
  };
}

export interface NativeEvent<T = unknown> {
  event: string;       // Event identifier (e.g. 'timer.tick')
  payload: T;          // Structured event payload
  timestamp: number;   // Epoch timestamp in milliseconds
}

export interface StartForegroundTimerParams {
  subjectId: string;
  topic: string;
  notes?: string | null;
  mode: 'stopwatch' | 'pomodoro' | string;
  targetDurationSeconds: number;
  idempotencyKey: string;
  accumulatedSeconds?: number;
  phase?: string;
}

export interface StopForegroundTimerParams {
  productivityRating?: number | null;
  notes?: string | null;
  discard?: boolean;
}

export type TriggerHapticStyle =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error';

export interface SendNotificationParams {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface SyncScheduleAlarmsParams {
  schedules: Array<{
    id: string;
    subjectId: string;
    subjectName?: string;
    dayOfWeek: number;
    startTime: string;
  }>;
  dailyReminderTime?: string;
  dailyTargetMinutes?: number;
}

export interface DeviceInfoResult {
  platform: 'android';
  osVersion: number;
  appVersion: string;
  deviceId: string;
  fcmToken?: string;
  hasNotificationPermission: boolean;
  hasExactAlarmPermission: boolean;
  safeAreaInsets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

type PendingEntry = {
  resolve: (res: unknown) => void;
  reject: (err: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

// Singleton collections to ensure persistence and consistency across hook consumers
const pendingRequests = new Map<string, PendingEntry>();
const eventSubscribers = new Map<string, Set<(payload: unknown) => void>>();

/**
 * Synchronously checks whether the native Android shell bridge is present on window.
 */
export function isBridgeAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as unknown as { nativeBridge?: { postMessage?: unknown } }).nativeBridge?.postMessage ||
    (window as unknown as { __ScholarPulseNativeBridge?: { postMessage?: unknown } }).__ScholarPulseNativeBridge?.postMessage ||
    (window as unknown as { ScholarPulseBridge?: { postMessage?: unknown } }).ScholarPulseBridge?.postMessage ||
    (window as unknown as { AndroidBridge?: { postMessage?: unknown } }).AndroidBridge?.postMessage ||
    (window as unknown as { nativeBridge?: unknown }).nativeBridge ||
    (window as unknown as { __ScholarPulseNativeBridge?: unknown }).__ScholarPulseNativeBridge ||
    (window as unknown as { ScholarPulseBridge?: unknown }).ScholarPulseBridge ||
    (window as unknown as { AndroidBridge?: unknown }).AndroidBridge
  );
}

export interface NativeTimerSyncState {
  lastFinishedIdempotencyKey?: string | null;
  pendingReview?: {
    idempotencyKey: string;
    subjectId: string;
    topic: string;
    durationSeconds: number;
    finishedAt: number;
  } | null;
}

export function getNativeTimerSyncState(): NativeTimerSyncState | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const win = window as unknown as {
    AndroidBridge?: { getNativeTimerSyncState?: () => string };
    __ScholarPulseNativeBridge?: { getNativeTimerSyncState?: () => string };
    ScholarPulseBridge?: { getNativeTimerSyncState?: () => string };
    nativeBridge?: { getNativeTimerSyncState?: () => string };
  };
  const bridge = win.AndroidBridge || win.__ScholarPulseNativeBridge || win.ScholarPulseBridge || win.nativeBridge;
  if (!bridge?.getNativeTimerSyncState) {
    return null;
  }
  try {
    const raw = bridge.getNativeTimerSyncState();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const pendingReview = parsed.pendingReview
      ? (typeof parsed.pendingReview === 'string' ? JSON.parse(parsed.pendingReview) : parsed.pendingReview)
      : null;
    return {
      lastFinishedIdempotencyKey: parsed.lastFinishedIdempotencyKey || null,
      pendingReview,
    };
  } catch (err) {
    console.warn('[useAndroidBridge] Failed to read native timer sync state:', err);
    return null;
  }
}

export function acknowledgeNativeReview(idempotencyKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    const win = window as unknown as {
      AndroidBridge?: { acknowledgePendingReview?: (key: string) => void };
      __ScholarPulseNativeBridge?: { acknowledgePendingReview?: (key: string) => void };
      ScholarPulseBridge?: { acknowledgePendingReview?: (key: string) => void };
      nativeBridge?: { acknowledgePendingReview?: (key: string) => void };
    };
    const bridge = win.AndroidBridge || win.__ScholarPulseNativeBridge || win.ScholarPulseBridge || win.nativeBridge;
    if (bridge?.acknowledgePendingReview) {
      bridge.acknowledgePendingReview(idempotencyKey);
    }
  } catch (err) {
    console.warn('[useAndroidBridge] Failed to acknowledge native review:', err);
  }
}

/**
 * Safely sends a JSON string payload to the native Android host via available bridge channel.
 */
function postToNative(messageJson: string): boolean {
  if (typeof window === 'undefined') return false;

  const win = window as unknown as {
    nativeBridge?: { postMessage?: (msg: string) => void };
    __ScholarPulseNativeBridge?: { postMessage?: (msg: string) => void };
    ScholarPulseBridge?: { postMessage?: (msg: string) => void };
  };

  // 1. Primary Channel: WebViewCompat.addWebMessageListener (window.nativeBridge)
  if (typeof win.nativeBridge?.postMessage === 'function') {
    win.nativeBridge.postMessage(messageJson);
    return true;
  }

  // 2. Fallback Channel: @JavascriptInterface (window.__ScholarPulseNativeBridge)
  if (typeof win.__ScholarPulseNativeBridge?.postMessage === 'function') {
    win.__ScholarPulseNativeBridge.postMessage(messageJson);
    return true;
  }

  // 3. Alternative Fallback: window.ScholarPulseBridge
  if (typeof win.ScholarPulseBridge?.postMessage === 'function') {
    win.ScholarPulseBridge.postMessage(messageJson);
    return true;
  }

  return false;
}

/**
 * Initializes the global window dispatcher listener if not already initialized.
 */
function initDispatcher(): void {
  if (typeof window === 'undefined') return;

  const win = window as unknown as {
    __SCHOLARPULSE_NATIVE_DISPATCHER__?: (rawPayload: string | object) => void;
    nativeBridge?: { onmessage?: (event: MessageEvent) => void };
  };

  if (!win.__SCHOLARPULSE_NATIVE_DISPATCHER__) {
    win.__SCHOLARPULSE_NATIVE_DISPATCHER__ = (rawPayload: string | object) => {
      try {
        const data = (typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload) as {
          id?: string;
          success?: boolean;
          result?: unknown;
          error?: { code?: string; message?: string; details?: unknown };
          event?: string;
          payload?: unknown;
        };

        if (!data || typeof data !== 'object') return;

        // Route correlation response (JSON-RPC)
        if (data.id && pendingRequests.has(data.id)) {
          const entry = pendingRequests.get(data.id)!;
          clearTimeout(entry.timeoutId);
          pendingRequests.delete(data.id);

          if (data.success) {
            entry.resolve(data.result);
          } else {
            const errCode = data.error?.code || 'E_INTERNAL_ERROR';
            const errMsg = data.error?.message || `Bridge Error: ${errCode}`;
            const error = new Error(errMsg);
            (error as unknown as { code: string; details?: unknown }).code = errCode;
            (error as unknown as { code: string; details?: unknown }).details = data.error?.details;
            entry.reject(error);
          }
          return;
        }

        // Route unsolicited event
        if (data.event && eventSubscribers.has(data.event)) {
          const subscribers = eventSubscribers.get(data.event);
          if (subscribers) {
            subscribers.forEach((callback) => {
              try {
                callback(data.payload);
              } catch (cbErr) {
                console.error('[ScholarPulse Bridge] Event callback error:', cbErr);
              }
            });
          }
        }
      } catch (err) {
        console.error('[ScholarPulse Bridge] Dispatcher Error:', err);
      }
    };
  }

  // Support WebMessageListener onmessage forwarding
  if (win.nativeBridge && !win.nativeBridge.onmessage) {
    try {
      win.nativeBridge.onmessage = (event: MessageEvent) => {
        if (win.__SCHOLARPULSE_NATIVE_DISPATCHER__) {
          win.__SCHOLARPULSE_NATIVE_DISPATCHER__(event.data);
        }
      };
    } catch {
      // Ignored if nativeBridge is non-writable
    }
  }
}

const emptySubscribe = () => () => {};

export function useAndroidBridge() {
  const isAvailable = useSyncExternalStore(
    emptySubscribe,
    () => isBridgeAvailable(),
    () => false
  );

  useEffect(() => {
    initDispatcher();
  }, []);

  /**
   * Invokes a native method via typed JSON-RPC 2.0 with a 10-second timeout ceiling.
   * If running in a regular browser where the bridge is absent, safely rejects.
   */
  const invoke = useCallback(<T, R>(method: string, params: T = {} as T): Promise<R> => {
    return new Promise<R>((resolve, reject) => {
      if (typeof window === 'undefined') {
        return reject(new Error('Window context unavailable'));
      }

      if (!isBridgeAvailable()) {
        return reject(new Error('Native Android bridge not available'));
      }

      const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? `req_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
        : `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const request: BridgeRequest<T> = {
        id,
        method,
        params,
        timestamp: Date.now(),
      };

      // 10-second timeout ceiling
      const timeoutId = setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          const timeoutErr = new Error(`Bridge request timed out: ${method}`);
          (timeoutErr as unknown as { code: string }).code = 'E_TIMEOUT';
          reject(timeoutErr);
        }
      }, 10000);

      pendingRequests.set(id, {
        resolve: resolve as (res: unknown) => void,
        reject,
        timeoutId,
      });

      try {
        const posted = postToNative(JSON.stringify(request));
        if (!posted) {
          clearTimeout(timeoutId);
          pendingRequests.delete(id);
          reject(new Error('Native Android bridge not available'));
        }
      } catch (postErr) {
        clearTimeout(timeoutId);
        pendingRequests.delete(id);
        reject(postErr instanceof Error ? postErr : new Error(String(postErr)));
      }
    });
  }, []);

  /**
   * Subscribes to an unsolicited native event pushed by the Android host.
   * Returns an unsubscribe function.
   */
  const subscribe = useCallback(<T = unknown>(event: string, callback: (payload: T) => void): (() => void) => {
    if (!eventSubscribers.has(event)) {
      eventSubscribers.set(event, new Set());
    }
    const set = eventSubscribers.get(event)!;
    const typedCallback = callback as (payload: unknown) => void;
    set.add(typedCallback);

    return () => {
      const currentSet = eventSubscribers.get(event);
      if (currentSet) {
        currentSet.delete(typedCallback);
        if (currentSet.size === 0) {
          eventSubscribers.delete(event);
        }
      }
    };
  }, []);

  // --- Convenient Typed Helper Methods (Safely no-op in regular browsers) ---

  const startForegroundTimer = useCallback(
    async (params: StartForegroundTimerParams) => {
      if (!isBridgeAvailable()) return null;
      try {
        return await invoke<StartForegroundTimerParams, { started: boolean }>('timer.start', params);
      } catch {
        return null;
      }
    },
    [invoke]
  );

  const pauseForegroundTimer = useCallback(async () => {
    if (!isBridgeAvailable()) return null;
    try {
      return await invoke<Record<string, never>, { paused: boolean }>('timer.pause', {});
    } catch {
      return null;
    }
  }, [invoke]);

  const resumeForegroundTimer = useCallback(async () => {
    if (!isBridgeAvailable()) return null;
    try {
      return await invoke<Record<string, never>, { resumed: boolean }>('timer.resume', {});
    } catch {
      return null;
    }
  }, [invoke]);

  const stopForegroundTimer = useCallback(
    async (params: StopForegroundTimerParams = {}) => {
      if (!isBridgeAvailable()) return null;
      try {
        return await invoke<StopForegroundTimerParams, { stopped: boolean; finalDurationSeconds: number }>(
          'timer.stop',
          params
        );
      } catch {
        return null;
      }
    },
    [invoke]
  );

  const skipPomodoroPhase = useCallback(async () => {
    if (!isBridgeAvailable()) return null;
    try {
      return await invoke<Record<string, never>, { previousPhase: string; newPhase: string }>(
        'timer.skipPhase',
        {}
      );
    } catch {
      return null;
    }
  }, [invoke]);

  const triggerHaptic = useCallback(
    async (style: TriggerHapticStyle = 'light') => {
      if (!isBridgeAvailable()) return null;
      try {
        return await invoke<{ style: TriggerHapticStyle }, { success: boolean }>('haptics.vibrate', { style });
      } catch {
        return null;
      }
    },
    [invoke]
  );

  const sendNotification = useCallback(
    async (params: SendNotificationParams) => {
      if (!isBridgeAvailable()) return null;
      try {
        return await invoke<SendNotificationParams, { sent?: boolean; success?: boolean }>(
          'notifications.sendNotification',
          params
        );
      } catch {
        return null;
      }
    },
    [invoke]
  );

  const syncScheduleAlarms = useCallback(
    async (params: SyncScheduleAlarmsParams) => {
      if (!isBridgeAvailable()) return null;
      try {
        return await invoke<SyncScheduleAlarmsParams, { armedAlarmCount: number }>(
          'notifications.syncScheduleAlarms',
          params
        );
      } catch {
        return null;
      }
    },
    [invoke]
  );

  const playNativeChime = useCallback(
    async (type: 'focus_start' | 'focus_end' | 'break_end' | 'achievement') => {
      if (!isBridgeAvailable()) return null;
      try {
        return await invoke<{ type: string }, { played: boolean }>('audio.playChime', { type });
      } catch {
        return null;
      }
    },
    [invoke]
  );

  const getDeviceInfo = useCallback(async (): Promise<DeviceInfoResult | null> => {
    if (!isBridgeAvailable()) return null;
    try {
      return await invoke<Record<string, never>, DeviceInfoResult>('device.getInfo', {});
    } catch {
      return null;
    }
  }, [invoke]);

  const openExternal = useCallback(
    async (url: string) => {
      if (!isBridgeAvailable()) return null;
      try {
        return await invoke<{ url: string }, { opened: boolean }>('navigation.openExternal', { url });
      } catch {
        return null;
      }
    },
    [invoke]
  );

  return {
    isAvailable,
    isNativeApp: isAvailable,
    invoke,
    subscribe,
    startForegroundTimer,
    pauseForegroundTimer,
    resumeForegroundTimer,
    stopForegroundTimer,
    skipPomodoroPhase,
    triggerHaptic,
    sendNotification,
    syncScheduleAlarms,
    playNativeChime,
    getDeviceInfo,
    openExternal,
  };
}
