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
import { publishSyncEvent } from '@/lib/realtime';
import { revalidatePath } from 'next/cache';

async function requireUser() {
  const user = await getCurrentUser();
  if (!user || user.isBanned) {
    throw new Error(user?.isBanned ? 'Account is banned' : 'Unauthorized');
  }
  return user;
}

export async function getInitialWorkspaceSessionAction() {
  let user = null;
  try {
    user = await getCurrentUser();
    if (!user) {
      return { success: true, user: null, data: null };
    }
    if (user.isBanned) {
      return { success: true, user, data: null };
    }
    const data = await Promise.race([
      getUserWorkspaceData(user.uid, user.email, user.name),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Workspace loading timed out. Please retry.')), 8000)
      ),
    ]);
    return { success: true, user, data };
  } catch (err: any) {
    console.error('getInitialWorkspaceSessionAction error:', err);
    return {
      success: false,
      user,
      data: null,
      error: err?.message || 'Failed to verify workspace session.',
    };
  }
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
  const initialSubjects = (parsed.initialSubjects || []).map((s, idx) => {
    if (typeof s === 'string') {
      return {
        name: s,
        description: '',
        color: colors[idx % colors.length],
        icon: 'BookOpen',
        dailyTargetMinutes: 60,
        weeklyTargetMinutes: 300,
      };
    }
    return {
      name: s.name,
      description: s.description || '',
      color: s.color || colors[idx % colors.length],
      icon: s.icon || 'BookOpen',
      dailyTargetMinutes: s.dailyTargetMinutes ?? 60,
      weeklyTargetMinutes: s.weeklyTargetMinutes ?? 300,
    };
  });
  await completeUserOnboarding(user.uid, user.email, {
    ...parsed,
    initialSubjects,
  });
  const clientDeviceId = (raw as any)?.clientDeviceId;
  const data = await getUserWorkspaceData(user.uid, user.email, parsed.fullName);

  await publishSyncEvent({
    userId: user.uid,
    eventType: 'workspace:refresh',
    payload: {},
    clientDeviceId,
  });

  revalidatePath('/');
  return { success: true, data };
}

export async function updateProfileAction(raw: unknown) {
  const user = await requireUser();
  const parsed = ProfileUpdateSchema.parse(raw);
  const clientDeviceId = (raw as any)?.clientDeviceId;
  const profile = await updateUserProfile(user.uid, parsed);

  if (profile) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'profile:update',
      payload: { profile },
      clientDeviceId,
    });
  }

  return { success: true, profile };
}

export async function updateThemePreferenceAction(
  theme: 'light' | 'dark' | 'system',
  clientDeviceId?: string
) {
  const user = await requireUser();
  if (theme !== 'light' && theme !== 'dark' && theme !== 'system') {
    throw new Error('Invalid theme preference');
  }
  const profile = await updateUserProfile(user.uid, { themePreference: theme });

  if (profile) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'profile:update',
      payload: { profile },
      clientDeviceId,
    });
  }

  return { success: true, profile };
}

export async function updateNotificationPreferencesAction(raw: unknown) {
  const user = await requireUser();
  const parsed = NotificationPreferencesSchema.parse(raw);
  const clientDeviceId = (raw as any)?.clientDeviceId;
  const prefs = await updateUserNotificationPreferences(user.uid, parsed);

  if (prefs) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'preferences:update',
      payload: { preferences: prefs },
      clientDeviceId,
    });
  }

  revalidatePath('/');
  return { success: true, preferences: prefs };
}

export async function restoreBackupAction(raw: unknown) {
  const user = await requireUser();
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid backup format');
  }
  const payload = raw as any;
  const clientDeviceId = payload?.clientDeviceId;
  await restoreUserDataFromBackup(user.uid, user.email, {
    mode: payload.mode || 'replace',
    ...payload,
  });
  const data = await getUserWorkspaceData(user.uid, user.email, user.name);

  await publishSyncEvent({
    userId: user.uid,
    eventType: 'workspace:refresh',
    payload: {},
    clientDeviceId,
  });

  revalidatePath('/');
  return { success: true, data };
}

export async function deleteAccountAction() {
  const user = await requireUser();
  await deleteUserEntireAccount(user.uid);
  revalidatePath('/');
  return { success: true };
}
