import 'server-only';
import { and, asc, desc, eq, gt, isNull, lt, ne } from 'drizzle-orm';
import { db } from './index';
import {
  achievements,
  activeTimerSessions,
  adminAllowlist,
  curriculumPapers,
  curriculumResources,
  curriculumStages,
  curriculumSubjects,
  curriculumTopics,
  goalTemplates,
  goals,
  notificationPreferences,
  profiles,
  revisionRecords,
  scheduleTemplates,
  schedules,
  studySessions,
  subjects,
  systemConfigurations,
  tasks,
  userAchievements,
  userCurriculumCustomizations,
  syncEvents,
} from './schema';
import {
  ensureCurriculumSeedData,
  DEFAULT_SUBJECTS,
  DEFAULT_PAPERS,
  DEFAULT_TOPICS,
} from './curriculumSeed';
import { REVISION_CATEGORIES } from '@/types';
import {
  addDaysToYmd,
  computeStreaksFromDates,
  toDateStringInTz,
} from '../timezone';

export const DEFAULT_ACHIEVEMENTS = [
  {
    id: 'first_session',
    title: 'First Session',
    description: 'Complete your first recorded study session.',
    icon: 'Sparkles',
    category: 'milestone',
    requirementType: 'sessions_count',
    requirementValue: 1,
  },
  {
    id: 'getting_started_5h',
    title: 'Getting Started',
    description: 'Accumulate 5 total hours of focused study time.',
    icon: 'Clock',
    category: 'milestone',
    requirementType: 'total_hours',
    requirementValue: 5,
  },
  {
    id: 'dedicated_student_25h',
    title: 'Dedicated Student',
    description: 'Accumulate 25 total hours of focused study time.',
    icon: 'BookOpen',
    category: 'milestone',
    requirementType: 'total_hours',
    requirementValue: 25,
  },
  {
    id: 'study_champion_100h',
    title: 'Study Champion',
    description: 'Accumulate 100 total hours of focused study time.',
    icon: 'Trophy',
    category: 'milestone',
    requirementType: 'total_hours',
    requirementValue: 100,
  },
  {
    id: 'consistency_7d',
    title: 'Consistency',
    description: 'Maintain a consecutive daily study streak of 7 days.',
    icon: 'Flame',
    category: 'streak',
    requirementType: 'streak_days',
    requirementValue: 7,
  },
  {
    id: 'unstoppable_30d',
    title: 'Unstoppable Scholar',
    description: 'Maintain a consecutive daily study streak of 30 days.',
    icon: 'Zap',
    category: 'streak',
    requirementType: 'streak_days',
    requirementValue: 30,
  },
  {
    id: 'monthly_warrior_20',
    title: 'Monthly Warrior',
    description: 'Complete your daily study goal 20 times in a single calendar month.',
    icon: 'CalendarCheck',
    category: 'consistency',
    requirementType: 'monthly_daily_goals',
    requirementValue: 20,
  },
  {
    id: 'task_master_10',
    title: 'Task Finisher',
    description: 'Complete 10 academic tasks or assignments.',
    icon: 'CheckCircle2',
    category: 'tasks',
    requirementType: 'completed_tasks',
    requirementValue: 10,
  },
  {
    id: 'subject_explorer_4',
    title: 'Polymath',
    description: 'Record study sessions across at least 4 distinct subjects.',
    icon: 'Compass',
    category: 'milestone',
    requirementType: 'subjects_studied',
    requirementValue: 4,
  },
];

let achievementsSeeded = false;
let inMemoryCatalogCache: (typeof achievements.$inferSelect)[] | null = null;

export function invalidateAchievementsCatalogCache() {
  inMemoryCatalogCache = null;
}

export async function ensureAchievementsCatalog() {
  if (achievementsSeeded) return;
  try {
    await db
      .insert(achievements)
      .values(DEFAULT_ACHIEVEMENTS)
      .onConflictDoNothing({ target: achievements.id });
    achievementsSeeded = true;
  } catch (error) {
    console.error('Error seeding achievements catalog:', error);
    // Don't throw to avoid blocking workspace loading if already partially present
  }
}

export async function getOrCreateProfile(userId: string, email: string, name?: string) {
  try {
    const existing = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId));

    if (existing.length > 0) {
      return existing[0];
    }

    const inserted = await db
      .insert(profiles)
      .values({
        userId,
        email: email || 'student@scholarpulse.edu',
        fullName: name || (email ? email.split('@')[0] : 'Student Scholar'),
        timezone: 'Asia/Dhaka',
        dailyStudyTargetMinutes: 360,
        preferredStudyTime: 'evening',
        themePreference: 'light',
        onboardingCompleted: false,
        targetExamName: 'HSC 2027',
        targetExamDate: '2027-06-01',
      })
      .onConflictDoUpdate({
        target: profiles.userId,
        set: { email: email || 'student@scholarpulse.edu' },
      })
      .returning();

    await db
      .insert(notificationPreferences)
      .values({ userId })
      .onConflictDoNothing({ target: notificationPreferences.userId });

    return inserted[0];
  } catch (error) {
    console.error('Database error in getOrCreateProfile:', error);
    throw new Error('Failed to load or initialize user profile.', { cause: error });
  }
}

export async function getNotificationPrefs(userId: string) {
  try {
    const rows = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));

    if (rows.length > 0) return rows[0];

    const created = await db
      .insert(notificationPreferences)
      .values({ userId })
      .onConflictDoNothing({ target: notificationPreferences.userId })
      .returning();

    if (created.length > 0) return created[0];
    const retry = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    return retry[0];
  } catch (error) {
    console.error('Database error in getNotificationPrefs:', error);
    throw new Error('Failed to fetch notification preferences.', { cause: error });
  }
}

/**
 * Deterministically recalculates all goals and achievements for a user.
 * Called inside or immediately after any session or task mutation so edited/deleted
 * sessions never leave stale progress values.
 */
export async function recalculateGoalsAndAchievements(userId: string) {
  try {
    await ensureAchievementsCatalog();

    const [profileRow] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId));
    const timeZone = profileRow?.timezone || 'Asia/Dhaka';
    const dailyTargetMinutes = profileRow?.dailyStudyTargetMinutes || 360;

    const allSessions = await db
      .select()
      .from(studySessions)
      .where(eq(studySessions.userId, userId));

    const allTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId));

    const userGoals = await db
      .select()
      .from(goals)
      .where(eq(goals.userId, userId));

    const todayYmd = toDateStringInTz(new Date(), timeZone);
    const streakData = computeStreaksFromDates(
      allSessions.map((s) => s.startTime),
      timeZone
    );

    // 1. Deterministically recompute each goal's currentValue and status
    const goalUpdates: Promise<any>[] = [];
    for (const goal of userGoals) {
      let currentValue = 0;

      if (goal.unit === 'days' || goal.goalType === 'streak') {
        currentValue = streakData.currentStreak;
      } else {
        const matchingSessions = allSessions.filter((s) => {
          const sessionYmd = toDateStringInTz(s.startTime, timeZone);
          const inDateRange =
            sessionYmd >= goal.startDate && sessionYmd <= goal.endDate;
          const matchesSubject = !goal.subjectId || s.subjectId === goal.subjectId;
          return inDateRange && matchesSubject;
        });

        if (goal.unit === 'sessions') {
          currentValue = matchingSessions.length;
        } else {
          // unit === 'minutes'
          const totalSec = matchingSessions.reduce(
            (acc, s) => acc + s.durationSeconds,
            0
          );
          currentValue = Math.round(totalSec / 60);
        }
      }

      let status = 'active';
      if (currentValue >= goal.targetValue) {
        status = 'completed';
      } else if (goal.endDate < todayYmd) {
        status = 'expired';
      }

      if (goal.currentValue !== currentValue || goal.status !== status) {
        goalUpdates.push(
          db
            .update(goals)
            .set({
              currentValue,
              status,
              updatedAt: new Date(),
            })
            .where(and(eq(goals.id, goal.id), eq(goals.userId, userId)))
        );
      }
    }
    if (goalUpdates.length > 0) {
      await Promise.all(goalUpdates);
    }

    // 2. Evaluate Achievements
    const totalSeconds = allSessions.reduce((acc, s) => acc + s.durationSeconds, 0);
    const totalHours = totalSeconds / 3600;
    const completedTasksCount = allTasks.filter((t) => t.status === 'completed').length;
    const distinctSubjectsCount = new Set(allSessions.map((s) => s.subjectId)).size;

    // Group daily minutes by YYYY-MM and YYYY-MM-DD to check "Monthly Warrior" (20 daily goals in 1 month)
    const dailySecondsByYmd: Record<string, number> = {};
    for (const s of allSessions) {
      const ymd = toDateStringInTz(s.startTime, timeZone);
      dailySecondsByYmd[ymd] = (dailySecondsByYmd[ymd] || 0) + s.durationSeconds;
    }

    const monthlyGoalDaysCount: Record<string, number> = {};
    for (const [ymd, sec] of Object.entries(dailySecondsByYmd)) {
      if (sec / 60 >= dailyTargetMinutes) {
        const ym = ymd.slice(0, 7);
        monthlyGoalDaysCount[ym] = (monthlyGoalDaysCount[ym] || 0) + 1;
      }
    }
    const maxMonthlyGoalDays = Math.max(0, ...Object.values(monthlyGoalDaysCount));

    const catalog = await db.select().from(achievements);
    const existingUnlocks = await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId));
    const unlockedIds = new Set(existingUnlocks.map((u) => u.achievementId));

    const newlyUnlocked: string[] = [];
    const achievementsToInsert: { userId: string; achievementId: string }[] = [];

    for (const ach of catalog) {
      if (unlockedIds.has(ach.id)) continue;

      let met = false;
      if (ach.requirementType === 'sessions_count') {
        met = allSessions.length >= ach.requirementValue;
      } else if (ach.requirementType === 'total_hours') {
        met = totalHours >= ach.requirementValue;
      } else if (ach.requirementType === 'streak_days') {
        met =
          streakData.longestStreak >= ach.requirementValue ||
          streakData.currentStreak >= ach.requirementValue;
      } else if (ach.requirementType === 'monthly_daily_goals') {
        met = maxMonthlyGoalDays >= ach.requirementValue;
      } else if (ach.requirementType === 'completed_tasks') {
        met = completedTasksCount >= ach.requirementValue;
      } else if (ach.requirementType === 'subjects_studied') {
        met = distinctSubjectsCount >= ach.requirementValue;
      }

      if (met) {
        newlyUnlocked.push(ach.title);
        achievementsToInsert.push({
          userId,
          achievementId: ach.id,
        });
      }
    }

    if (achievementsToInsert.length > 0) {
      await db
        .insert(userAchievements)
        .values(achievementsToInsert)
        .onConflictDoNothing();
    }

    return { newlyUnlocked, streakData };
  } catch (error) {
    console.error('Database error in recalculateGoalsAndAchievements:', error);
    throw new Error('Failed to recalculate goals and achievements.', { cause: error });
  }
}

