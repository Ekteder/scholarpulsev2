'use server';

import { getCurrentUser } from '@/lib/auth';
import {
  createUserFlashcard,
  updateUserFlashcard,
  deleteUserFlashcard,
  reviewUserFlashcard,
} from '@/lib/db/repository';
import { FlashcardSchema, FlashcardReviewSchema } from '@/lib/validations';
import { publishSyncEvent } from '@/lib/realtime';
import { revalidatePath } from 'next/cache';

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

export async function createFlashcardAction(raw: unknown) {
  const user = await requireUser();
  const parsed = FlashcardSchema.parse(raw);
  const flashcard = await createUserFlashcard(user.uid, parsed);

  if (flashcard) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'flashcard:create',
      payload: { flashcard },
    });
  }

  revalidatePath('/');
  return { success: true, flashcard };
}

export async function updateFlashcardAction(id: string, raw: unknown) {
  const user = await requireUser();
  const parsed = FlashcardSchema.partial().parse(raw);
  const flashcard = await updateUserFlashcard(user.uid, id, parsed);

  if (flashcard) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'flashcard:update',
      payload: { flashcard },
    });
  }

  revalidatePath('/');
  return { success: true, flashcard };
}

export async function deleteFlashcardAction(id: string) {
  const user = await requireUser();
  await deleteUserFlashcard(user.uid, id);

  await publishSyncEvent({
    userId: user.uid,
    eventType: 'flashcard:delete',
    payload: { flashcardId: id },
  });

  revalidatePath('/');
  return { success: true };
}

export async function reviewFlashcardAction(raw: unknown) {
  const user = await requireUser();
  const parsed = FlashcardReviewSchema.parse(raw);
  const updatedCard = await reviewUserFlashcard(user.uid, parsed.id, parsed.grade);

  if (updatedCard) {
    await publishSyncEvent({
      userId: user.uid,
      eventType: 'flashcard:update',
      payload: { flashcard: updatedCard },
    });
  }

  revalidatePath('/');
  return { success: true, flashcard: updatedCard };
}
