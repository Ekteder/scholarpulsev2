'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminUser, isUserAdmin } from '@/lib/auth';
import {
  // Allowlist
  getAllAdminAllowlist,
  createAdminAllowlistEntry,
  deleteAdminAllowlistEntry,
  // Stages
  getAllCurriculumStages,
  saveAdminCurriculumStage,
  deleteAdminCurriculumStage,
  reorderCurriculumStages,
  // Goals
  getAllGoalTemplates,
  saveAdminGoalTemplate,
  deleteAdminGoalTemplate,
  // Schedules
  getAllScheduleTemplates,
  saveAdminScheduleTemplate,
  deleteAdminScheduleTemplate,
  // System Configurations
  getAllSystemConfigurations,
  saveAdminSystemConfiguration,
  deleteAdminSystemConfiguration,
  // Subjects, Papers, Topics (Global)
  getAllGlobalCurriculumSubjects,
  saveAdminCurriculumSubject,
  deleteAdminCurriculumSubject,
  getAllGlobalCurriculumPapers,
  saveAdminCurriculumPaper,
  deleteAdminCurriculumPaper,
  getAllGlobalCurriculumTopics,
  saveAdminCurriculumTopic,
  deleteAdminCurriculumTopic,
  // Achievements
  getAllAchievementsCatalog,
  saveAdminAchievement,
  deleteAdminAchievement,
  invalidateAchievementsCatalogCache,
  // User Management
  getAdminUsersList,
  getAdminUserDetail,
  updateAdminUserDetail,
  setAdminUserBanStatus,
  setAdminUserTargetedAnnouncement,
} from '@/lib/db/repository';
import { publishSyncEvent } from '@/lib/realtime';

// ==============================================================================
// Validation Schemas
// ==============================================================================

const AdminAllowlistSchema = z.object({
  email: z.string().email(),
  role: z.string().default('admin'),
  notes: z.string().optional().default(''),
});

const AdminStageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().default('#3B82F6'),
  badgeText: z.string().optional().default(''),
  displayOrder: z.number().int().default(0),
  weight: z.number().int().default(1),
  isActive: z.boolean().default(true),
});

const AdminGoalTemplateSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional().default(''),
  targetType: z.string().min(1),
  targetValue: z.number().int().positive(),
  period: z.string().min(1),
  isActive: z.boolean().default(true),
});

const AdminScheduleTemplateSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  subjectId: z.string().nullable().optional(),
  activityType: z.string().default('study'),
  isActive: z.boolean().default(true),
});

const AdminSubjectSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  code: z.string().optional().default(''),
  color: z.string().default('#2563EB'),
  icon: z.string().default('BookOpen'),
  displayOrder: z.number().int().default(0),
});

const AdminPaperSchema = z.object({
  id: z.string().optional(),
  subjectId: z.string().min(1),
  title: z.string().min(1),
  paperCode: z.string().optional().default(''),
  displayOrder: z.number().int().default(0),
});

const AdminTopicSchema = z.object({
  id: z.string().optional(),
  paperId: z.string().min(1),
  subjectId: z.string().min(1),
  title: z.string().min(1),
  chapterNumber: z.number().int().nullable().optional(),
  displayOrder: z.number().int().default(0),
});

const AdminAchievementSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  icon: z.string().default('Sparkles'),
  category: z.string().min(1),
  requirementType: z.string().min(1),
  requirementValue: z.number().int().positive(),
});

// ==============================================================================
// 1. Admin Allowlist Server Actions
// ==============================================================================

export async function getAdminAllowlistAction() {
  await requireAdminUser();
  const allowlist = await getAllAdminAllowlist();
  return { success: true, allowlist };
}

export async function addAdminAllowlistAction(raw: unknown) {
  const admin = await requireAdminUser();
  const parsed = AdminAllowlistSchema.parse(raw);
  const entry = await createAdminAllowlistEntry({
    ...parsed,
    addedBy: admin.email,
  });
  revalidatePath('/', 'layout');
  return { success: true, entry };
}