/**
 * Fetches the full synchronized workspace payload for the authenticated user.
 */
export async function getUserWorkspaceData(userId: string, email: string, name?: string) {
  try {
    const [
      profileRows,
      notifPrefsRows,
      userSubjects,
      userSessions,
      activeTimers,
      userTasks,
      userSchedules,
      userGoals,
      catalogAchievements,
      unlockedAchievements,
      allConfigs,
    ] = await Promise.all([
      db.select().from(profiles).where(eq(profiles.userId, userId)),
      db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)),
      db
        .select()
        .from(subjects)
        .where(eq(subjects.userId, userId))
        .orderBy(asc(subjects.createdAt)),
      db
        .select()
        .from(studySessions)
        .where(eq(studySessions.userId, userId))
        .orderBy(desc(studySessions.startTime)),
      db
        .select()
        .from(activeTimerSessions)
        .where(eq(activeTimerSessions.userId, userId)),
      db
        .select()
        .from(tasks)
        .where(eq(tasks.userId, userId))
        .orderBy(asc(tasks.dueDate)),
      db
        .select()
        .from(schedules)
        .where(eq(schedules.userId, userId))
        .orderBy(asc(schedules.dayOfWeek), asc(schedules.startTime)),
      db
        .select()
        .from(goals)
        .where(eq(goals.userId, userId))
        .orderBy(desc(goals.createdAt)),
      inMemoryCatalogCache
        ? Promise.resolve(inMemoryCatalogCache)
        : db.select().from(achievements).orderBy(asc(achievements.requirementValue)),
      db
        .select()
        .from(userAchievements)
        .where(eq(userAchievements.userId, userId)),
      db
        .select()
        .from(systemConfigurations)
        .catch(() => []),
    ]);

    const sysConfigMap: Record<string, string> = {};
    if (allConfigs && Array.isArray(allConfigs)) {
      for (const c of allConfigs) {
        sysConfigMap[c.key] = c.value;
      }
    }
    const announcementBanner = sysConfigMap['announcement_banner'] || '';

    let profile = profileRows[0];
    if (!profile) {
      profile = await getOrCreateProfile(userId, email, name);
    }

    let notifPrefs = notifPrefsRows[0];
    if (!notifPrefs) {
      notifPrefs = await getNotificationPrefs(userId);
    }

    let finalCatalog = inMemoryCatalogCache || catalogAchievements;
    if (finalCatalog.length === 0) {
      await ensureAchievementsCatalog();
      finalCatalog = await db.select().from(achievements).orderBy(asc(achievements.requirementValue));
      if (finalCatalog.length === 0) {
        finalCatalog = DEFAULT_ACHIEVEMENTS.map((a) => ({
          ...a,
          createdAt: new Date(0),
        }));
      }
    }
    inMemoryCatalogCache = finalCatalog;
    achievementsSeeded = true;

    return {
      profile,
      notificationPreferences: notifPrefs,
      subjects: userSubjects,
      studySessions: userSessions,
      activeTimer: activeTimers[0] || null,
      tasks: userTasks,
      schedules: userSchedules,
      goals: userGoals,
      achievementsCatalog: finalCatalog,
      userAchievements: unlockedAchievements,
      systemConfigurations: sysConfigMap,
      announcementBanner,
      targetedAnnouncement: profile?.targetedAnnouncement || '',
    };
  } catch (error) {
    console.error('Database error in getUserWorkspaceData:', error);
    throw new Error('Failed to load workspace data. Please try again.', { cause: error });
  }
}

/**
 * Onboarding setup transaction
 */
export async function completeUserOnboarding(
  userId: string,
  email: string,
  payload: {
    fullName: string;
    avatarUrl?: string;
    dailyStudyTargetMinutes: number;
    preferredStudyTime: string;
    timezone: string;
    initialSubjects: Array<{
      name: string;
      description?: string;
      color: string;
      icon: string;
      dailyTargetMinutes: number;
      weeklyTargetMinutes: number;
    }>;
  }
) {
  try {
    await getOrCreateProfile(userId, email, payload.fullName);

    const updatedProfile = await db
      .update(profiles)
      .set({
        fullName: payload.fullName.trim(),
        avatarUrl: payload.avatarUrl || '',
        dailyStudyTargetMinutes: payload.dailyStudyTargetMinutes,
        preferredStudyTime: payload.preferredStudyTime,
        timezone: payload.timezone || 'Asia/Dhaka',
        onboardingCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, userId))
      .returning();

    const existingSubjects = await db
      .select()
      .from(subjects)
      .where(eq(subjects.userId, userId));

    if (existingSubjects.length === 0 && payload.initialSubjects.length > 0) {
      for (const sub of payload.initialSubjects) {
        await db.insert(subjects).values({
          userId,
          name: sub.name.trim(),
          description: sub.description || '',
          color: sub.color || '#2563EB',
          icon: sub.icon || 'BookOpen',
          dailyTargetMinutes: sub.dailyTargetMinutes || 60,
          weeklyTargetMinutes: sub.weeklyTargetMinutes || 300,
          isArchived: false,
        });
      }
    }

    // Create an initial daily goal if none exists
    const existingGoals = await db
      .select()
      .from(goals)
      .where(eq(goals.userId, userId));

    if (existingGoals.length === 0) {
      const todayYmd = toDateStringInTz(new Date(), payload.timezone || 'Asia/Dhaka');
      await db.insert(goals).values({
        userId,
        title: `Daily Study Target (${Math.round(payload.dailyStudyTargetMinutes / 60)}h)`,
        goalType: 'daily',
        targetValue: payload.dailyStudyTargetMinutes,
        currentValue: 0,
        unit: 'minutes',
        startDate: todayYmd,
        endDate: addDaysToYmd(todayYmd, 30),
        status: 'active',
      });
    }

    await recalculateGoalsAndAchievements(userId);
    return updatedProfile[0];
  } catch (error) {
    console.error('Database error in completeUserOnboarding:', error);
    throw new Error('Failed to save onboarding configuration.', { cause: error });
  }
}

/**
 * Validates ownership of a subject for IDOR protection
 */
export async function verifySubjectOwnership(userId: string, subjectId: string) {
  const rows = await db
    .select()
    .from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)));
  if (rows.length === 0) {
    throw new Error('Subject not found or access denied.');
  }
  return rows[0];
}

/**
 * Creates a study session inside a transaction with overlap checking and idempotency protection
 */
export async function createStudySessionTransactional(
  userId: string,
  data: {
    subjectId: string;
    startTime: Date;
    endTime: Date;
    topic: string;
    notes?: string;
    productivityRating?: number;
    sessionType: 'manual' | 'timer';
    idempotencyKey?: string;
    clearActiveTimer?: boolean;
  }
) {
  try {
    return await db.transaction(async (tx) => {
      // 1. Verify subject ownership
      const subRows = await tx
        .select()
        .from(subjects)
        .where(and(eq(subjects.id, data.subjectId), eq(subjects.userId, userId)));
      if (subRows.length === 0) {
        throw new Error('Selected subject does not exist or belongs to another account.');
      }

      // 2. Check idempotency key to prevent duplicate session submissions
      if (data.idempotencyKey) {
        const dup = await tx
          .select()
          .from(studySessions)
          .where(
            and(
              eq(studySessions.idempotencyKey, data.idempotencyKey),
              eq(studySessions.userId, userId)
            )
          );
        if (dup.length > 0) {
          if (data.clearActiveTimer) {
            await tx
              .delete(activeTimerSessions)
              .where(eq(activeTimerSessions.userId, userId));
          }
          return { session: dup[0], duplicate: true };
        }
      }

      // 3. Calculate duration strictly from timestamps
      const durationSeconds = Math.round(
        (data.endTime.getTime() - data.startTime.getTime()) / 1000
      );
      if (durationSeconds <= 0) {
        throw new Error('End time must be after start time.');
      }
      if (durationSeconds > 86400) {
        throw new Error('A single study session cannot exceed 24 hours.');
      }

      // 4. For manual sessions, verify no overlapping session exists for this user
      if (data.sessionType === 'manual') {
        const overlapping = await tx
          .select()
          .from(studySessions)
          .where(
            and(
              eq(studySessions.userId, userId),
              lt(studySessions.startTime, data.endTime),
              gt(studySessions.endTime, data.startTime)
            )
          );

        if (overlapping.length > 0) {
          throw new Error(
            'This time interval overlaps with an existing recorded study session.'
          );
        }
      }

      const [inserted] = await tx
        .insert(studySessions)
        .values({
          userId,
          subjectId: data.subjectId,
          idempotencyKey: data.idempotencyKey || null,
          startTime: data.startTime,
          endTime: data.endTime,
          durationSeconds,
          topic: data.topic.trim() || 'Focused Study',
          notes: data.notes?.trim() || '',
          productivityRating: data.productivityRating || 4,
          sessionType: data.sessionType,
        })
        .returning();

      if (data.clearActiveTimer) {
        await tx
          .delete(activeTimerSessions)
          .where(eq(activeTimerSessions.userId, userId));
      }

      return { session: inserted, duplicate: false };
    });
  } catch (error: any) {
    console.error('Database error in createStudySessionTransactional:', error);
    throw new Error(error.message || 'Failed to record study session.', { cause: error });
  }
}

