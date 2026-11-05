import { NextRequest, NextResponse } from 'next/server';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { db } from '@/lib/db';
import { profiles, deviceTokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const GoogleNativeAuthSchema = z.object({
  idToken: z.string().min(20, 'Invalid Google ID token format'),
  deviceId: z.string().optional(),
  deviceModel: z.string().optional().default(''),
  appVersion: z.string().optional().default(''),
  fcmToken: z.string().optional(),
});

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'), {
  cacheMaxAge: 24 * 60 * 60 * 1000, // 24 hours caching
  cooldownDuration: 30 * 1000,
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => null);
    const parsed = GoogleNativeAuthSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request payload',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { idToken, deviceId, deviceModel, appVersion, fcmToken } = parsed.data;

    const allowedAudiences = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
    ].filter(Boolean) as string[];

    if (allowedAudiences.length === 0) {
      console.error('Fatal: Neither GOOGLE_CLIENT_ID nor GOOGLE_ANDROID_CLIENT_ID is configured.');
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'SERVER_CONFIGURATION_ERROR',
            message: 'Google OAuth configuration missing on server',
          },
        },
        { status: 500 }
      );
    }

    // Verify Google ID token cryptographically against Google JWKS
    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: allowedAudiences,
    });

    const sub = payload.sub;
    const email = payload.email as string | undefined;
    const name = (payload.name as string) || 'Scholar Student';
    const picture = (payload.picture as string) || '';

    if (!sub || !email) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Token payload missing required identity claims (sub, email)',
          },
        },
        { status: 401 }
      );
    }

    // Retrieve or provision student profile
    let [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, sub))
      .limit(1);

    if (!profile) {
      const [inserted] = await db
        .insert(profiles)
        .values({
          userId: sub,
          email,
          fullName: name,
          avatarUrl: picture,
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
        })
        .returning();
      profile = inserted;
    }

    // Fail-closed authorization: reject banned users
    if (profile.isBanned) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'ACCOUNT_BANNED',
            message: profile.bannedReason || 'Account is suspended',
          },
        },
        { status: 403 }
      );
    }

    // Optional device token association during native login
    if (fcmToken && deviceId) {
      await db
        .insert(deviceTokens)
        .values({
          userId: sub,
          fcmToken,
          deviceId,
          platform: 'android',
          deviceModel: deviceModel || '',
          appVersion: appVersion || '',
          isActive: true,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [deviceTokens.userId, deviceTokens.deviceId],
          set: {
            fcmToken,
            deviceModel: deviceModel || '',
            appVersion: appVersion || '',
            isActive: true,
            lastUsedAt: new Date(),
            updatedAt: new Date(),
          },
        });
    }

    // Mint authoritative sp_session JWT
    const authSecret = process.env.AUTH_SECRET;
    if (!authSecret || authSecret.length < 32) {
      console.error('Fatal: AUTH_SECRET missing or insufficient length');
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'SERVER_CONFIGURATION_ERROR', message: 'Auth secret misconfigured' },
        },
        { status: 500 }
      );
    }

    const secretKey = new TextEncoder().encode(authSecret);
    const sessionToken = await new SignJWT({
      uid: sub,
      email,
      name,
      avatarUrl: picture,
      isBanned: false,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secretKey);

    const userPayload = {
      uid: sub,
      email,
      name,
      avatarUrl: picture,
      onboardingCompleted: profile.onboardingCompleted,
    };

    const response = NextResponse.json({
      success: true,
      sessionToken,
      user: userPayload,
      data: {
        sessionToken,
        user: userPayload,
      },
      error: null,
    });

    // Set HTTP-Only secure session cookie for Android WebView synchronization
    response.cookies.set('sp_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Native Google auth verification error:', error.message);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: 'AUTH_VERIFICATION_FAILED',
          message: 'Failed to verify Google identity',
        },
      },
      { status: 401 }
    );
  }
}