export async function removeAdminAllowlistAction(email: string) {
  await requireAdminUser();
  const deleted = await deleteAdminAllowlistEntry(email);
  revalidatePath('/', 'layout');
  return { success: true, deleted };
}

// ==============================================================================
// 2. Curriculum Stages Server Actions
// ==============================================================================

export async function getAdminCurriculumStagesAction() {
  await requireAdminUser();
  const stages = await getAllCurriculumStages();
  return { success: true, stages };
}

export async function saveAdminCurriculumStageAction(raw: unknown) {
  await requireAdminUser();
  const parsed = AdminStageSchema.parse(raw);
  const stage = await saveAdminCurriculumStage(parsed);
  revalidatePath('/', 'layout');
  return { success: true, stage };
}

export async function deleteAdminCurriculumStageAction(id: string) {
  await requireAdminUser();
  const deleted = await deleteAdminCurriculumStage(id);
  revalidatePath('/', 'layout');
  return { success: true, deleted };
}

export async function reorderAdminCurriculumStagesAction(stageIds: string[]) {
  await requireAdminUser();
  const stages = await reorderCurriculumStages(stageIds);
  revalidatePath('/', 'layout');
  return { success: true, stages };
}

// ==============================================================================
// 3. Goal Templates Server Actions
// ==============================================================================

export async function getAdminGoalTemplatesAction() {
  await requireAdminUser();
  const templates = await getAllGoalTemplates();
  return { success: true, templates };
}

export async function saveAdminGoalTemplateAction(raw: unknown) {
  await requireAdminUser();
  const parsed = AdminGoalTemplateSchema.parse(raw);
  const template = await saveAdminGoalTemplate(parsed);
  revalidatePath('/', 'layout');
  return { success: true, template };
}

export async function deleteAdminGoalTemplateAction(id: string) {
  await requireAdminUser();
  const deleted = await deleteAdminGoalTemplate(id);
  revalidatePath('/', 'layout');
  return { success: true, deleted };
}

// ==============================================================================
// 4. Schedule Templates Server Actions
// ==============================================================================

export async function getAdminScheduleTemplatesAction() {
  await requireAdminUser();
  const templates = await getAllScheduleTemplates();
  return { success: true, templates };
}

export async function saveAdminScheduleTemplateAction(raw: unknown) {
  await requireAdminUser();
  const parsed = AdminScheduleTemplateSchema.parse(raw);
  const template = await saveAdminScheduleTemplate(parsed);
  revalidatePath('/', 'layout');
  return { success: true, template };
}

export async function deleteAdminScheduleTemplateAction(id: string) {
  await requireAdminUser();
  const deleted = await deleteAdminScheduleTemplate(id);
  revalidatePath('/', 'layout');
  return { success: true, deleted };
}

// ==============================================================================
// 5. Achievement Badges Server Actions
// ==============================================================================

export async function getAdminAchievementsAction() {
  await requireAdminUser();
  const achievements = await getAllAchievementsCatalog();
  return { success: true, achievements };
}

export async function saveAdminAchievementAction(raw: unknown) {
  await requireAdminUser();
  const parsed = AdminAchievementSchema.parse(raw);
  const achievement = await saveAdminAchievement(parsed);
  invalidateAchievementsCatalogCache();
  revalidatePath('/', 'layout');
  return { success: true, achievement };
}

export async function deleteAdminAchievementAction(id: string) {
  await requireAdminUser();
  const deleted = await deleteAdminAchievement(id);
  invalidateAchievementsCatalogCache();
  revalidatePath('/', 'layout');
  return { success: true, deleted };
}

// ==============================================================================
// 6. System Configurations Server Actions
// ==============================================================================

export async function getAdminSystemConfigsAction() {
  await requireAdminUser();
  const configs = await getAllSystemConfigurations();
  return { success: true, configs };
}