/**
 * Updates an existing study session with overlap checking and ownership verification
 */
export async function updateStudySessionTransactional(
  userId: string,
  sessionId: string,
  data: Partial<{
    subjectId: string;
    startTime: Date;
    endTime: Date;
    topic: string;
    notes?: string;
    productivityRating?: number;
  }>
) {
  try {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(studySessions)
        .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)));

      if (existing.length === 0) {
        throw new Error('Study session not found or access denied.');
      }

      const prev = existing[0];
      const subjectId = data.subjectId ?? prev.subjectId;
      const startTime = data.startTime ?? prev.startTime;
      const endTime = data.endTime ?? prev.endTime;
      const topic = data.topic ? data.topic.trim() : prev.topic;
      const notes = data.notes !== undefined ? data.notes.trim() : prev.notes;
      const productivityRating = data.productivityRating ?? prev.productivityRating;

      const subRows = await tx
        .select()
        .from(subjects)
        .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)));
      if (subRows.length === 0) {
        throw new Error('Selected subject not found or access denied.');
      }

      const durationSeconds = Math.round(
        (endTime.getTime() - startTime.getTime()) / 1000
      );
      if (durationSeconds <= 0) {
        throw new Error('End time must be after start time.');
      }

      const overlapping = await tx
        .select()
        .from(studySessions)
        .where(
          and(
            eq(studySessions.userId, userId),
            ne(studySessions.id, sessionId),
            lt(studySessions.startTime, endTime),
            gt(studySessions.endTime, startTime)
          )
        );

      if (overlapping.length > 0) {
        throw new Error(
          'Updated time interval overlaps with another recorded study session.'
        );
      }

      const [updated] = await tx
        .update(studySessions)
        .set({
          subjectId,
          startTime,
          endTime,
          durationSeconds,
          topic: topic || 'Focused Study',
          notes: notes || '',
          productivityRating: productivityRating || 4,
          updatedAt: new Date(),
        })
        .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)))
        .returning();

      return updated;
    });
  } catch (error: any) {
    console.error('Database error in updateStudySessionTransactional:', error);
    throw new Error(error.message || 'Failed to update study session.', { cause: error });
  }
}

/**
 * Deletes a study session and recalculates goals and achievements
 */
export async function deleteStudySessionTransactional(userId: string, sessionId: string) {
  try {
    const deleted = await db
      .delete(studySessions)
      .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)))
      .returning();

    if (deleted.length === 0) {
      throw new Error('Study session not found or access denied.');
    }

    await recalculateGoalsAndAchievements(userId);
    return deleted[0];
  } catch (error: any) {
    console.error('Database error in deleteStudySessionTransactional:', error);
    throw new Error(error.message || 'Failed to delete study session.', { cause: error });
  }
}

/**
 * Restores a user's backup bundle transactionally (merge or replace mode)
 */
export async function restoreUserBackupTransactional(
  userId: string,
  email: string,
  backup: {
    mode: 'merge' | 'replace';
    profile?: any;
    subjects?: any[];
    studySessions?: any[];
    tasks?: any[];
    schedules?: any[];
    goals?: any[];
  }
) {
  try {
    await db.transaction(async (tx) => {
      if (backup.mode === 'replace') {
        await tx.delete(activeTimerSessions).where(eq(activeTimerSessions.userId, userId));
        await tx.delete(studySessions).where(eq(studySessions.userId, userId));
        await tx.delete(tasks).where(eq(tasks.userId, userId));
        await tx.delete(schedules).where(eq(schedules.userId, userId));
        await tx.delete(goals).where(eq(goals.userId, userId));
        await tx.delete(subjects).where(eq(subjects.userId, userId));
      }

      if (backup.profile) {
        await tx
          .update(profiles)
          .set({
            fullName: backup.profile.fullName || 'Student Scholar',
            dailyStudyTargetMinutes: Number(backup.profile.dailyStudyTargetMinutes) || 360,
            preferredStudyTime: backup.profile.preferredStudyTime || 'evening',
            timezone: backup.profile.timezone || 'Asia/Dhaka',
            themePreference: backup.profile.themePreference || 'light',
            pomodoroFocusMinutes: Number(backup.profile.pomodoroFocusMinutes) || 25,
            pomodoroShortBreakMinutes: Number(backup.profile.pomodoroShortBreakMinutes) || 5,
            pomodoroLongBreakMinutes: Number(backup.profile.pomodoroLongBreakMinutes) || 15,
            pomodoroLongBreakInterval: Number(backup.profile.pomodoroLongBreakInterval) || 4,
            onboardingCompleted: true,
            updatedAt: new Date(),
          })
          .where(eq(profiles.userId, userId));
      }

      // Map old subject IDs to newly ensured subject IDs for this user
      const subjectIdMap = new Map<string, string>();
      const existingSubjects = await tx
        .select()
        .from(subjects)
        .where(eq(subjects.userId, userId));

      for (const s of existingSubjects) {
        subjectIdMap.set(s.id, s.id);
      }

      if (Array.isArray(backup.subjects)) {
        for (const sub of backup.subjects) {
          const matchingByName = existingSubjects.find(
            (e) => e.name.toLowerCase() === String(sub.name || '').toLowerCase()
          );
          if (matchingByName && backup.mode === 'merge') {
            subjectIdMap.set(sub.id, matchingByName.id);
          } else {
            const [insertedSub] = await tx
              .insert(subjects)
              .values({
                userId,
                name: String(sub.name || 'Subject').slice(0, 100),
                description: String(sub.description || ''),
                color: String(sub.color || '#2563EB'),
                icon: String(sub.icon || 'BookOpen'),
                dailyTargetMinutes: Number(sub.dailyTargetMinutes) || 60,
                weeklyTargetMinutes: Number(sub.weeklyTargetMinutes) || 300,
                isArchived: Boolean(sub.isArchived),
                notes: String(sub.notes || ''),
              })
              .returning();
            if (sub.id) {
              subjectIdMap.set(sub.id, insertedSub.id);
            }
          }
        }
      }

      if (Array.isArray(backup.studySessions) && backup.studySessions.length > 0) {
        const sessionValues = [];
        for (const sess of backup.studySessions) {
          const targetSubjectId = subjectIdMap.get(sess.subjectId);
          if (!targetSubjectId) continue;
          const startTime = new Date(sess.startTime);
          const endTime = new Date(sess.endTime);
          const durationSeconds = Math.round(
            (endTime.getTime() - startTime.getTime()) / 1000
          );
          if (isNaN(durationSeconds) || durationSeconds <= 0) continue;

          sessionValues.push({
            userId,
            subjectId: targetSubjectId,
            startTime,
            endTime,
            durationSeconds,
            topic: String(sess.topic || 'Restored Session'),
            notes: String(sess.notes || ''),
            productivityRating: Number(sess.productivityRating) || 4,
            sessionType: sess.sessionType === 'timer' ? ('timer' as const) : ('manual' as const),
          });
        }
        if (sessionValues.length > 0) {
          await tx.insert(studySessions).values(sessionValues);
        }
      }

      if (Array.isArray(backup.tasks) && backup.tasks.length > 0) {
        const taskValues = [];
        for (const t of backup.tasks) {
          const targetSubjectId = subjectIdMap.get(t.subjectId);
          if (!targetSubjectId) continue;
          taskValues.push({
            userId,
            subjectId: targetSubjectId,
            title: String(t.title || 'Restored Task'),
            description: String(t.description || ''),
            dueDate: new Date(t.dueDate || Date.now()),
            priority: (['low', 'medium', 'high'].includes(t.priority) ? t.priority : 'medium') as 'low' | 'medium' | 'high',
            status: (['pending', 'in_progress', 'completed'].includes(t.status)
              ? t.status
              : 'pending') as 'pending' | 'in_progress' | 'completed',
            completedAt: t.completedAt ? new Date(t.completedAt) : null,
          });
        }
        if (taskValues.length > 0) {
          await tx.insert(tasks).values(taskValues);
        }
      }

      if (Array.isArray(backup.schedules) && backup.schedules.length > 0) {
        const scheduleValues = [];
        for (const sch of backup.schedules) {
          const targetSubjectId = subjectIdMap.get(sch.subjectId);
          if (!targetSubjectId) continue;
          scheduleValues.push({
            userId,
            subjectId: targetSubjectId,
            dayOfWeek: Number(sch.dayOfWeek) || 0,
            startTime: String(sch.startTime || '09:00'),
            endTime: String(sch.endTime || '10:00'),
            description: String(sch.description || ''),
          });
        }
        if (scheduleValues.length > 0) {
          await tx.insert(schedules).values(scheduleValues);
        }
      }

      if (Array.isArray(backup.goals) && backup.goals.length > 0) {
        const goalValues = [];
        for (const g of backup.goals) {
          const targetSubjectId = g.subjectId ? subjectIdMap.get(g.subjectId) || null : null;
          goalValues.push({
            userId,
            subjectId: targetSubjectId,
            title: String(g.title || 'Restored Goal'),
            goalType: (g.goalType || 'daily') as any,
            targetValue: Number(g.targetValue) || 60,
            currentValue: 0,
            unit: (g.unit || 'minutes') as any,
            startDate: String(g.startDate || new Date().toISOString().slice(0, 10)),
            endDate: String(g.endDate || new Date().toISOString().slice(0, 10)),
            status: 'active' as const,
          });
        }
        if (goalValues.length > 0) {
          await tx.insert(goals).values(goalValues);
        }
      }
    });

    await recalculateGoalsAndAchievements(userId);
  } catch (error: any) {
    console.error('Database error in restoreUserBackupTransactional:', error);
    throw new Error(error.message || 'Failed to restore backup data.', { cause: error });
  }
}

