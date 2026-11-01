'use server';

import { getCurrentUser } from '@/lib/auth';
import {
  getRevisionWorkspaceData,
  toggleRevisionRecord,
  saveDetailedRevisionRecord,
  deleteRevisionRecord,
  addCustomCurriculumTopic,
  addCustomCurriculumSubject,
  updateCurriculumCustomization,
} from '@/lib/db/repository';
import {
  RevisionToggleSchema,
  RevisionDetailedRecordSchema,
  CustomCurriculumTopicSchema,
  CustomCurriculumSubjectSchema,
  CurriculumCustomizationSchema,
} from '@/lib/validations';
import { revalidatePath } from 'next/cache';

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

export async function getRevisionWorkspaceAction() {
  const user = await requireUser();
  const data = await getRevisionWorkspaceData(user.uid);
  return { success: true, data };
}

export async function toggleRevisionAction(raw: unknown) {
  const user = await requireUser();
  const parsed = RevisionToggleSchema.parse(raw);
  const result = await toggleRevisionRecord(user.uid, parsed);
  revalidatePath('/');
  return { success: true, record: result };
}

export async function saveDetailedRevisionRecordAction(raw: unknown) {
  const user = await requireUser();
  const parsed = RevisionDetailedRecordSchema.parse(raw);
  const result = await saveDetailedRevisionRecord(user.uid, parsed as any);
  revalidatePath('/');
  return { success: true, record: result };
}

export async function deleteRevisionRecordAction(id: string) {
  const user = await requireUser();
  await deleteRevisionRecord(user.uid, id);
  revalidatePath('/');
  return { success: true };
}

export async function addCustomCurriculumTopicAction(raw: unknown) {
  const user = await requireUser();
  const parsed = CustomCurriculumTopicSchema.parse(raw);
  const result = await addCustomCurriculumTopic(user.uid, parsed);
  revalidatePath('/');
  return { success: true, topic: result };
}

export async function addCustomCurriculumSubjectAction(raw: unknown) {
  const user = await requireUser();
  const parsed = CustomCurriculumSubjectSchema.parse(raw);
  const result = await addCustomCurriculumSubject(user.uid, parsed);
  revalidatePath('/');
  return { success: true, subject: result };
}

export async function updateCurriculumCustomizationAction(raw: unknown) {
  const user = await requireUser();
  const parsed = CurriculumCustomizationSchema.parse(raw);
  const result = await updateCurriculumCustomization(user.uid, parsed);
  revalidatePath('/');
  return { success: true, customization: result };
}
