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
  createCurriculumResource,
  deleteCurriculumResource,
} from '@/lib/db/repository';
import {
  RevisionToggleSchema,
  RevisionDetailedRecordSchema,
  CustomCurriculumTopicSchema,
  CustomCurriculumSubjectSchema,
  CurriculumCustomizationSchema,
  CurriculumResourceSchema,
} from '@/lib/validations';
import { publishSyncEvent } from '@/lib/realtime';

async function requireUser() {
  const user = await getCurrentUser();
  if (!user || user.isBanned) throw new Error(user?.isBanned ? 'Account is banned' : 'Unauthorized');
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
  const clientDeviceId = (raw as any)?.clientDeviceId;
  const result = await toggleRevisionRecord(user.uid, parsed);

  await publishSyncEvent({
    userId: user.uid,
    eventType: 'revision:toggle',
    payload: {
      record: result,
      subjectId: parsed.subjectId,
      topicId: parsed.topicId,
      category: parsed.category,
      isCompleted: parsed.isCompleted,
    },
    clientDeviceId,
  });

  return { success: true, record: result };
}

export async function saveDetailedRevisionRecordAction(raw: unknown) {
  const user = await requireUser();
  const parsed = RevisionDetailedRecordSchema.parse(raw);
  const clientDeviceId = (raw as any)?.clientDeviceId;
  const result = await saveDetailedRevisionRecord(user.uid, parsed as any);

  await publishSyncEvent({
    userId: user.uid,
    eventType: 'revision:detailed',
    payload: { record: result },
    clientDeviceId,
  });

  return { success: true, record: result };
}

export async function deleteRevisionRecordAction(id: string, clientDeviceId?: string) {
  const user = await requireUser();
  await deleteRevisionRecord(user.uid, id);

  await publishSyncEvent({
    userId: user.uid,
    eventType: 'revision:delete',
    payload: { recordId: id },
    clientDeviceId,
  });

  return { success: true };
}

export async function addCustomCurriculumTopicAction(raw: unknown) {
  const user = await requireUser();
  const parsed = CustomCurriculumTopicSchema.parse(raw);
  const clientDeviceId = (raw as any)?.clientDeviceId;
  const result = await addCustomCurriculumTopic(user.uid, parsed);

  if (result) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'revision:topic:create',
      payload: { topic: result },
      clientDeviceId,
    });
  }

  return { success: true, topic: result };
}

export async function addCustomCurriculumSubjectAction(raw: unknown) {
  const user = await requireUser();
  const parsed = CustomCurriculumSubjectSchema.parse(raw);
  const clientDeviceId = (raw as any)?.clientDeviceId;
  const result = await addCustomCurriculumSubject(user.uid, parsed);

  if (result) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'revision:subject:create',
      payload: { subject: result },
      clientDeviceId,
    });
  }

  return { success: true, subject: result };
}

export async function updateCurriculumCustomizationAction(raw: unknown) {
  const user = await requireUser();
  const parsed = CurriculumCustomizationSchema.parse(raw);
  const clientDeviceId = (raw as any)?.clientDeviceId;
  const result = await updateCurriculumCustomization(user.uid, parsed);

  if (result) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'revision:customization:update',
      payload: { customization: result },
      clientDeviceId,
    });
  }

  return { success: true, customization: result };
}

export async function createCurriculumResourceAction(raw: unknown) {
  const user = await requireUser();
  const parsed = CurriculumResourceSchema.parse(raw);
  const clientDeviceId = (raw as any)?.clientDeviceId;
  const resource = await createCurriculumResource(user.uid, parsed);

  if (resource) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'revision:resource:create',
      payload: { resource },
      clientDeviceId,
    });
  }

  return { success: true, resource };
}

export async function deleteCurriculumResourceAction(id: string, clientDeviceId?: string) {
  const user = await requireUser();
  await deleteCurriculumResource(user.uid, id);

  await publishSyncEvent({
    userId: user.uid,
    eventType: 'revision:resource:delete',
    payload: { resourceId: id },
    clientDeviceId,
  });

  return { success: true };
}