/**
 * Deletes all user data and account profile records inside a transaction
 */
export async function deleteUserAccountTransactional(userId: string) {
  try {
    await db.transaction(async (tx) => {
      await tx.delete(syncEvents).where(eq(syncEvents.userId, userId));
      await tx.delete(activeTimerSessions).where(eq(activeTimerSessions.userId, userId));
      await tx.delete(userAchievements).where(eq(userAchievements.userId, userId));
      await tx.delete(studySessions).where(eq(studySessions.userId, userId));
      await tx.delete(tasks).where(eq(tasks.userId, userId));
      await tx.delete(schedules).where(eq(schedules.userId, userId));
      await tx.delete(goals).where(eq(goals.userId, userId));
      await tx.delete(subjects).where(eq(subjects.userId, userId));
      await tx.delete(revisionRecords).where(eq(revisionRecords.userId, userId));
      await tx
        .delete(userCurriculumCustomizations)
        .where(eq(userCurriculumCustomizations.userId, userId));
      await tx.delete(curriculumResources).where(eq(curriculumResources.userId, userId));
      await tx.delete(curriculumTopics).where(eq(curriculumTopics.userId, userId));
      await tx.delete(curriculumPapers).where(eq(curriculumPapers.userId, userId));
      await tx.delete(curriculumSubjects).where(eq(curriculumSubjects.userId, userId));
      await tx
        .delete(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId));
      await tx.delete(profiles).where(eq(profiles.userId, userId));
    });
  } catch (error) {
    console.error('Database error in deleteUserAccountTransactional:', error);
    throw new Error('Failed to delete account data.', { cause: error });
  }
}

// ==============================================================================
// REVISION TRACKER & CURRICULUM REPOSITORY
// ==============================================================================

/**
 * Loads the complete revision workspace:
 * - Dynamically queries global curriculum subjects, papers, topics, and revision stages (userId IS NULL)
 *   from PostgreSQL, falling back to static constants if tables are empty.
 * - User-added custom curriculum subjects, papers, and topics (userId = userId)
 * - User customizations (hidden, custom title, custom order)
 * - User's revision activity records
 * - User's curriculum resources
 */
