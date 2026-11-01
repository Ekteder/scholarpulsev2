import { relations } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// 1. Profiles table
export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().unique(), // Firebase Auth UID
    email: text('email').notNull(),
    fullName: text('full_name').notNull().default('Student Scholar'),
    avatarUrl: text('avatar_url').default(''),
    dailyStudyTargetMinutes: integer('daily_study_target_minutes').notNull().default(360), // 6 hours default
    preferredStudyTime: text('preferred_study_time').notNull().default('evening'), // morning | afternoon | evening | night
    timezone: text('timezone').notNull().default('Asia/Dhaka'),
    themePreference: text('theme_preference').notNull().default('light'), // light | dark | system
    pomodoroFocusMinutes: integer('pomodoro_focus_minutes').notNull().default(25),
    pomodoroShortBreakMinutes: integer('pomodoro_short_break_minutes').notNull().default(5),
    pomodoroLongBreakMinutes: integer('pomodoro_long_break_minutes').notNull().default(15),
    pomodoroLongBreakInterval: integer('pomodoro_long_break_interval').notNull().default(4),
    onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
    targetExamName: text('target_exam_name').notNull().default('HSC 2026'),
    targetExamDate: text('target_exam_date').notNull().default('2026-06-15'),
    gamificationXp: integer('gamification_xp').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('profiles_user_id_idx').on(table.userId)]
);

// 2. Subjects table
export const subjects = pgTable(
  'subjects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    description: text('description').default(''),
    color: text('color').notNull().default('#2563EB'),
    icon: text('icon').notNull().default('BookOpen'),
    dailyTargetMinutes: integer('daily_target_minutes').notNull().default(60),
    weeklyTargetMinutes: integer('weekly_target_minutes').notNull().default(300),
    isArchived: boolean('is_archived').notNull().default(false),
    notes: text('notes').default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('subjects_user_id_idx').on(table.userId)]
);

// 3. Study Sessions table
export const studySessions = pgTable(
  'study_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    idempotencyKey: text('idempotency_key').unique(),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    topic: text('topic').notNull().default('General Study'),
    notes: text('notes').default(''),
    productivityRating: integer('productivity_rating').default(4), // 1 to 5
    sessionType: text('session_type').notNull().default('manual'), // 'manual' | 'timer'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('study_sessions_user_id_idx').on(table.userId),
    index('study_sessions_subject_id_idx').on(table.subjectId),
    index('study_sessions_user_start_idx').on(table.userId, table.startTime),
  ]
);

// 4. Active Timer Sessions table (Authoritative cloud state for running/paused timers)
export const activeTimerSessions = pgTable(
  'active_timer_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull().unique(),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    topic: text('topic').notNull().default('Focused Study'),
    notes: text('notes').default(''),
    mode: text('mode').notNull().default('stopwatch'), // 'stopwatch' | 'pomodoro'
    phase: text('phase').notNull().default('focus'), // 'focus' | 'short_break' | 'long_break'
    status: text('status').notNull().default('running'), // 'running' | 'paused'
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    lastResumedAt: timestamp('last_resumed_at', { withTimezone: true }).notNull(),
    accumulatedSeconds: integer('accumulated_seconds').notNull().default(0),
    targetDurationSeconds: integer('target_duration_seconds').notNull().default(1500),
    completedPomodoros: integer('completed_pomodoros').notNull().default(0),
    stateVersion: integer('state_version').notNull().default(1),
    clientDeviceId: text('client_device_id').default(''),
    idempotencyKey: text('idempotency_key').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('active_timer_user_id_idx').on(table.userId)]
);

// 5. Tasks table
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').default(''),
    dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
    priority: text('priority').notNull().default('medium'), // 'low' | 'medium' | 'high'
    status: text('status').notNull().default('pending'), // 'pending' | 'in_progress' | 'completed'
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('tasks_user_id_idx').on(table.userId),
    index('tasks_subject_id_idx').on(table.subjectId),
  ]
);

// 6. Schedules table (Weekly Timetable)
export const schedules = pgTable(
  'schedules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(), // 0 (Sunday) to 6 (Saturday)
    startTime: text('start_time').notNull(), // HH:mm (24h)
    endTime: text('end_time').notNull(), // HH:mm (24h)
    description: text('description').default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('schedules_user_id_idx').on(table.userId)]
);

// 7. Goals table
export const goals = pgTable(
  'goals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    subjectId: uuid('subject_id').references(() => subjects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    goalType: text('goal_type').notNull().default('daily'), // 'daily' | 'weekly' | 'monthly' | 'subject' | 'streak' | 'sessions'
    targetValue: integer('target_value').notNull(), // minutes, sessions, or days depending on unit
    currentValue: integer('current_value').notNull().default(0),
    unit: text('unit').notNull().default('minutes'), // 'minutes' | 'sessions' | 'days'
    startDate: text('start_date').notNull(), // YYYY-MM-DD
    endDate: text('end_date').notNull(), // YYYY-MM-DD
    status: text('status').notNull().default('active'), // 'active' | 'completed' | 'expired'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('goals_user_id_idx').on(table.userId)]
);