export async function saveAdminSystemConfigAction(
  key: string,
  value: string,
  description?: string
) {
  const admin = await requireAdminUser();
  const config = await saveAdminSystemConfiguration({
    key,
    value,
    description,
    updatedBy: admin.email,
  });
  revalidatePath('/', 'layout');
  return { success: true, config };
}

export async function updateAdminSystemConfigAction(
  key: string,
  value: string,
  description?: string
) {
  return await saveAdminSystemConfigAction(key, value, description);
}

export async function deleteAdminSystemConfigAction(key: string) {
  await requireAdminUser();
  const deleted = await deleteAdminSystemConfiguration(key);
  revalidatePath('/', 'layout');
  return { success: true, deleted };
}

// ==============================================================================
// 7. Global Curriculum Subjects, Papers, Topics Server Actions
// ==============================================================================

export async function getAdminSubjectsAction() {
  await requireAdminUser();
  const subjects = await getAllGlobalCurriculumSubjects();
  return { success: true, subjects };
}

export async function saveAdminSubjectAction(raw: unknown) {
  await requireAdminUser();
  const parsed = AdminSubjectSchema.parse(raw);
  const subject = await saveAdminCurriculumSubject(parsed);
  revalidatePath('/', 'layout');
  return { success: true, subject };
}

export async function deleteAdminSubjectAction(id: string) {
  await requireAdminUser();
  const deleted = await deleteAdminCurriculumSubject(id);
  revalidatePath('/', 'layout');
  return { success: true, deleted };
}

export async function getAdminPapersAction() {
  await requireAdminUser();
  const papers = await getAllGlobalCurriculumPapers();
  return { success: true, papers };
}

export async function saveAdminPaperAction(raw: unknown) {
  await requireAdminUser();
  const parsed = AdminPaperSchema.parse(raw);
  const paper = await saveAdminCurriculumPaper(parsed);
  revalidatePath('/', 'layout');
  return { success: true, paper };
}

export async function deleteAdminPaperAction(id: string) {
  await requireAdminUser();
  const deleted = await deleteAdminCurriculumPaper(id);
  revalidatePath('/', 'layout');
  return { success: true, deleted };
}

export async function getAdminTopicsAction() {
  await requireAdminUser();
  const topics = await getAllGlobalCurriculumTopics();
  return { success: true, topics };
}

export async function saveAdminTopicAction(raw: unknown) {
  await requireAdminUser();
  const parsed = AdminTopicSchema.parse(raw);
  const topic = await saveAdminCurriculumTopic(parsed);
  revalidatePath('/', 'layout');
  return { success: true, topic };
}

export async function deleteAdminTopicAction(id: string) {
  await requireAdminUser();
  const deleted = await deleteAdminCurriculumTopic(id);
  revalidatePath('/', 'layout');
  return { success: true, deleted };
}

// ==============================================================================
// 8. User Management Server Actions (R1, R2, R3, R4)
// ==============================================================================

const AdminUpdateUserSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(100, 'Full name cannot exceed 100 characters').optional(),
  email: z.string().trim().email('Invalid email address').max(255).optional(),
  avatarUrl: z.string().trim().max(2048, 'Avatar URL too long').optional().default(''),
  dailyStudyTargetMinutes: z.number().int().min(1).max(1440).optional(),
  preferredStudyTime: z.string().max(50).optional(),
  timezone: z.string().max(100).optional(),
  themePreference: z.string().max(20).optional(),
  pomodoroFocusMinutes: z.number().int().min(1).max(180).optional(),
  pomodoroShortBreakMinutes: z.number().int().min(1).max(60).optional(),
  pomodoroLongBreakMinutes: z.number().int().min(1).max(120).optional(),
  pomodoroLongBreakInterval: z.number().int().min(1).max(20).optional(),
  targetExamName: z.string().max(100).optional(),
  targetExamDate: z.string().max(50).optional(),
  gamificationXp: z.number().int().min(0).max(10000000).optional(),
  onboardingCompleted: z.boolean().optional(),
});