export async function getRevisionWorkspaceData(userId: string) {
  // 1. Query user-specific dynamic data, global curriculum (userId IS NULL), and stages in parallel
  const [
    userSubjects,
    userPapers,
    userTopics,
    customizationsList,
    recordsList,
    resourcesList,
    globalSubjects,
    globalPapers,
    globalTopics,
    dbStages,
  ] = await Promise.all([
    db
      .select()
      .from(curriculumSubjects)
      .where(eq(curriculumSubjects.userId, userId))
      .orderBy(asc(curriculumSubjects.displayOrder)),
    db
      .select()
      .from(curriculumPapers)
      .where(eq(curriculumPapers.userId, userId))
      .orderBy(asc(curriculumPapers.displayOrder)),
    db
      .select()
      .from(curriculumTopics)
      .where(eq(curriculumTopics.userId, userId))
      .orderBy(asc(curriculumTopics.displayOrder)),
    db
      .select()
      .from(userCurriculumCustomizations)
      .where(eq(userCurriculumCustomizations.userId, userId)),
    db
      .select()
      .from(revisionRecords)
      .where(eq(revisionRecords.userId, userId))
      .orderBy(desc(revisionRecords.updatedAt)),
    db
      .select()
      .from(curriculumResources)
      .where(eq(curriculumResources.userId, userId))
      .orderBy(desc(curriculumResources.createdAt)),
    db
      .select()
      .from(curriculumSubjects)
      .where(isNull(curriculumSubjects.userId))
      .orderBy(asc(curriculumSubjects.displayOrder)),
    db
      .select()
      .from(curriculumPapers)
      .where(isNull(curriculumPapers.userId))
      .orderBy(asc(curriculumPapers.displayOrder)),
    db
      .select()
      .from(curriculumTopics)
      .where(isNull(curriculumTopics.userId))
      .orderBy(asc(curriculumTopics.displayOrder)),
    db
      .select()
      .from(curriculumStages)
      .orderBy(asc(curriculumStages.displayOrder)),
  ]);

  // 2. Build fast lookup map for customizations: `${targetType}_${targetId}`
  const custMap = new Map<string, (typeof customizationsList)[0]>();
  for (const c of customizationsList) {
    custMap.set(`${c.targetType}_${c.targetId}`, c);
  }

  // 3. Merge subjects: global defaults (from DB with fallback to static constants) + user subjects
  let baseSubjects = globalSubjects;
  if (!baseSubjects || baseSubjects.length === 0) {
    baseSubjects = DEFAULT_SUBJECTS as unknown as typeof globalSubjects;
  } else {
    // If DB has global subjects, ensure any default subjects not yet explicitly customized in DB are retained
    const dbSubjectIds = new Set(baseSubjects.map((s) => s.id));
    const missingDefaults = DEFAULT_SUBJECTS.filter((s) => !dbSubjectIds.has(s.id));
    if (missingDefaults.length > 0) {
      baseSubjects = [...baseSubjects, ...(missingDefaults as unknown as typeof globalSubjects)];
    }
  }

  const userSubjectIdSet = new Set(userSubjects.map((s) => s.id));
  const subjectsList = [
    ...baseSubjects.filter((s) => !userSubjectIdSet.has(s.id)),
    ...userSubjects,
  ]
    .map((s) => {
      const cust = custMap.get(`subject_${s.id}`);
      return {
        ...s,
        name: cust?.customTitle ? cust.customTitle : s.name,
        displayOrder:
          cust?.customOrder !== null && cust?.customOrder !== undefined
            ? cust.customOrder
            : s.displayOrder,
        isHidden: cust?.isHidden ?? false,
      };
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);

  // 4. Merge papers: global defaults (from DB with fallback to static constants) + user papers
  let basePapers = globalPapers;
  if (!basePapers || basePapers.length === 0) {
    basePapers = DEFAULT_PAPERS as unknown as typeof globalPapers;
  } else {
    const dbPaperIds = new Set(basePapers.map((p) => p.id));
    const missingDefaults = DEFAULT_PAPERS.filter((p) => !dbPaperIds.has(p.id));
    if (missingDefaults.length > 0) {
      basePapers = [...basePapers, ...(missingDefaults as unknown as typeof globalPapers)];
    }
  }

  const userPaperIdSet = new Set(userPapers.map((p) => p.id));
  const papersList = [
    ...basePapers.filter((p) => !userPaperIdSet.has(p.id)),
    ...userPapers,
  ]
    .map((p) => {
      const cust = custMap.get(`paper_${p.id}`);
      return {
        ...p,
        title: cust?.customTitle ? cust.customTitle : p.title,
        displayOrder:
          cust?.customOrder !== null && cust?.customOrder !== undefined
            ? cust.customOrder
            : p.displayOrder,
        isHidden: cust?.isHidden ?? false,
      };
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);

  // 5. Merge topics: global defaults (from DB with fallback to static constants) + user topics
  let baseTopics = globalTopics;
  if (!baseTopics || baseTopics.length === 0) {
    baseTopics = DEFAULT_TOPICS as unknown as typeof globalTopics;
  } else {
    const dbTopicIds = new Set(baseTopics.map((t) => t.id));
    const missingDefaults = DEFAULT_TOPICS.filter((t) => !dbTopicIds.has(t.id));
    if (missingDefaults.length > 0) {
      baseTopics = [...baseTopics, ...(missingDefaults as unknown as typeof globalTopics)];
    }
  }

  const userTopicIdSet = new Set(userTopics.map((t) => t.id));
  const topicsList = [
    ...baseTopics.filter((t) => !userTopicIdSet.has(t.id)),
    ...userTopics,
  ]
    .map((t) => {
      const cust = custMap.get(`topic_${t.id}`);
      return {
        ...t,
        title: cust?.customTitle ? cust.customTitle : t.title,
        displayOrder:
          cust?.customOrder !== null && cust?.customOrder !== undefined
            ? cust.customOrder
            : t.displayOrder,
        isHidden: cust?.isHidden ?? false,
      };
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);

  // 6. Stages: from DB with fallback to default REVISION_CATEGORIES
  let effectiveStages = dbStages;
  if (!effectiveStages || effectiveStages.length === 0) {
    effectiveStages = REVISION_CATEGORIES.map((cat, idx) => ({
      id: cat.id,
      name: cat.label,
      color: cat.color,
      badgeText: cat.shortLabel,
      displayOrder: idx,
      weight: 1,
      isActive: true,
      createdAt: new Date(),
    })) as unknown as typeof dbStages;
  }

  return {
    subjects: subjectsList,
    papers: papersList,
    topics: topicsList,
    stages: effectiveStages,
    customizations: customizationsList,
    records: recordsList,
    resources: resourcesList,
  };
}

/**
 * Idempotently toggles a revision activity checkbox.
 * Enforces (userId, topicId, category) uniqueness and UPSERT.
 * Foreign key safe: automatically ensures static syllabus records in DB if missing.
 */
export async function toggleRevisionRecord(
  userId: string,
  data: {
    subjectId: string;
    topicId: string;
    category: string;
    isCompleted: boolean;
    activityDate?: string;
    notes?: string;
  }
) {
  const execute = async () => {
    const activityDate =
      data.activityDate || new Date().toISOString().slice(0, 10);

    // Check previous completion status to award milestone XP accurately
    const [existingRecord] = await db
      .select({ isCompleted: revisionRecords.isCompleted })
      .from(revisionRecords)
      .where(
        and(
          eq(revisionRecords.userId, userId),
          eq(revisionRecords.topicId, data.topicId),
          eq(revisionRecords.category, data.category)
        )
      );

    const wasCompleted = existingRecord?.isCompleted ?? false;

    const [record] = await db
      .insert(revisionRecords)
      .values({
        userId,
        subjectId: data.subjectId,
        topicId: data.topicId,
        category: data.category,
        isCompleted: data.isCompleted,
        activityDate,
        notes: data.notes || '',
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [revisionRecords.userId, revisionRecords.topicId, revisionRecords.category],
        set: {
          isCompleted: data.isCompleted,
          activityDate,
          notes: data.notes !== undefined ? data.notes : undefined,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Award 25 XP per milestone completion (or revoke if unticked)
    if (!wasCompleted && data.isCompleted) {
      await awardUserXp(userId, 25);
    } else if (wasCompleted && !data.isCompleted) {
      await awardUserXp(userId, -25);
    }

    return record;
  };

  try {
    return await execute();
  } catch (error: any) {
    if (error?.code === '23503' || error?.message?.includes('violates foreign key constraint')) {
      await ensureCurriculumSeedData(true);
      return await execute();
    }
    throw error;
  }
}

/**
 * Saves or updates detailed metadata for any of the 6 revision categories
 * Foreign key safe: automatically ensures static syllabus records in DB if missing.
 */
export async function saveDetailedRevisionRecord(
  userId: string,
  data: {
    id?: string;
    subjectId: string;
    topicId: string;
    category: string;
    isCompleted?: boolean;
    activityDate?: string;
    bookName?: string;
    pagesRead?: number;
    questionsSolved?: number;
    correctCount?: number;
    notes?: string;
  }
) {
  const execute = async () => {
    const activityDate =
      data.activityDate || new Date().toISOString().slice(0, 10);

    const nextCompleted = data.isCompleted !== undefined ? data.isCompleted : true;

    const [existingRecord] = await db
      .select({ isCompleted: revisionRecords.isCompleted })
      .from(revisionRecords)
      .where(
        and(
          eq(revisionRecords.userId, userId),
          eq(revisionRecords.topicId, data.topicId),
          eq(revisionRecords.category, data.category)
        )
      );

    const wasCompleted = existingRecord?.isCompleted ?? false;

    const [record] = await db
      .insert(revisionRecords)
      .values({
        userId,
        subjectId: data.subjectId,
        topicId: data.topicId,
        category: data.category,
        isCompleted: nextCompleted,
        activityDate,
        bookName: data.bookName || null,
        pagesRead: data.pagesRead !== undefined ? data.pagesRead : null,
        questionsSolved: data.questionsSolved !== undefined ? data.questionsSolved : null,
        correctCount: data.correctCount !== undefined ? data.correctCount : null,
        notes: data.notes || '',
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [revisionRecords.userId, revisionRecords.topicId, revisionRecords.category],
        set: {
          isCompleted: nextCompleted,
          activityDate,
          bookName: data.bookName !== undefined ? data.bookName : undefined,
          pagesRead: data.pagesRead !== undefined ? data.pagesRead : undefined,
          questionsSolved:
            data.questionsSolved !== undefined ? data.questionsSolved : undefined,
          correctCount: data.correctCount !== undefined ? data.correctCount : undefined,
          notes: data.notes !== undefined ? data.notes : undefined,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!wasCompleted && nextCompleted) {
      await awardUserXp(userId, 25);
    } else if (wasCompleted && !nextCompleted) {
      await awardUserXp(userId, -25);
    }

    return record;
  };

  try {
    return await execute();
  } catch (error: any) {
    if (error?.code === '23503' || error?.message?.includes('violates foreign key constraint')) {
      await ensureCurriculumSeedData(true);
      return await execute();
    }
    throw error;
  }
}

/**
 * Deletes or resets a revision record
 */
export async function deleteRevisionRecord(userId: string, recordId: string) {
  const [existingRecord] = await db
    .select({ isCompleted: revisionRecords.isCompleted })
    .from(revisionRecords)
    .where(and(eq(revisionRecords.id, recordId), eq(revisionRecords.userId, userId)));

  const deleted = await db
    .delete(revisionRecords)
    .where(and(eq(revisionRecords.id, recordId), eq(revisionRecords.userId, userId)))
    .returning();

  if (existingRecord?.isCompleted) {
    await awardUserXp(userId, -25);
  }

  return deleted[0] || null;
}

/**
 * Allows user to create a custom topic/chapter under an existing paper/subject
 */
export async function addCustomCurriculumTopic(
  userId: string,
  data: {
    paperId: string;
    subjectId: string;
    title: string;
    chapterNumber?: number | null;
  }
) {
  const execute = async () => {
    // Get max display order for this paper considering both static defaults and user topics
    const staticTopicsForPaper = DEFAULT_TOPICS.filter((t) => t.paperId === data.paperId);
    const maxStaticOrder = staticTopicsForPaper.reduce((max, t) => Math.max(max, t.displayOrder), 0);

    const existing = await db
      .select({ displayOrder: curriculumTopics.displayOrder })
      .from(curriculumTopics)
      .where(
        and(
          eq(curriculumTopics.paperId, data.paperId),
          eq(curriculumTopics.userId, userId)
        )
      )
      .orderBy(desc(curriculumTopics.displayOrder))
      .limit(1);

    const maxDbOrder = existing[0]?.displayOrder || 0;
    const nextOrder = Math.max(maxStaticOrder, maxDbOrder) + 1;

    const [topic] = await db
      .insert(curriculumTopics)
      .values({
        userId,
        paperId: data.paperId,
        subjectId: data.subjectId,
        title: data.title.trim(),
        chapterNumber: data.chapterNumber || nextOrder,
        displayOrder: nextOrder,
      })
      .returning();

    return topic;
  };

  try {
    return await execute();
  } catch (error: any) {
    if (error?.code === '23503' || error?.message?.includes('violates foreign key constraint')) {
      await ensureCurriculumSeedData(true);
      return await execute();
    }
    throw error;
  }
}

/**
 * Allows user to create a custom subject
 */
export async function addCustomCurriculumSubject(
  userId: string,
  data: {
    name: string;
    code?: string;
    color?: string;
    icon?: string;
    defaultPaperTitle?: string;
  }
) {
  const code = (data.code || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')).slice(
    0,
    30
  );

  return await db.transaction(async (tx) => {
    const maxStaticOrder = DEFAULT_SUBJECTS.reduce((max, s) => Math.max(max, s.displayOrder), 0);
    const existing = await tx
      .select({ displayOrder: curriculumSubjects.displayOrder })
      .from(curriculumSubjects)
      .where(eq(curriculumSubjects.userId, userId))
      .orderBy(desc(curriculumSubjects.displayOrder))
      .limit(1);

    const maxDbOrder = existing[0]?.displayOrder || 0;
    const nextOrder = Math.max(maxStaticOrder, maxDbOrder) + 1;

    const [subject] = await tx
      .insert(curriculumSubjects)
      .values({
        userId,
        name: data.name.trim(),
        code,
        color: data.color || '#2563EB',
        icon: data.icon || 'BookOpen',
        displayOrder: nextOrder,
      })
      .returning();

    // Create a default paper/section
    const [paper] = await tx
      .insert(curriculumPapers)
      .values({
        userId,
        subjectId: subject.id,
        title: data.defaultPaperTitle || '১ম পত্র / Main Paper',
        paperCode: `${code}_main`,
        displayOrder: 1,
      })
      .returning();

    return { subject, paper };
  });
}

/**
 * Updates user-specific customization (hide, rename, reorder)
 */
export async function updateCurriculumCustomization(
  userId: string,
  data: {
    targetType: 'subject' | 'paper' | 'topic';
    targetId: string;
    isHidden?: boolean;
    customTitle?: string | null;
    customOrder?: number | null;
  }
) {
  const [customization] = await db
    .insert(userCurriculumCustomizations)
    .values({
      userId,
      targetType: data.targetType,
      targetId: data.targetId,
      isHidden: data.isHidden !== undefined ? data.isHidden : false,
      customTitle: data.customTitle !== undefined ? data.customTitle : null,
      customOrder: data.customOrder !== undefined ? data.customOrder : null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        userCurriculumCustomizations.userId,
        userCurriculumCustomizations.targetType,
        userCurriculumCustomizations.targetId,
      ],
      set: {
        isHidden: data.isHidden !== undefined ? data.isHidden : undefined,
        customTitle: data.customTitle !== undefined ? data.customTitle : undefined,
        customOrder: data.customOrder !== undefined ? data.customOrder : undefined,
        updatedAt: new Date(),
      },
    })
    .returning();

  return customization;
}

// ==============================================================================
// SUBJECT CRUD OPERATIONS
// ==============================================================================

export async function createSubject(
  userId: string,
  data: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    dailyTargetMinutes?: number;
    weeklyTargetMinutes?: number;
    isArchived?: boolean;
    notes?: string;
  }
) {
  const [created] = await db
    .insert(subjects)
    .values({
      userId,
      name: data.name,
      description: data.description ?? '',
      color: data.color ?? '#2563EB',
      icon: data.icon ?? 'BookOpen',
      dailyTargetMinutes: data.dailyTargetMinutes ?? 60,
      weeklyTargetMinutes: data.weeklyTargetMinutes ?? 300,
      isArchived: data.isArchived ?? false,
      notes: data.notes ?? '',
      updatedAt: new Date(),
    })
    .returning();

  await recalculateGoalsAndAchievements(userId);
  return created;
}

export async function updateSubject(
  userId: string,
  id: string,
  data: Partial<{
    name: string;
    description: string;
    color: string;
    icon: string;
    dailyTargetMinutes: number;
    weeklyTargetMinutes: number;
    isArchived: boolean;
    notes: string;
  }>
) {
  const [updated] = await db
    .update(subjects)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(subjects.id, id), eq(subjects.userId, userId)))
    .returning();

  await recalculateGoalsAndAchievements(userId);
  return updated;
}

export async function deleteSubject(userId: string, id: string) {
  await db
    .delete(subjects)
    .where(and(eq(subjects.id, id), eq(subjects.userId, userId)));
  await recalculateGoalsAndAchievements(userId);
  return { success: true };
}

// ==============================================================================
// STUDY SESSION CRUD ALIASES
// ==============================================================================

export const createStudySession = createStudySessionTransactional;
export const updateStudySession = updateStudySessionTransactional;
export const deleteStudySession = deleteStudySessionTransactional;

// ==============================================================================
// SUBJECT OWNERSHIP VALIDATION HELPER (IDOR PREVENTION)
// ==============================================================================

export async function verifyUserSubjectOwnership(userId: string, subjectId: string): Promise<boolean> {
  if (!userId || !subjectId) return false;
  const [ownedSubject] = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
    .limit(1);
  return Boolean(ownedSubject);
}

// ==============================================================================
// TASK CRUD OPERATIONS
// ==============================================================================

export async function createTask(
  userId: string,
  data: {
    subjectId: string;
    title: string;
    description?: string;
    dueDate: Date;
    priority?: 'low' | 'medium' | 'high';
    status?: 'pending' | 'in_progress' | 'completed';
  }
) {
  const isOwner = await verifyUserSubjectOwnership(userId, data.subjectId);
  if (!isOwner) {
    throw new Error('Subject not found or access denied.');
  }

  const [created] = await db
    .insert(tasks)
    .values({
      userId,
      subjectId: data.subjectId,
      title: data.title,
      description: data.description ?? '',
      dueDate: data.dueDate,
      priority: data.priority ?? 'medium',
      status: data.status ?? 'pending',
      completedAt: data.status === 'completed' ? new Date() : null,
      updatedAt: new Date(),
    })
    .returning();

  await recalculateGoalsAndAchievements(userId);
  return created;
}

export async function updateTask(
  userId: string,
  id: string,
  data: Partial<{
    subjectId: string;
    title: string;
    description: string;
    dueDate: Date;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'in_progress' | 'completed';
  }>
) {
  if (data.subjectId) {
    const isOwner = await verifyUserSubjectOwnership(userId, data.subjectId);
    if (!isOwner) {
      throw new Error('Subject not found or access denied.');
    }
  }

  const updatePayload: Record<string, unknown> = {
    ...data,
    updatedAt: new Date(),
  };

  if (data.status === 'completed') {
    updatePayload.completedAt = new Date();
  } else if (data.status === 'pending' || data.status === 'in_progress') {
    updatePayload.completedAt = null;
  }

  const [updated] = await db
    .update(tasks)
    .set(updatePayload)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .returning();

  await recalculateGoalsAndAchievements(userId);
  return updated;
}

export async function deleteTask(userId: string, id: string) {
  await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  await recalculateGoalsAndAchievements(userId);
  return { success: true };
}

// ==============================================================================
// SCHEDULE (TIMETABLE) CRUD OPERATIONS
// ==============================================================================

export async function createSchedule(
  userId: string,
  data: {
    subjectId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    description?: string;
  }
) {
  const isOwner = await verifyUserSubjectOwnership(userId, data.subjectId);
  if (!isOwner) {
    throw new Error('Subject not found or access denied.');
  }

  const [created] = await db
    .insert(schedules)
    .values({
      userId,
      subjectId: data.subjectId,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      description: data.description ?? '',
      updatedAt: new Date(),
    })
    .returning();

  return created;
}

export async function updateSchedule(
  userId: string,
  id: string,
  data: Partial<{
    subjectId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    description: string;
  }>
) {
  if (data.subjectId) {
    const isOwner = await verifyUserSubjectOwnership(userId, data.subjectId);
    if (!isOwner) {
      throw new Error('Subject not found or access denied.');
    }
  }

  const [updated] = await db
    .update(schedules)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(schedules.id, id), eq(schedules.userId, userId)))
    .returning();

  return updated;
}

export async function deleteSchedule(userId: string, id: string) {
  await db
    .delete(schedules)
    .where(and(eq(schedules.id, id), eq(schedules.userId, userId)));
  return { success: true };
}

// ==============================================================================
// GOALS CRUD OPERATIONS
// ==============================================================================

export async function createGoal(
  userId: string,
  data: {
    subjectId?: string | null;
    title: string;
    goalType?: 'daily' | 'weekly' | 'monthly' | 'subject' | 'streak' | 'sessions';
    targetValue: number;
    currentValue?: number;
    unit?: 'minutes' | 'sessions' | 'days';
    startDate: string;
    endDate: string;
    status?: 'active' | 'completed' | 'expired';
  }
) {
  if (data.subjectId) {
    const isOwner = await verifyUserSubjectOwnership(userId, data.subjectId);
    if (!isOwner) {
      throw new Error('Subject not found or access denied.');
    }
  }

  const [created] = await db
    .insert(goals)
    .values({
      userId,
      subjectId: data.subjectId ?? null,
      title: data.title,
      goalType: data.goalType ?? 'daily',
      targetValue: data.targetValue,
      currentValue: data.currentValue ?? 0,
      unit: data.unit ?? 'minutes',
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status ?? 'active',
      updatedAt: new Date(),
    })
    .returning();

  return created;
}

export async function updateGoal(
  userId: string,
  id: string,
  data: Partial<{
    subjectId: string | null;
    title: string;
    goalType: 'daily' | 'weekly' | 'monthly' | 'subject' | 'streak' | 'sessions';
    targetValue: number;
    currentValue: number;
    unit: 'minutes' | 'sessions' | 'days';
    startDate: string;
    endDate: string;
    status: 'active' | 'completed' | 'expired';
  }>
) {
  if (data.subjectId) {
    const isOwner = await verifyUserSubjectOwnership(userId, data.subjectId);
    if (!isOwner) {
      throw new Error('Subject not found or access denied.');
    }
  }

  const [updated] = await db
    .update(goals)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .returning();

  return updated;
}

export async function deleteGoal(userId: string, id: string) {
  await db
    .delete(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)));
  return { success: true };
}

