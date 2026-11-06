import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { deviceTokens } from '@/lib/db/schema';
import { and, eq, ne, or } from 'drizzle-orm';

const DeviceTokenInputSchema = z
  .object({
    fcmToken: z.string().optional(),
    token: z.string().optional(),
    deviceId: z.string().min(1, 'deviceId is required'),
    platform: z.enum(['android', 'ios', 'web']).optional().default('android'),
    deviceModel: z.string().optional().default(''),
    appVersion: z.string().optional().default(''),
  })
  .transform((data) => ({
    ...data,
    fcmToken: data.fcmToken || data.token || '',
  }))
  .refine((data) => data.fcmToken.trim().length > 0, {
    message: 'fcmToken is required',
    path: ['fcmToken'],
  });

const DeviceTokenDeleteSchema = z
  .object({
    deviceId: z.string().optional(),
    fcmToken: z.string().optional(),
    token: z.string().optional(),
  })
  .transform((data) => ({
    deviceId: data.deviceId,
    fcmToken: data.fcmToken || data.token,
  }))
  .refine((data) => !!(data.deviceId || data.fcmToken), {
    message: 'Either deviceId or fcmToken must be specified',
  });

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    if (user.isBanned) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'ACCOUNT_BANNED',
            message: 'Account has been suspended',
          },
        },
        { status: 403 }
      );
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = DeviceTokenInputSchema.safeParse(rawBody);

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

    const { fcmToken, deviceId, platform, deviceModel, appVersion } = parsed.data;

    const tokenId = await db.transaction(async (tx) => {
      // 1. Cleanly remove any existing assignment of this hardware or FCM token across all users
      await tx
        .delete(deviceTokens)
        .where(
          or(
            eq(deviceTokens.fcmToken, fcmToken),
            and(eq(deviceTokens.userId, user.uid), eq(deviceTokens.deviceId, deviceId))
          )
        );

      // 2. Freshly attach the device to the newly authenticated student
      const [inserted] = await tx
        .insert(deviceTokens)
        .values({
          userId: user.uid,
          fcmToken,
          deviceId,
          platform,
          deviceModel,
          appVersion,
          isActive: true,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: deviceTokens.id });

      return inserted?.id;
    });

    return NextResponse.json({
      success: true,
      tokenId,
      data: {
        success: true,
        tokenId,
      },
      error: null,
    });
  } catch (error) {
    console.error('Error registering device token:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to register device token',
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    // Try reading query parameters first
    const searchParams = req.nextUrl.searchParams;
    const queryDeviceId = searchParams.get('deviceId') || undefined;
    const queryFcmToken = searchParams.get('fcmToken') || searchParams.get('token') || undefined;

    // Also support JSON body if query parameters were not passed
    let bodyDeviceId: string | undefined;
    let bodyFcmToken: string | undefined;

    if (!queryDeviceId && !queryFcmToken) {
      const rawBody = await req.json().catch(() => null);
      if (rawBody && typeof rawBody === 'object') {
        const parsedBody = DeviceTokenDeleteSchema.safeParse(rawBody);
        if (parsedBody.success) {
          bodyDeviceId = parsedBody.data.deviceId;
          bodyFcmToken = parsedBody.data.fcmToken;
        }
      }
    }

    const deviceId = queryDeviceId || bodyDeviceId;
    const fcmToken = queryFcmToken || bodyFcmToken;

    if (!deviceId && !fcmToken) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Must provide either deviceId or fcmToken as query parameter or body',
          },
        },
        { status: 400 }
      );
    }

    // Construct deactivate filter strictly bounded by user ID
    if (deviceId && fcmToken) {
      await db
        .update(deviceTokens)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(deviceTokens.userId, user.uid),
            or(eq(deviceTokens.deviceId, deviceId), eq(deviceTokens.fcmToken, fcmToken))
          )
        );
    } else if (deviceId) {
      await db
        .update(deviceTokens)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(deviceTokens.userId, user.uid),
            eq(deviceTokens.deviceId, deviceId)
          )
        );
    } else if (fcmToken) {
      await db
        .update(deviceTokens)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(deviceTokens.userId, user.uid),
            eq(deviceTokens.fcmToken, fcmToken)
          )
        );
    }

    return NextResponse.json({
      success: true,
      data: {
        success: true,
        deactivated: true,
      },
      error: null,
    });
  } catch (error) {
    console.error('Error deactivating device token:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to deactivate device token',
        },
      },
      { status: 500 }
    );
  }
}
