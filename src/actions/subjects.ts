'use server';

import { getCurrentUser } from '@/lib/auth';
import {
  createSubject,
  updateSubject,
  deleteSubject,
} from '@/lib/db/repository';
import { SubjectSchema } from '@/lib/validations';
import { revalidatePath } from 'next/cache';

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

export async function createSubjectAction(raw: unknown) {
  const user = await requireUser();
  const parsed = SubjectSchema.parse(raw);
  const subject = await createSubject(user.uid, parsed);
  revalidatePath('/');
  return { success: true, subject };
}

export async function updateSubjectAction(id: string, raw: unknown) {
  const user = await requireUser();
  const parsed = SubjectSchema.partial().parse(raw);
  const subject = await updateSubject(user.uid, id, parsed);
  revalidatePath('/');
  return { success: true, subject };
}

export async function deleteSubjectAction(id: string) {
  const user = await requireUser();
  await deleteSubject(user.uid, id);
  revalidatePath('/');
  return { success: true };
}