// ==============================================================================
// ACTIVE TIMER OPERATIONS
// ==============================================================================

export async function getUserActiveTimer(userId: string) {
  const [timer] = await db
    .select()
    .from(activeTimerSessions)
    .where(eq(activeTimerSessions.userId, userId));
  return timer || null;
}

export async function upsertActiveTimer(
  userId: string,
  data: {
    subjectId: string;
    topic?: string;
    notes?: string;
    mode?: string;
    phase?: string;
    status?: string;
    startedAt: Date;
    lastResumedAt: Date;
    accumulatedSeconds?: number;
    targetDurationSeconds?: number;
    completedPomodoros?: number;
    stateVersion?: number;
    clientDeviceId?: string;
    idempotencyKey: string;
  }
) {
  const [timer] = await db
    .insert(activeTimerSessions)
    .values({
      userId,
      subjectId: data.subjectId,
      topic: data.topic ?? 'Focused Study',
      notes: data.notes ?? '',
      mode: data.mode ?? 'stopwatch',
      phase: data.phase ?? 'focus',
      status: data.status ?? 'running',
      startedAt: data.startedAt,
      lastResumedAt: data.lastResumedAt,
      accumulatedSeconds: data.accumulatedSeconds ?? 0,
      targetDurationSeconds: data.targetDurationSeconds ?? 1500,
      completedPomodoros: data.completedPomodoros ?? 0,
      stateVersion: data.stateVersion ?? 1,
      clientDeviceId: data.clientDeviceId ?? '',
      idempotencyKey: data.idempotencyKey,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [activeTimerSessions.userId],
      set: {
        subjectId: data.subjectId,
        topic: data.topic ?? 'Focused Study',
        notes: data.notes ?? '',
        mode: data.mode ?? 'stopwatch',
        phase: data.phase ?? 'focus',
        status: data.status ?? 'running',
        startedAt: data.startedAt,
        lastResumedAt: data.lastResumedAt,
        accumulatedSeconds: data.accumulatedSeconds ?? 0,
        targetDurationSeconds: data.targetDurationSeconds ?? 1500,
        completedPomodoros: data.completedPomodoros ?? 0,
        stateVersion: data.stateVersion ?? 1,
        clientDeviceId: data.clientDeviceId ?? '',
        idempotencyKey: data.idempotencyKey,
        updatedAt: new Date(),
      },
    })
    .returning();

  return { timer };
}

export async function deleteActiveTimer(userId: string) {
  await db
    .delete(activeTimerSessions)
    .where(eq(activeTimerSessions.userId, userId));
  return { success: true };
}

// ==============================================================================
// PROFILE & PREFERENCES & WORKSPACE UTILITIES
// ==============================================================================

export async function updateUserProfile(
  userId: string,
  data: Partial<{
    fullName: string;
    avatarUrl: string;
    dailyStudyTargetMinutes: number;
    preferredStudyTime: string;
    timezone: string;
    themePreference: string;
    pomodoroFocusMinutes: number;
    pomodoroShortBreakMinutes: number;
    pomodoroLongBreakMinutes: number;
    pomodoroLongBreakInterval: number;
    targetExamName: string;
    targetExamDate: string;
    gamificationXp: number;
  }>
) {
  const [updated] = await db
    .update(profiles)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, userId))
    .returning();

  return updated;
}

