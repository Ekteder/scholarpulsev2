'use server';

import { getCurrentUser, clearSession, getGoogleOAuthURL } from '@/lib/auth';
import { db } from '@/lib/db';
import { deviceTokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function getCurrentUserAction() {
  return await getCurrentUser();
}

export async function getGoogleOAuthUrlAction(origin: string) {
  const redirectUri = `${origin}/api/auth/google/callback`;
  return getGoogleOAuthURL(redirectUri);
}

export async function signOutAction() {
  try {
    const user = await getCurrentUser();
    if (user?.uid) {
      // Deactivate all device tokens for this user on logout
      await db
        .update(deviceTokens)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(deviceTokens.userId, user.uid));
    }
  } catch (err) {
    console.error('Failed to deactivate device tokens on logout:', err);
  }

  await clearSession();
  return { success: true };
}
