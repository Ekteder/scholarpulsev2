'use server';

import { getCurrentUser, isUserAdmin } from '@/lib/auth';

/**
 * Checks whether the currently authenticated session belongs to an allowlisted administrator.
 * Safe to invoke from client components (returns boolean, does not redirect).
 */
export async function checkIsAdminAction(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) return false;
    return await isUserAdmin(user);
  } catch (error) {
    console.error('Failed to verify admin status in checkIsAdminAction:', error);
    return false;
  }
}