export async function updateUserNotificationPreferences(
  userId: string,
  data: Partial<{
    browserNotificationsEnabled: boolean;
    soundChimesEnabled: boolean;
    dailyReminderEnabled: boolean;
    dailyReminderTime: string;
    scheduleReminderEnabled: boolean;
    taskDeadlineReminderEnabled: boolean;
    goalCompletionAlert: boolean;
    streakMilestoneAlert: boolean;
  }>
) {
  const [updated] = await db
    .insert(notificationPreferences)
    .values({
      userId,
      browserNotificationsEnabled: data.browserNotificationsEnabled ?? false,
      soundChimesEnabled: data.soundChimesEnabled ?? true,
      dailyReminderEnabled: data.dailyReminderEnabled ?? true,
      dailyReminderTime: data.dailyReminderTime ?? '19:00',
      scheduleReminderEnabled: data.scheduleReminderEnabled ?? true,
      taskDeadlineReminderEnabled: data.taskDeadlineReminderEnabled ?? true,
      goalCompletionAlert: data.goalCompletionAlert ?? true,
      streakMilestoneAlert: data.streakMilestoneAlert ?? true,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [notificationPreferences.userId],
      set: {
        ...data,
        updatedAt: new Date(),
      },
    })
    .returning();

  return updated;
}

export const restoreUserDataFromBackup = restoreUserBackupTransactional;
export const deleteUserEntireAccount = deleteUserAccountTransactional;

// ==============================================================================
// CHAPTER RESOURCES & BOOKMARKING
// ==============================================================================

export async function createCurriculumResource(
  userId: string,
  data: {
    subjectId: string;
    topicId: string;
    title: string;
    url: string;
    resourceType?: string;
    pageReference?: string;
    notes?: string;
  }
) {
  const execute = async () => {
    const [created] = await db
      .insert(curriculumResources)
      .values({
        userId,
        subjectId: data.subjectId,
        topicId: data.topicId,
        title: data.title,
        url: data.url,
        resourceType: data.resourceType || 'link',
        pageReference: data.pageReference || '',
        notes: data.notes || '',
      })
      .returning();
    return created;
  };

  try {
    return await execute();
  } catch (error: any) {
    if (error?.code === '23503' || error?.message?.includes('violates foreign key constraint')) {
      await ensureCurriculumSeedData(true);
      return await execute();
    }
    throw error;
  }
}

export async function deleteCurriculumResource(userId: string, id: string) {
  await db
    .delete(curriculumResources)
    .where(and(eq(curriculumResources.id, id), eq(curriculumResources.userId, userId)));
}

// ==============================================================================
// RPG GAMIFICATION XP ENGINE
// ==============================================================================

export async function awardUserXp(userId: string, amount: number) {
  const [profile] = await db
    .select({ gamificationXp: profiles.gamificationXp })
    .from(profiles)
    .where(eq(profiles.userId, userId));

  const currentXp = profile?.gamificationXp || 0;
  const newXp = Math.max(0, currentXp + amount);

  const [updated] = await db
    .update(profiles)
    .set({
      gamificationXp: newXp,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, userId))
    .returning();

  return updated;
}

// ==============================================================================
// ADMIN BACKEND REPOSITORY METHODS
// ==============================================================================

// 1. Admin Allowlist
export async function getAllAdminAllowlist() {
  return await db
    .select()
    .from(adminAllowlist)
    .orderBy(desc(adminAllowlist.createdAt));
}

export async function getAdminAllowlistEntry(email: string) {
  const [entry] = await db
    .select()
    .from(adminAllowlist)
    .where(eq(adminAllowlist.email, email.toLowerCase().trim()))
    .limit(1);
  return entry || null;
}

export async function createAdminAllowlistEntry(data: {
  email: string;
  role?: string;
  notes?: string;
  addedBy?: string;
}) {
  const [entry] = await db
    .insert(adminAllowlist)
    .values({
      email: data.email.toLowerCase().trim(),
      role: data.role || 'admin',
      notes: data.notes || '',
      addedBy: data.addedBy || 'system',
    })
    .onConflictDoUpdate({
      target: adminAllowlist.email,
      set: {
        role: data.role || 'admin',
        notes: data.notes || '',
        addedBy: data.addedBy || 'system',
      },
    })
    .returning();
  return entry;
}

export async function deleteAdminAllowlistEntry(email: string) {
  const [deleted] = await db
    .delete(adminAllowlist)
    .where(eq(adminAllowlist.email, email.toLowerCase().trim()))
    .returning();
  return deleted || null;
}

// 2. Curriculum Stages
export async function getAllCurriculumStages() {
  const stages = await db
    .select()
    .from(curriculumStages)
    .orderBy(asc(curriculumStages.displayOrder));

  if (stages.length === 0) {
    return REVISION_CATEGORIES.map((cat, idx) => ({
      id: cat.id,
      name: cat.label,
      color: cat.color,
      badgeText: cat.shortLabel,
      displayOrder: idx,
      weight: 1,
      isActive: true,
      createdAt: new Date(),
    }));
  }

  return stages;
}

export async function getCurriculumStageById(id: string) {
  const [stage] = await db
    .select()
    .from(curriculumStages)
    .where(eq(curriculumStages.id, id))
    .limit(1);
  return stage || null;
}

export async function saveAdminCurriculumStage(data: {
  id: string;
  name: string;
  color?: string;
  badgeText?: string;
  displayOrder?: number;
  weight?: number;
  isActive?: boolean;
}) {
  const [stage] = await db
    .insert(curriculumStages)
    .values({
      id: data.id,
      name: data.name,
      color: data.color || '#3B82F6',
      badgeText: data.badgeText || '',
      displayOrder: data.displayOrder ?? 0,
      weight: data.weight ?? 1,
      isActive: data.isActive ?? true,
    })
    .onConflictDoUpdate({
      target: curriculumStages.id,
      set: {
        name: data.name,
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.badgeText !== undefined ? { badgeText: data.badgeText } : {}),
        ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {}),
        ...(data.weight !== undefined ? { weight: data.weight } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    })
    .returning();
  return stage;
}

export async function deleteAdminCurriculumStage(id: string) {
  const [deleted] = await db
    .delete(curriculumStages)
    .where(eq(curriculumStages.id, id))
    .returning();
  return deleted || null;
}

export async function reorderCurriculumStages(orderedIds: string[]) {
  const results = [];
  for (let order = 0; order < orderedIds.length; order++) {
    const [updated] = await db
      .update(curriculumStages)
      .set({ displayOrder: order })
      .where(eq(curriculumStages.id, orderedIds[order]))
      .returning();
    if (updated) results.push(updated);
  }
  return results;
}

// 3. Goal Templates
export async function getAllGoalTemplates() {
  return await db
    .select()
    .from(goalTemplates)
    .orderBy(desc(goalTemplates.createdAt));
}

export async function getGoalTemplateById(id: string) {
  const [template] = await db
    .select()
    .from(goalTemplates)
    .where(eq(goalTemplates.id, id))
    .limit(1);
  return template || null;
}

export async function saveAdminGoalTemplate(data: {
  id?: string;
  title: string;
  description?: string;
  targetType: string;
  targetValue: number;
  period: string;
  isActive?: boolean;
}) {
  const id = data.id || crypto.randomUUID();
  const [template] = await db
    .insert(goalTemplates)
    .values({
      id,
      title: data.title,
      description: data.description || '',
      targetType: data.targetType,
      targetValue: data.targetValue,
      period: data.period,
      isActive: data.isActive ?? true,
    })
    .onConflictDoUpdate({
      target: goalTemplates.id,
      set: {
        title: data.title,
        ...(data.description !== undefined ? { description: data.description } : {}),
        targetType: data.targetType,
        targetValue: data.targetValue,
        period: data.period,
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    })
    .returning();
  return template;
}

export async function deleteAdminGoalTemplate(id: string) {
  const [deleted] = await db
    .delete(goalTemplates)
    .where(eq(goalTemplates.id, id))
    .returning();
  return deleted || null;
}

// 4. Schedule Templates
export async function getAllScheduleTemplates() {
  return await db
    .select()
    .from(scheduleTemplates)
    .orderBy(asc(scheduleTemplates.dayOfWeek), asc(scheduleTemplates.startTime));
}

export async function getScheduleTemplateById(id: string) {
  const [template] = await db
    .select()
    .from(scheduleTemplates)
    .where(eq(scheduleTemplates.id, id))
    .limit(1);
  return template || null;
}

export async function saveAdminScheduleTemplate(data: {
  id?: string;
  title: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subjectId?: string | null;
  activityType?: string;
  isActive?: boolean;
}) {
  const id = data.id || crypto.randomUUID();
  const [template] = await db
    .insert(scheduleTemplates)
    .values({
      id,
      title: data.title,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      subjectId: data.subjectId || null,
      activityType: data.activityType || 'study',
      isActive: data.isActive ?? true,
    })
    .onConflictDoUpdate({
      target: scheduleTemplates.id,
      set: {
        title: data.title,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        subjectId: data.subjectId || null,
        ...(data.activityType !== undefined ? { activityType: data.activityType } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    })
    .returning();
  return template;
}

export async function deleteAdminScheduleTemplate(id: string) {
  const [deleted] = await db
    .delete(scheduleTemplates)
    .where(eq(scheduleTemplates.id, id))
    .returning();
  return deleted || null;
}

// 5. System Configurations
export async function getAllSystemConfigurations() {
  return await db
    .select()
    .from(systemConfigurations)
    .orderBy(asc(systemConfigurations.key));
}

export async function getSystemConfiguration(key: string) {
  const [config] = await db
    .select()
    .from(systemConfigurations)
    .where(eq(systemConfigurations.key, key))
    .limit(1);
  return config || null;
}

export async function getSystemConfigurationValue(key: string, defaultValue = ''): Promise<string> {
  const config = await getSystemConfiguration(key);
  return config ? config.value : defaultValue;
}

export async function saveAdminSystemConfiguration(data: {
  key: string;
  value: string;
  description?: string;
  updatedBy?: string;
}) {
  const [config] = await db
    .insert(systemConfigurations)
    .values({
      key: data.key,
      value: data.value,
      description: data.description || '',
      updatedAt: new Date(),
      updatedBy: data.updatedBy || 'admin',
    })
    .onConflictDoUpdate({
      target: systemConfigurations.key,
      set: {
        value: data.value,
        ...(data.description !== undefined ? { description: data.description } : {}),
        updatedAt: new Date(),
        updatedBy: data.updatedBy || 'admin',
      },
    })
    .returning();
  return config;
}

export async function deleteAdminSystemConfiguration(key: string) {
  const [deleted] = await db
    .delete(systemConfigurations)
    .where(eq(systemConfigurations.key, key))
    .returning();
  return deleted || null;
}

// 6. Global Curriculum Subjects, Papers, Topics (Admin - userId IS NULL)
export async function getAllGlobalCurriculumSubjects() {
  return await db
    .select()
    .from(curriculumSubjects)
    .where(isNull(curriculumSubjects.userId))
    .orderBy(asc(curriculumSubjects.displayOrder));
}

export async function saveAdminCurriculumSubject(data: {
  id?: string;
  name: string;
  code?: string;
  color?: string;
  icon?: string;
  displayOrder?: number;
}) {
  const id = data.id || crypto.randomUUID();
  const [subject] = await db
    .insert(curriculumSubjects)
    .values({
      id,
      userId: null,
      name: data.name,
      code: data.code || '',
      color: data.color || '#2563EB',
      icon: data.icon || 'BookOpen',
      displayOrder: data.displayOrder ?? 0,
    })
    .onConflictDoUpdate({
      target: curriculumSubjects.id,
      set: {
        name: data.name,
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.icon !== undefined ? { icon: data.icon } : {}),
        ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {}),
      },
    })
    .returning();
  return subject;
}

export async function deleteAdminCurriculumSubject(id: string) {
  const [deleted] = await db
    .delete(curriculumSubjects)
    .where(and(eq(curriculumSubjects.id, id), isNull(curriculumSubjects.userId)))
    .returning();
  return deleted || null;
}

export async function getAllGlobalCurriculumPapers() {
  return await db
    .select()
    .from(curriculumPapers)
    .where(isNull(curriculumPapers.userId))
    .orderBy(asc(curriculumPapers.displayOrder));
}

export async function saveAdminCurriculumPaper(data: {
  id?: string;
  subjectId: string;
  title: string;
  paperCode?: string;
  displayOrder?: number;
}) {
  const id = data.id || crypto.randomUUID();
  const [paper] = await db
    .insert(curriculumPapers)
    .values({
      id,
      subjectId: data.subjectId,
      userId: null,
      title: data.title,
      paperCode: data.paperCode || '',
      displayOrder: data.displayOrder ?? 0,
    })
    .onConflictDoUpdate({
      target: curriculumPapers.id,
      set: {
        subjectId: data.subjectId,
        title: data.title,
        ...(data.paperCode !== undefined ? { paperCode: data.paperCode } : {}),
        ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {}),
      },
    })
    .returning();
  return paper;
}

