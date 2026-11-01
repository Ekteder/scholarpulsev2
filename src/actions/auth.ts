'use server';

import { getCurrentUser, clearSession, getGoogleOAuthURL } from '@/lib/auth';
import { redirect } from 'next/navigation';

export async function getCurrentUserAction() {
  return await getCurrentUser();
}

export async function getGoogleOAuthUrlAction(origin: string) {
  const redirectUri = `${origin}/api/auth/google/callback`;
  return getGoogleOAuthURL(redirectUri);
}

export async function signOutAction() {
  await clearSession();
  redirect('/');
}
