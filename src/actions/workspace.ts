'use server';

import { getCurrentUser } from '@/lib/auth';
import {
  getUserWorkspaceData,
  completeUserOnboarding,
  updateUserProfile,
  updateUserNotificationPreferences,
  restoreUserDataFromBackup,
  deleteUserEntireAccount,
} from '@/lib/db/repository';
import {
  OnboardingSchema,
  ProfileUpdateSchema,
  NotificationPreferencesSchema,
} from '@/lib/validations';
import { revalidatePath } from 'next/cache';

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function getWorkspaceDataAction() {
  const user = await requireUser();
  const data = await getUserWorkspaceData(user.uid, user.email, user.name);
  return { success: true, data };
}

export async function completeOnboardingAction(raw: unknown) {
  const user = await requireUser();
  const parsed = OnboardingSchema.parse(raw);
  const colors = ['#2563EB', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'];
  const initialSubjects = (parsed.initialSubjects || []).map((s, idx) => ({
    name: s,
    description: '',
    color: colors[idx % colors.length],
    icon: 'BookOpen',
    dailyTargetMinutes: 60,
    weeklyTargetMinutes: 300,
  }));
  await completeUserOnboarding(user.uid, user.email, {
    ...parsed,
    initialSubjects,
  });
  const data = await getUserWorkspaceData(user.uid, user.email, parsed.fullName);
  revalidatePath('/');
  return { success: true, data };
}

export async function updateProfileAction(raw: unknown) {
  const user = await requireUser();
  const parsed = ProfileUpdateSchema.parse(raw);
  const profile = await updateUserProfile(user.uid, parsed);
  revalidatePath('/');
  return { success: true, profile };
}

export async function updateNotificationPreferencesAction(raw: unknown) {
  const user = await requireUser();
  const parsed = NotificationPreferencesSchema.parse(raw);
  const prefs = await updateUserNotificationPreferences(user.uid, parsed);
  revalidatePath('/');
  return { success: true, preferences: prefs };
}

export async function restoreBackupAction(raw: unknown) {
  const user = await requireUser();
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid backup format');
  }
  const payload = raw as any;
  await restoreUserDataFromBackup(user.uid, user.email, {
    mode: payload.mode || 'replace',
    ...payload,
  });
  const data = await getUserWorkspaceData(user.uid, user.email, user.name);
  revalidatePath('/');
  return { success: true, data };
}

export async function deleteAccountAction() {
  const user = await requireUser();
  await deleteUserEntireAccount(user.uid);
  revalidatePath('/');
  return { success: true };
}
