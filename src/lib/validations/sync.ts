import { z } from 'zod';

export const StudySessionBatchItemSchema = z.object({
  clientSessionId: z.string().optional().default(''),
  idempotencyKey: z.string().min(5, 'idempotencyKey must be at least 5 characters'),
  subjectId: z.string().uuid('Valid subject UUID is required'),
  startTime: z.string().min(1, 'startTime is required'),
  endTime: z.string().min(1, 'endTime is required'),
  durationSeconds: z.number().int().min(0).optional(),
  topic: z.string().max(200).optional().default('General Study'),
  notes: z.string().max(2000).optional().default(''),
  productivityRating: z.number().int().min(1).max(5).optional().default(4),
  sessionType: z.enum(['manual', 'timer', 'stopwatch']).optional().default('timer'),
});

export const TaskBatchItemSchema = z.object({
  id: z.string().uuid().optional(),
  clientTaskId: z.string().optional().default(''),
  idempotencyKey: z.string().optional(),
  subjectId: z.string().uuid('Valid subject UUID is required'),
  title: z.string().min(1, 'Task title is required').max(200),
  description: z.string().max(1000).optional().default(''),
  dueDate: z.string().min(1, 'dueDate is required'),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  status: z.enum(['pending', 'in_progress', 'completed']).optional().default('pending'),
  completedAt: z.string().optional().nullable(),
  version: z.number().int().min(1).optional().default(1),
});

export const RevisionBatchItemSchema = z.object({
  subjectId: z.string().uuid('Valid subject UUID is required'),
  topicId: z.string().uuid('Valid topic UUID is required'),
  category: z.enum([
    'class',
    'revision_note',
    'book_reading',
    'mcq_exam',
    'cq_solve',
    'test_paper_solving',
  ]),
  activityDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'activityDate must be YYYY-MM-DD')
    .optional(),
  isCompleted: z.boolean().default(true),
  bookName: z.string().max(200).optional().nullable(),
  pagesRead: z.number().int().min(0).optional().nullable(),
  questionsSolved: z.number().int().min(0).optional().nullable(),
  correctCount: z.number().int().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  clientUpdatedAt: z.string().optional(),
});

export const ActiveTimerBatchItemSchema = z.object({
  idempotencyKey: z.string().optional(),
  subjectId: z.string().uuid('Valid subject UUID is required'),
  topic: z.string().max(200).optional().default('Focused Study'),
  notes: z.string().max(2000).optional().default(''),
  mode: z.enum(['stopwatch', 'pomodoro']).optional().default('stopwatch'),
  phase: z.enum(['focus', 'short_break', 'long_break']).optional().default('focus'),
  status: z.enum(['running', 'paused']).optional().default('running'),
  startedAt: z.string().min(1, 'startedAt is required'),
  lastResumedAt: z.string().min(1, 'lastResumedAt is required'),
  accumulatedSeconds: z.number().int().min(0).optional().default(0),
  totalFocusSeconds: z.number().int().min(0).optional().default(0),
  targetDurationSeconds: z.number().int().min(0).optional().default(1500),
  completedPomodoros: z.number().int().min(0).optional().default(0),
  stateVersion: z.number().int().min(1, 'stateVersion must be at least 1').default(1),
});

export const BatchSyncPayloadSchema = z.object({
  clientDeviceId: z.string().min(1, 'clientDeviceId is required'),
  clientTimestamp: z.string().min(1, 'clientTimestamp is required'),
  studySessions: z.array(StudySessionBatchItemSchema).optional().default([]),
  tasks: z.array(TaskBatchItemSchema).optional().default([]),
  revisionRecords: z.array(RevisionBatchItemSchema).optional().default([]),
  activeTimer: ActiveTimerBatchItemSchema.optional().nullable(),
});

export type BatchSyncPayload = z.infer<typeof BatchSyncPayloadSchema>;
export type StudySessionBatchItem = z.infer<typeof StudySessionBatchItemSchema>;
export type TaskBatchItem = z.infer<typeof TaskBatchItemSchema>;
export type RevisionBatchItem = z.infer<typeof RevisionBatchItemSchema>;
export type ActiveTimerBatchItem = z.infer<typeof ActiveTimerBatchItemSchema>;
