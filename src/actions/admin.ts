'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminUser } from '@/lib/auth';
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
} from '@/lib/db/repository';

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
