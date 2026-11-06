import 'server-only';
import { SignJWT, importPKCS8 } from 'jose';
import { db } from './db';
import { deviceTokens } from './db/schema';
import { and, eq } from 'drizzle-orm';

interface ServiceAccountCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export interface SendFCMParams {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: 'high' | 'normal';
  channelId?: string;
}

export interface SendFCMResult {
  success: boolean;
  messageId?: string;
  error?: string;
  isTokenInvalid?: boolean;
}

export interface MulticastPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: 'high' | 'normal';
  channelId?: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function getServiceAccountCredentials(): ServiceAccountCredentials | null {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      const projectId = parsed.project_id || parsed.projectId;
      const clientEmail = parsed.client_email || parsed.clientEmail;
      const privateKey = parsed.private_key || parsed.privateKey;

      if (clientEmail && privateKey && projectId) {
        return {
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        };
      }
    } catch (e) {
      console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', e);
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKeyRaw) {
    return {
      projectId,
      clientEmail,
      privateKey: privateKeyRaw.replace(/\\n/g, '\n'),
    };
  }

  return null;
}

/**
 * Mint and cache Google Cloud OAuth2 access token targeting Firebase Cloud Messaging v1.
 * Caches token until 5 minutes before expiration.
 */
export async function getFCMToken(): Promise<{ token: string; projectId: string }> {
  const creds = getServiceAccountCredentials();
  if (!creds) {
    throw new Error(
      'FCM credentials missing. Provide either FIREBASE_SERVICE_ACCOUNT JSON or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.'
    );
  }

  // Token cache check: reuse if at least 5 minutes remain before expiry
  const fiveMinutesMs = 5 * 60 * 1000;
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt - fiveMinutesMs) {
    return { token: cachedAccessToken.token, projectId: creds.projectId };
  }

  const privateKey = await importPKCS8(creds.privateKey, 'RS256');
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({
    iss: creds.clientEmail,
    sub: creds.clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to obtain Google Cloud OAuth token for FCM: ${errText}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };

  return { token: cachedAccessToken.token, projectId: creds.projectId };
}

/**
 * Dispatch an individual push notification to a target FCM device token via FCM HTTP v1.
 * Automatically deactivates token in database if unregistered or invalid.
 */
export async function sendFCMNotification(params: SendFCMParams): Promise<SendFCMResult> {
  try {
    const { token: accessToken, projectId } = await getFCMToken();
    const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const payload = {
      message: {
        token: params.token,
        android: {
          priority: 'high',
        },
        data: {
          title: params.title,
          body: params.body,
          channelId: params.channelId || 'announcements_channel',
          ...params.data,
        },
      },
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const resJson = (await res.json().catch(() => ({}))) as { name?: string };
      return { success: true, messageId: resJson.name };
    }

    const statusCode = res.status;
    let isDeadToken = statusCode === 404;
    let errorMessage = `FCM send failed with status ${statusCode}`;

    try {
      const errJson = await res.json();
      errorMessage = JSON.stringify(errJson);
      const details = errJson?.error?.details as Array<{ errorCode?: string }> | undefined;
      const errorCode = details?.[0]?.errorCode;
      if (
        errorCode === 'UNREGISTERED' ||
        errorCode === 'INVALID_ARGUMENT' ||
        errJson?.error?.status === 'NOT_FOUND'
      ) {
        isDeadToken = true;
      }
    } catch {
      // JSON parse fallback
    }

    if (isDeadToken) {
      try {
        await db
          .update(deviceTokens)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(deviceTokens.fcmToken, params.token));
      } catch (dbErr) {
        console.error('Failed to prune dead FCM token from database:', dbErr);
      }
    }

    return {
      success: false,
      error: errorMessage,
      isTokenInvalid: isDeadToken,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Queries all active device tokens for a user and dispatches notifications concurrently.
 */
export async function sendMulticastFCM(
  userId: string,
  payload: MulticastPayload
): Promise<{ sent: number; failed: number }> {
  const activeTokens = await db
    .select({ fcmToken: deviceTokens.fcmToken })
    .from(deviceTokens)
    .where(and(eq(deviceTokens.userId, userId), eq(deviceTokens.isActive, true)));

  if (activeTokens.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  const results = await Promise.allSettled(
    activeTokens.map(({ fcmToken }) =>
      sendFCMNotification({
        token: fcmToken,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        priority: payload.priority,
        channelId: payload.channelId,
      })
    )
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Backwards/spec compatibility alias for sendMulticastFCM.
 */
export const sendFcmNotificationToUser = sendMulticastFCM;

/**
 * Dispatch a broadcast push notification to an FCM topic (e.g. 'announcements_global') via FCM HTTP v1.
 * High-performance: single request delivers to all subscribed devices without looping device tokens.
 */
export async function sendTopicFCM(
  topic: string,
  payload: MulticastPayload
): Promise<SendFCMResult> {
  try {
    const { token: accessToken, projectId } = await getFCMToken();
    const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    const cleanTopic = topic.replace(/^\/topics\//, '');

    const bodyPayload = {
      message: {
        topic: cleanTopic,
        android: {
          priority: 'high',
        },
        data: {
          title: payload.title,
          body: payload.body,
          channelId: payload.channelId || 'announcements_channel',
          type: payload.data?.type || 'announcement',
          ...payload.data,
        },
      },
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
    });

    if (res.ok) {
      const resJson = (await res.json().catch(() => ({}))) as { name?: string };
      return { success: true, messageId: resJson.name };
    }

    const errText = await res.text();
    return { success: false, error: `Topic send failed (${res.status}): ${errText}` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

