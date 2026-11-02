import crypto from 'crypto';
import type { BrowserContext } from '@playwright/test';

export interface TestSessionUser {
  uid: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export const DEFAULT_AUTH_SECRET =
  process.env.AUTH_SECRET || 'scholarpulse-v2-super-secure-production-secret-key-32chars';

export const ADMIN_USER: TestSessionUser = {
  uid: 'admin-test-uid-001',
  email: 'admin@scholarpulse.edu',
  name: 'ScholarPulse Admin',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop',
};

export const SUPERADMIN_USER: TestSessionUser = {
  uid: 'superadmin-test-uid-002',
  email: 'ekteder.sanglap@gmail.com',
  name: 'Iktidar Sanglap (Superadmin)',
};

export const UNAUTHORIZED_USER: TestSessionUser = {
  uid: 'student-test-uid-003',
  email: 'regular.student@scholarpulse.edu',
  name: 'Regular Student',
};

/**
 * Creates a cryptographically signed HMAC-SHA256 JWT cookie value matching Jose's SignJWT
 * with exp, iat, and custom user payload.
 */
export function createTestSessionToken(
  user: TestSessionUser,
  secret: string = DEFAULT_AUTH_SECRET,
  expiresInSeconds: number = 30 * 24 * 60 * 60
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    ...user,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const base64Url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const headerB64 = base64Url(header);
  const payloadB64 = base64Url(payload);

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Creates an expired JWT token for security rejection tests.
 */
export function createExpiredSessionToken(
  user: TestSessionUser = ADMIN_USER,
  secret: string = DEFAULT_AUTH_SECRET
): string {
  return createTestSessionToken(user, secret, -3600); // 1 hour in the past
}

/**
 * Creates a tampered / invalid-signature JWT token.
 */
export function createTamperedSessionToken(user: TestSessionUser = ADMIN_USER): string {
  const token = createTestSessionToken(user, 'wrong-secret-signature-key-123456');
  return token;
}

/**
 * Injects session cookie into Playwright BrowserContext.
 */
export async function injectSessionCookie(
  context: BrowserContext,
  token: string,
  url?: string
): Promise<void> {
  const envBaseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000';
  const targetUrl = url && url.startsWith('http') && !url.startsWith('about:') ? url : envBaseUrl;
  const parsed = new URL(targetUrl);
  await context.addCookies([
    {
      name: 'sp_session',
      value: token,
      domain: parsed.hostname,
      path: '/',
      httpOnly: true,
      secure: parsed.protocol === 'https:',
      sameSite: 'Lax',
    },
  ]);
}

/**
 * Authenticates the Playwright browser context as an allowlisted administrator.
 */
export async function loginAsAdmin(
  context: BrowserContext,
  user: TestSessionUser = ADMIN_USER,
  url?: string
): Promise<string> {
  const token = createTestSessionToken(user);
  await injectSessionCookie(context, token, url);
  return token;
}

/**
 * Authenticates the Playwright browser context as an unauthorized student.
 */
export async function loginAsUnauthorizedUser(
  context: BrowserContext,
  user: TestSessionUser = UNAUTHORIZED_USER,
  url?: string
): Promise<string> {
  const token = createTestSessionToken(user);
  await injectSessionCookie(context, token, url);
  return token;
}
