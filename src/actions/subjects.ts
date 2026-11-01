'use server';

import { getCurrentUser } from '@/lib/auth';
import {
  createSubject,
  updateSubject,
  deleteSubject,
} from '@/lib/db/repository';
import { SubjectSchema } from '@/lib/validations';
import { publishSyncEvent } from '@/lib/realtime';
import { revalidatePath } from 'next/cache';

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

export async function createSubjectAction(raw: unknown) {
  const user = await requireUser();
  const parsed = SubjectSchema.parse(raw);
  const clientDeviceId = (raw as any)?.clientDeviceId;
  const subject = await createSubject(user.uid, parsed);

  if (subject) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'subject:create',
      payload: { subject },
      clientDeviceId,
    });
  }

  revalidatePath('/');
  return { success: true, subject };
}

export async function updateSubjectAction(id: string, raw: unknown) {
  const user = await requireUser();
  const parsed = SubjectSchema.partial().parse(raw);
  const clientDeviceId = (raw as any)?.clientDeviceId;
  const subject = await updateSubject(user.uid, id, parsed);

  if (subject) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'subject:update',
      payload: { subject },
      clientDeviceId,
    });
  }

  revalidatePath('/');
  return { success: true, subject };
}

export async function deleteSubjectAction(id: string, clientDeviceId?: string) {
  const user = await requireUser();
  await deleteSubject(user.uid, id);

  await publishSyncEvent({
    userId: user.uid,
    eventType: 'subject:delete',
    payload: { subjectId: id },
    clientDeviceId,
  });

  revalidatePath('/');
  return { success: true };
}