export async function deleteAdminCurriculumPaper(id: string) {
  const [deleted] = await db
    .delete(curriculumPapers)
    .where(and(eq(curriculumPapers.id, id), isNull(curriculumPapers.userId)))
    .returning();
  return deleted || null;
}

export async function getAllGlobalCurriculumTopics() {
  return await db
    .select()
    .from(curriculumTopics)
    .where(isNull(curriculumTopics.userId))
    .orderBy(asc(curriculumTopics.displayOrder));
}

export async function saveAdminCurriculumTopic(data: {
  id?: string;
  paperId: string;
  subjectId: string;
  title: string;
  chapterNumber?: number | null;
  displayOrder?: number;
}) {
  const id = data.id || crypto.randomUUID();
  const [topic] = await db
    .insert(curriculumTopics)
    .values({
      id,
      paperId: data.paperId,
      subjectId: data.subjectId,
      userId: null,
      title: data.title,
      chapterNumber: data.chapterNumber ?? null,
      displayOrder: data.displayOrder ?? 0,
    })
    .onConflictDoUpdate({
      target: curriculumTopics.id,
      set: {
        paperId: data.paperId,
        subjectId: data.subjectId,
        title: data.title,
        ...(data.chapterNumber !== undefined ? { chapterNumber: data.chapterNumber } : {}),
        ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {}),
      },
    })
    .returning();
  return topic;
}

export async function deleteAdminCurriculumTopic(id: string) {
  const [deleted] = await db
    .delete(curriculumTopics)
    .where(and(eq(curriculumTopics.id, id), isNull(curriculumTopics.userId)))
    .returning();
  return deleted || null;
}

// 7. Achievements Catalog (Admin)
export async function getAllAchievementsCatalog() {
  await ensureAchievementsCatalog();
  return await db
    .select()
    .from(achievements)
    .orderBy(asc(achievements.category), asc(achievements.title));
}

export async function saveAdminAchievement(data: {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  requirementType: string;
  requirementValue: number;
}) {
  const [badge] = await db
    .insert(achievements)
    .values({
      id: data.id,
      title: data.title,
      description: data.description,
      icon: data.icon,
      category: data.category,
      requirementType: data.requirementType,
      requirementValue: data.requirementValue,
    })
    .onConflictDoUpdate({
      target: achievements.id,
      set: {
        title: data.title,
        description: data.description,
        icon: data.icon,
        category: data.category,
        requirementType: data.requirementType,
        requirementValue: data.requirementValue,
      },
    })
    .returning();

  inMemoryCatalogCache = null;
  return badge;
}

export async function deleteAdminAchievement(id: string) {
  const [deleted] = await db
    .delete(achievements)
    .where(eq(achievements.id, id))
    .returning();

  inMemoryCatalogCache = null;
  return deleted || null;
}

// ==============================================================================
// Admin User Management Operations (R1, R2, R3, R4)
// ==============================================================================

export interface AdminUserListItem {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  isBanned: boolean;
  bannedReason: string | null;
  bannedAt: Date | string | null;
  createdAt: Date | string;
}

export async function getAdminUsersList(): Promise<AdminUserListItem[]> {
  try {
    const rows = await db
      .select({
        id: profiles.id,
        userId: profiles.userId,
        email: profiles.email,
        fullName: profiles.fullName,
        avatarUrl: profiles.avatarUrl,
        isBanned: profiles.isBanned,
        bannedReason: profiles.bannedReason,
        bannedAt: profiles.bannedAt,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .orderBy(desc(profiles.createdAt));

    return rows;
  } catch (error) {
    console.error('Database error in getAdminUsersList:', error);
    throw new Error('Failed to load users list');
  }
}

export interface AdminUserDetailResult {
  profile: typeof profiles.$inferSelect;
  stats: {
    totalSessions: number;
    totalStudyMinutes: number;
    totalSubjects: number;
    totalTasks: number;
  };
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetailResult | null> {
  try {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (!profile) return null;

    const [sessions, userSubjs, userTsks] = await Promise.all([
      db
        .select({ durationSeconds: studySessions.durationSeconds })
        .from(studySessions)
        .where(eq(studySessions.userId, userId)),
      db.select({ id: subjects.id }).from(subjects).where(eq(subjects.userId, userId)),
      db.select({ id: tasks.id }).from(tasks).where(eq(tasks.userId, userId)),
    ]);

    const totalDurationSeconds = sessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);

    return {
      profile,
      stats: {
        totalSessions: sessions.length,
        totalStudyMinutes: Math.round(totalDurationSeconds / 60),
        totalSubjects: userSubjs.length,
        totalTasks: userTsks.length,
      },
    };
  } catch (error) {
    console.error('Database error in getAdminUserDetail:', error);
    throw new Error('Failed to load user details');
  }
}

export async function updateAdminUserDetail(
  userId: string,
  data: {
    fullName?: string;
    email?: string;
    avatarUrl?: string;
    dailyStudyTargetMinutes?: number;
    preferredStudyTime?: string;
    timezone?: string;
    themePreference?: string;
    pomodoroFocusMinutes?: number;
    pomodoroShortBreakMinutes?: number;
    pomodoroLongBreakMinutes?: number;
    pomodoroLongBreakInterval?: number;
    targetExamName?: string;
    targetExamDate?: string;
    gamificationXp?: number;
    onboardingCompleted?: boolean;
    isBanned?: boolean;
    bannedReason?: string;
    targetedAnnouncement?: string;
  }
) {
  try {
    const updated = await db
      .update(profiles)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, userId))
      .returning();

    return updated[0] || null;
  } catch (error) {
    console.error('Database error in updateAdminUserDetail:', error);
    throw new Error('Failed to update user profile');
  }
}

export async function setAdminUserBanStatus(userId: string, isBanned: boolean, reason?: string) {
  try {
    const [updated] = await db
      .update(profiles)
      .set({
        isBanned,
        bannedReason: isBanned ? (reason || 'Account suspended by administrator') : '',
        bannedAt: isBanned ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, userId))
      .returning();

    if (isBanned) {
      await db.delete(activeTimerSessions).where(eq(activeTimerSessions.userId, userId)).catch(() => {});
    }

    return updated || null;
  } catch (error) {
    console.error('Database error in setAdminUserBanStatus:', error);
    throw new Error('Failed to update ban status');
  }
}

export async function setAdminUserTargetedAnnouncement(userId: string, announcement: string) {
  try {
    const cleanAnnouncement = announcement.trim();
    const [updated] = await db
      .update(profiles)
      .set({
        targetedAnnouncement: cleanAnnouncement,
        targetedAnnouncementCreatedAt: cleanAnnouncement ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, userId))
      .returning();

    return updated || null;
  } catch (error) {
    console.error('Database error in setAdminUserTargetedAnnouncement:', error);
    throw new Error('Failed to set targeted announcement');
  }
}