export async function getAdminUsersListAction() {
  await requireAdminUser();
  try {
    const users = await getAdminUsersList();
    return { success: true, users };
  } catch (err: any) {
    console.error('getAdminUsersListAction error:', err);
    return { success: false, error: err?.message || 'Failed to fetch users list', users: [] };
  }
}

export async function getAdminUserDetailAction(userId: string) {
  await requireAdminUser();
  try {
    const user = await getAdminUserDetail(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    return { success: true, user };
  } catch (err: any) {
    console.error('getAdminUserDetailAction error:', err);
    return { success: false, error: err?.message || 'Failed to load user details' };
  }
}

export async function updateAdminUserDetailAction(userId: string, raw: unknown) {
  await requireAdminUser();
  const parseResult = AdminUpdateUserSchema.safeParse(raw);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues[0]?.message || 'Invalid user data provided';
    return { success: false, error: errorMsg };
  }

  try {
    const updated = await updateAdminUserDetail(userId, parseResult.data);
    if (!updated) {
      return { success: false, error: 'Failed to update user' };
    }

    await publishSyncEvent({
      userId,
      eventType: 'workspace:refresh',
      payload: {},
    }).catch(() => {});

    revalidatePath('/', 'layout');
    return { success: true, user: updated };
  } catch (err: any) {
    console.error('updateAdminUserDetailAction error:', err);
    return { success: false, error: err?.message || 'Database error updating user' };
  }
}

export async function toggleAdminUserBanAction(
  userId: string,
  isBanned: boolean,
  reason?: string
) {
  const admin = await requireAdminUser();
  if (admin.uid === userId && isBanned) {
    return { success: false, error: 'Administrators cannot ban their own account.' };
  }

  try {
    // Prevent banning other admin accounts
    const targetUser = await getAdminUserDetail(userId);
    if (!targetUser) {
      return { success: false, error: 'User not found' };
    }

    if (isBanned && (await isUserAdmin({ uid: userId, email: targetUser.profile.email, name: '' }))) {
      return { success: false, error: 'Administrators cannot ban other administrator accounts.' };
    }

    const sanitizedReason = typeof reason === 'string' ? reason.trim().slice(0, 500) : undefined;
    const updated = await setAdminUserBanStatus(userId, isBanned, sanitizedReason);
    if (!updated) {
      return { success: false, error: 'User not found or update failed' };
    }

    await publishSyncEvent({
      userId,
      eventType: 'user:banned',
      payload: { isBanned },
    }).catch(() => {});

    if (!isBanned) {
      await publishSyncEvent({
        userId,
        eventType: 'workspace:refresh',
        payload: {},
      }).catch(() => {});
    }

    revalidatePath('/', 'layout');
    return { success: true, user: updated };
  } catch (err: any) {
    console.error('toggleAdminUserBanAction error:', err);
    return { success: false, error: err?.message || 'Database error updating ban status' };
  }
}

export async function setAdminUserTargetedAnnouncementAction(
  userId: string,
  announcement: string
) {
  await requireAdminUser();
  if (typeof announcement !== 'string') {
    return { success: false, error: 'Announcement must be a valid text string' };
  }
  if (announcement.length > 5000) {
    return { success: false, error: 'Announcement cannot exceed 5000 characters' };
  }
  if (announcement !== '' && announcement.trim() === '') {
    return { success: false, error: 'Announcement cannot be empty whitespace' };
  }

  try {
    const updated = await setAdminUserTargetedAnnouncement(userId, announcement);
    if (!updated) {
      return { success: false, error: 'User not found or update failed' };
    }

    await publishSyncEvent({
      userId,
      eventType: 'workspace:refresh',
      payload: { targetedAnnouncement: announcement.trim() },
    }).catch(() => {});

    revalidatePath('/', 'layout');
    return { success: true, user: updated };
  } catch (err: any) {
    console.error('setAdminUserTargetedAnnouncementAction error:', err);
    return { success: false, error: err?.message || 'Database error setting targeted announcement' };
  }
}