// 8. Achievements catalog table
export const achievements = pgTable('achievements', {
  id: text('id').primaryKey(), // e.g., 'first_session', 'getting_started_5h'
  title: text('title').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull().default('Award'),
  category: text('category').notNull().default('milestone'), // 'milestone' | 'streak' | 'consistency' | 'tasks'
  requirementType: text('requirement_type').notNull(), // 'sessions_count' | 'total_hours' | 'streak_days' | 'monthly_daily_goals' | 'completed_tasks' | 'subjects_studied'
  requirementValue: integer('requirement_value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 9. User Achievements table
export const userAchievements = pgTable(
  'user_achievements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    achievementId: text('achievement_id')
      .notNull()
      .references(() => achievements.id, { onDelete: 'cascade' }),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('user_achievements_user_id_idx').on(table.userId),
    uniqueIndex('user_achievements_unique_idx').on(table.userId, table.achievementId),
  ]
);

// 10. Notification Preferences table
export const notificationPreferences = pgTable('notification_preferences', {
  userId: text('user_id').primaryKey(),
  browserNotificationsEnabled: boolean('browser_notifications_enabled').notNull().default(false),
  soundChimesEnabled: boolean('sound_chimes_enabled').notNull().default(true),
  dailyReminderEnabled: boolean('daily_reminder_enabled').notNull().default(true),
  dailyReminderTime: text('daily_reminder_time').notNull().default('19:00'),
  scheduleReminderEnabled: boolean('schedule_reminder_enabled').notNull().default(true),
  taskDeadlineReminderEnabled: boolean('task_deadline_reminder_enabled').notNull().default(true),
  goalCompletionAlert: boolean('goal_completion_alert').notNull().default(true),
  streakMilestoneAlert: boolean('streak_milestone_alert').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const subjectsRelations = relations(subjects, ({ many }) => ({
  studySessions: many(studySessions),
  tasks: many(tasks),
  schedules: many(schedules),
  goals: many(goals),
}));

export const studySessionsRelations = relations(studySessions, ({ one }) => ({
  subject: one(subjects, {
    fields: [studySessions.subjectId],
    references: [subjects.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  subject: one(subjects, {
    fields: [tasks.subjectId],
    references: [subjects.id],
  }),
}));

export const schedulesRelations = relations(schedules, ({ one }) => ({
  subject: one(subjects, {
    fields: [schedules.subjectId],
    references: [subjects.id],
  }),
}));

export const goalsRelations = relations(goals, ({ one }) => ({
  subject: one(subjects, {
    fields: [goals.subjectId],
    references: [subjects.id],
  }),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  achievement: one(achievements, {
    fields: [userAchievements.achievementId],
    references: [achievements.id],
  }),
}));

// ==============================================================================
// REVISION TRACKER & CURRICULUM ARCHITECTURE (Tables 11-15)
// ==============================================================================

// 11. Curriculum Subjects table (Global seeded + user custom)
export const curriculumSubjects = pgTable(
  'curriculum_subjects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id'), // null for global default seeded; user UID for user custom subjects
    name: text('name').notNull(),
    code: text('code').notNull(),
    color: text('color').notNull().default('#2563EB'),
    icon: text('icon').notNull().default('BookOpen'),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('curriculum_subjects_user_idx').on(table.userId),
    index('curriculum_subjects_code_idx').on(table.code),
  ]
);

// 12. Curriculum Papers / Sections table (e.g., 1st Paper, 2nd Paper, etc.)
export const curriculumPapers = pgTable(
  'curriculum_papers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => curriculumSubjects.id, { onDelete: 'cascade' }),
    userId: text('user_id'),
    title: text('title').notNull(),
    paperCode: text('paper_code'),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('curriculum_papers_subject_idx').on(table.subjectId),
    index('curriculum_papers_user_idx').on(table.userId),
  ]
);

// 13. Curriculum Topics / Chapters table
export const curriculumTopics = pgTable(
  'curriculum_topics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paperId: uuid('paper_id')
      .notNull()
      .references(() => curriculumPapers.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => curriculumSubjects.id, { onDelete: 'cascade' }),
    userId: text('user_id'),
    title: text('title').notNull(),
    chapterNumber: integer('chapter_number'),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('curriculum_topics_paper_idx').on(table.paperId),
    index('curriculum_topics_subject_idx').on(table.subjectId),
    index('curriculum_topics_user_idx').on(table.userId),
  ]
);

// 14. User Curriculum Customizations table (Hide, rename, or reorder per user)
export const userCurriculumCustomizations = pgTable(
  'user_curriculum_customizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    targetType: text('target_type').notNull(), // 'subject' | 'paper' | 'topic'
    targetId: uuid('target_id').notNull(),
    isHidden: boolean('is_hidden').notNull().default(false),
    customTitle: text('custom_title'),
    customOrder: integer('custom_order'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('user_curr_cust_user_idx').on(table.userId),
    uniqueIndex('user_curr_cust_unique_idx').on(
      table.userId,
      table.targetType,
      table.targetId
    ),
  ]
);

// 15. Revision Records table (Strict 1 record per user + topic + category)
export const revisionRecords = pgTable(
  'revision_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => curriculumSubjects.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => curriculumTopics.id, { onDelete: 'cascade' }),
    category: text('category').notNull(), // 'class' | 'revision_note' | 'book_reading' | 'mcq_exam' | 'cq_solve' | 'test_paper_solving'
    activityDate: text('activity_date'), // YYYY-MM-DD
    isCompleted: boolean('is_completed').notNull().default(true),
    bookName: text('book_name'),
    pagesRead: integer('pages_read'),
    questionsSolved: integer('questions_solved'),
    correctCount: integer('correct_count'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('revision_records_user_id_idx').on(table.userId),
    index('revision_records_subject_id_idx').on(table.subjectId),
    index('revision_records_topic_id_idx').on(table.topicId),
    index('revision_records_user_cat_idx').on(table.userId, table.category),
    uniqueIndex('revision_records_user_topic_cat_idx').on(
      table.userId,
      table.topicId,
      table.category
    ),
  ]
);

// Revision Relations
export const curriculumSubjectsRelations = relations(curriculumSubjects, ({ many }) => ({
  papers: many(curriculumPapers),
  topics: many(curriculumTopics),
  records: many(revisionRecords),
}));

export const curriculumPapersRelations = relations(curriculumPapers, ({ one, many }) => ({
  subject: one(curriculumSubjects, {
    fields: [curriculumPapers.subjectId],
    references: [curriculumSubjects.id],
  }),
  topics: many(curriculumTopics),
}));

export const curriculumTopicsRelations = relations(curriculumTopics, ({ one, many }) => ({
  paper: one(curriculumPapers, {
    fields: [curriculumTopics.paperId],
    references: [curriculumPapers.id],
  }),
  subject: one(curriculumSubjects, {
    fields: [curriculumTopics.subjectId],
    references: [curriculumSubjects.id],
  }),
  records: many(revisionRecords),
}));

export const revisionRecordsRelations = relations(revisionRecords, ({ one }) => ({
  topic: one(curriculumTopics, {
    fields: [revisionRecords.topicId],
    references: [curriculumTopics.id],
  }),
  subject: one(curriculumSubjects, {
    fields: [revisionRecords.subjectId],
    references: [curriculumSubjects.id],
  }),
}));

// 16. Flashcards table (Spaced Repetition SM-2)
export const flashcards = pgTable(
  'flashcards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id'),
    front: text('front').notNull(),
    back: text('back').notNull(),
    repetitions: integer('repetitions').notNull().default(0),
    intervalDays: integer('interval_days').notNull().default(0),
    easeFactor: text('ease_factor').notNull().default('2.5'),
    nextReviewDate: text('next_review_date').notNull(), // YYYY-MM-DD
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('flashcards_user_id_idx').on(table.userId),
    index('flashcards_subject_id_idx').on(table.subjectId),
    index('flashcards_review_date_idx').on(table.userId, table.nextReviewDate),
  ]
);

export const flashcardsRelations = relations(flashcards, ({ one }) => ({
  subject: one(subjects, {
    fields: [flashcards.subjectId],
    references: [subjects.id],
  }),
}));

// 17. Curriculum Resources & Bookmarking table
export const curriculumResources = pgTable(
  'curriculum_resources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => curriculumSubjects.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => curriculumTopics.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    url: text('url').notNull(),
    resourceType: text('resource_type').notNull().default('link'), // 'youtube' | 'drive' | 'pdf' | 'book_ref' | 'link'
    pageReference: text('page_reference').default(''),
    notes: text('notes').default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('curriculum_resources_user_idx').on(table.userId),
    index('curriculum_resources_topic_idx').on(table.topicId),
    index('curriculum_resources_subject_idx').on(table.subjectId),
  ]
);

export const curriculumResourcesRelations = relations(curriculumResources, ({ one }) => ({
  topic: one(curriculumTopics, {
    fields: [curriculumResources.topicId],
    references: [curriculumTopics.id],
  }),
  subject: one(curriculumSubjects, {
    fields: [curriculumResources.subjectId],
    references: [curriculumSubjects.id],
  }),
}));

// ==============================================================================
// 18. Real-time Sync Events table (Cross-device real-time event streaming)
// ==============================================================================
export const syncEvents = pgTable(
  'sync_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: text('user_id').notNull(),
    eventType: text('event_type').notNull(), // 'timer:update' | 'timer:delete' | 'workspace:refresh' | etc.
    payload: text('payload').notNull(), // JSON stringified payload
    clientDeviceId: text('client_device_id').default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sync_events_user_id_id_idx').on(table.userId, table.id),
    index('sync_events_created_at_idx').on(table.createdAt),
  ]
);

