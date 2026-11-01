import { z } from 'zod';

export const OnboardingSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(100),
  avatarUrl: z.string().optional().default(''),
  dailyStudyTargetMinutes: z.number().int().min(15).max(1440).default(360),
  preferredStudyTime: z.enum(['morning', 'afternoon', 'evening', 'night']).default('evening'),
  timezone: z.string().min(1).default('Asia/Dhaka'),
  initialSubjects: z.array(z.string()).default([]),
});

export const ProfileUpdateSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(100).optional(),
  avatarUrl: z.string().optional(),
  dailyStudyTargetMinutes: z.number().int().min(15).max(1440).optional(),
  preferredStudyTime: z.enum(['morning', 'afternoon', 'evening', 'night']).optional(),
  timezone: z.string().min(1).optional(),
  themePreference: z.enum(['light', 'dark', 'system']).optional(),
  pomodoroFocusMinutes: z.number().int().min(1).max(180).optional(),
  pomodoroShortBreakMinutes: z.number().int().min(1).max(60).optional(),
  pomodoroLongBreakMinutes: z.number().int().min(1).max(90).optional(),
  pomodoroLongBreakInterval: z.number().int().min(1).max(12).optional(),
});

export const NotificationPreferencesSchema = z.object({
  browserNotificationsEnabled: z.boolean().default(false),
  soundChimesEnabled: z.boolean().default(true),
  dailyReminderEnabled: z.boolean().default(true),
  dailyReminderTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).default('19:00'),
  scheduleReminderEnabled: z.boolean().default(true),
  taskDeadlineReminderEnabled: z.boolean().default(true),
  goalCompletionAlert: z.boolean().default(true),
  streakMilestoneAlert: z.boolean().default(true),
});

export const SubjectSchema = z.object({
  name: z.string().min(1, 'Subject name is required').max(100),
  description: z.string().max(500).optional().default(''),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).default('#2563EB'),
  icon: z.string().min(1).default('BookOpen'),
  dailyTargetMinutes: z.number().int().min(0).max(1440).default(60),
  weeklyTargetMinutes: z.number().int().min(0).max(10080).default(300),
  isArchived: z.boolean().optional().default(false),
  notes: z.string().optional().default(''),
});

export const StudySessionSchema = z.object({
  subjectId: z.string().uuid('Valid subject ID is required'),
  startTime: z.string().or(z.date()),
  endTime: z.string().or(z.date()),
  durationSeconds: z.number().int().min(1),
  topic: z.string().min(1).max(200).default('General Study'),
  notes: z.string().max(2000).optional().default(''),
  productivityRating: z.number().int().min(1).max(5).default(4),
  sessionType: z.enum(['manual', 'timer']).default('manual'),
  idempotencyKey: z.string().optional(),
});

export const ActiveTimerSyncSchema = z.object({
  subjectId: z.string().uuid('Valid subject ID is required'),
  topic: z.string().default('Focused Study'),
  notes: z.string().optional().default(''),
  mode: z.enum(['stopwatch', 'pomodoro']).default('stopwatch'),
  phase: z.enum(['focus', 'short_break', 'long_break']).default('focus'),
  status: z.enum(['running', 'paused']).default('running'),
  startedAt: z.string().or(z.date()),
  lastResumedAt: z.string().or(z.date()),
  accumulatedSeconds: z.number().int().min(0).default(0),
  targetDurationSeconds: z.number().int().min(0).default(1500),
  completedPomodoros: z.number().int().min(0).default(0),
  stateVersion: z.number().int().default(1),
  clientDeviceId: z.string().optional().default(''),
  idempotencyKey: z.string(),
});

export const TaskSchema = z.object({
  subjectId: z.string().uuid('Valid subject ID is required'),
  title: z.string().min(1, 'Task title is required').max(200),
  description: z.string().max(1000).optional().default(''),
  dueDate: z.string().or(z.date()),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.enum(['pending', 'in_progress', 'completed']).default('pending'),
});

export const ScheduleSchema = z.object({
  subjectId: z.string().uuid('Valid subject ID is required'),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format HH:mm'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format HH:mm'),
  description: z.string().max(500).optional().default(''),
});

export const GoalSchema = z.object({
  subjectId: z.string().uuid().nullable().optional(),
  title: z.string().min(1, 'Goal title is required').max(200),
  goalType: z.enum(['daily', 'weekly', 'monthly', 'subject', 'streak', 'sessions']).default('daily'),
  targetValue: z.number().int().min(1),
  currentValue: z.number().int().min(0).default(0),
  unit: z.enum(['minutes', 'sessions', 'days']).default('minutes'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['active', 'completed', 'expired']).default('active'),
});

export const RevisionToggleSchema = z.object({
  subjectId: z.string().uuid(),
  topicId: z.string().uuid(),
  category: z.enum(['class', 'revision_note', 'book_reading', 'mcq_exam', 'cq_solve', 'test_paper_solving']),
  isCompleted: z.boolean(),
  activityDate: z.string().optional(),
});

export const RevisionDetailedRecordSchema = z.object({
  subjectId: z.string().uuid(),
  topicId: z.string().uuid(),
  category: z.enum(['class', 'revision_note', 'book_reading', 'mcq_exam', 'cq_solve', 'test_paper_solving']),
  activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isCompleted: z.boolean().default(true),
  bookName: z.string().max(200).optional().nullable(),
  pagesRead: z.number().int().min(0).optional().nullable(),
  questionsSolved: z.number().int().min(0).optional().nullable(),
  correctCount: z.number().int().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const CustomCurriculumTopicSchema = z.object({
  paperId: z.string().uuid(),
  subjectId: z.string().uuid(),
  title: z.string().min(1, 'Title is required').max(200),
  chapterNumber: z.number().int().optional().nullable(),
});

export const CustomCurriculumSubjectSchema = z.object({
  name: z.string().min(1, 'Subject name is required').max(100),
  code: z.string().min(1).max(50),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).default('#2563EB'),
  icon: z.string().min(1).default('BookOpen'),
  paperTitles: z.array(z.string()).default(['1st Paper', '2nd Paper']),
});

export const CurriculumCustomizationSchema = z.object({
  targetType: z.enum(['subject', 'paper', 'topic']),
  targetId: z.string().uuid(),
  isHidden: z.boolean().optional(),
  customTitle: z.string().max(200).optional().nullable(),
  customOrder: z.number().int().optional().nullable(),
});
