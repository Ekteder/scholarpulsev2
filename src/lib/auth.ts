import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db/index';
import { profiles, adminAllowlist } from './db/schema';
import { eq } from 'drizzle-orm';

const AUTH_SECRET = process.env.AUTH_SECRET || 'scholarpulse-v2-super-secure-production-secret-key-32chars';
const SECRET_KEY = new TextEncoder().encode(AUTH_SECRET);
const COOKIE_NAME = 'sp_session';

export interface SessionUser {
  uid: string;
  email: string;
  name: string;
  avatarUrl?: string;
  isBanned?: boolean;
}

export function getGoogleOAuthURL(redirectUri: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('Missing GOOGLE_CLIENT_ID environment variable.');
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    access_type: 'offline',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCodeForUser(code: string, redirectUri: string): Promise<SessionUser> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variable.');
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error('Failed to exchange code:', errText);
    throw new Error('Google token exchange failed');
  }

  const tokenData = await tokenRes.json();
  const idToken = tokenData.id_token;
  if (!idToken) {
    throw new Error('Missing id_token in Google OAuth response');
  }

  // Fetch or decode user profile info
  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  let sub = '';
  let email = '';
  let name = '';
  let picture = '';

  if (userInfoRes.ok) {
    const userInfo = await userInfoRes.json();
    sub = userInfo.sub;
    email = userInfo.email;
    name = userInfo.name || 'Scholar Student';
    picture = userInfo.picture || '';
  } else {
    // Decode id_token payload
    const parts = idToken.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    sub = payload.sub;
    email = payload.email;
    name = payload.name || 'Scholar Student';
    picture = payload.picture || '';
  }

  // Ensure profile exists in database
  const existing = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, sub))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(profiles).values({
      userId: sub,
      email: email || 'student@scholarpulse.edu',
      fullName: name || 'Student Scholar',
      avatarUrl: picture || '',
      dailyStudyTargetMinutes: 360,
      preferredStudyTime: 'evening',
      timezone: 'Asia/Dhaka',
      themePreference: 'light',
      pomodoroFocusMinutes: 25,
      pomodoroShortBreakMinutes: 5,
      pomodoroLongBreakMinutes: 15,
      pomodoroLongBreakInterval: 4,
      onboardingCompleted: false,
      targetExamName: 'HSC 2027',
      targetExamDate: '2027-06-01',
    });
  }

  return {
    uid: sub,
    email,
    name,
    avatarUrl: picture,
  };
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(SECRET_KEY);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    const uid = payload.uid as string;
    const email = payload.email as string;
    const name = payload.name as string;
    const avatarUrl = (payload.avatarUrl as string) || '';

    let isBanned = false;
    try {
      const userProfile = await db
        .select({ isBanned: profiles.isBanned })
        .from(profiles)
        .where(eq(profiles.userId, uid))
        .limit(1);

      if (userProfile.length > 0 && userProfile[0].isBanned) {
        isBanned = true;
      }
    } catch {
      // safe fallback if db is momentarily unreachable or table being migrated
    }

    return {
      uid,
      email,
      name,
      avatarUrl,
      isBanned,
    };
  } catch {
    return null;
  }
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete({
    name: COOKIE_NAME,
    path: '/',
  });
  cookieStore.set(COOKIE_NAME, '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
}

/**
 * Checks whether the given user has administrator privileges.
 * 1. Checks comma-separated list of emails in process.env.ADMIN_EMAILS
 * 2. Checks admin_allowlist table in the PostgreSQL database
 */
export async function isUserAdmin(user: SessionUser | null): Promise<boolean> {
  if (!user || !user.email) return false;
  const normalizedEmail = user.email.toLowerCase().trim();

  // 1. Check environment variable allowlist
  const envAdmins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);

  if (envAdmins.includes(normalizedEmail)) {
    return true;
  }

  // 2. Query database admin_allowlist table
  try {
    const existing = await db
      .select()
      .from(adminAllowlist)
      .where(eq(adminAllowlist.email, normalizedEmail))
      .limit(1);

    return existing.length > 0;
  } catch (error) {
    console.error('Error verifying admin authorization in admin_allowlist:', error);
    return false;
  }
}

/**
 * Validates session and admin authorization.
 * If unauthorized, redirects to /?authError=unauthorized_admin or throws an Error.
 */
export async function requireAdminUser(
  options?: { redirect?: boolean } | boolean
): Promise<SessionUser> {
  const shouldRedirect =
    typeof options === 'boolean' ? options : (options?.redirect ?? true);

  const user = await getCurrentUser();
  if (!user || user.isBanned || !(await isUserAdmin(user))) {
    if (shouldRedirect) {
      try {
        redirect('/?authError=unauthorized_admin');
      } catch (err: unknown) {
        const redirectErr = err as { digest?: string; message?: string };
        if (
          redirectErr?.digest?.startsWith('NEXT_REDIRECT') ||
          redirectErr?.message === 'NEXT_REDIRECT'
        ) {
          throw err;
        }
        throw new Error('Unauthorized: Admin access required');
      }
    }
    throw new Error('Unauthorized: Admin access required');
  }

  return user;
}

