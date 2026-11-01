export interface Profile {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  dailyStudyTargetMinutes: number;
  preferredStudyTime: 'morning' | 'afternoon' | 'evening' | 'night' | string;
  timezone: string;
  themePreference: 'light' | 'dark' | 'system' | string;
  pomodoroFocusMinutes: number;
  pomodoroShortBreakMinutes: number;
  pomodoroLongBreakMinutes: number;
  pomodoroLongBreakInterval: number;
  onboardingCompleted: boolean;
  targetExamName?: string;
  targetExamDate?: string;
  gamificationXp?: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Subject {
  id: string;
  userId: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  dailyTargetMinutes: number;
  weeklyTargetMinutes: number;
  isArchived: boolean;
  notes: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface StudySession {
  id: string;
  userId: string;
  subjectId: string;
  idempotencyKey?: string | null;
  startTime: string | Date;
  endTime: string | Date;
  durationSeconds: number;
  topic: string;
  notes?: string | null;
  productivityRating: number;
  sessionType: 'manual' | 'timer' | string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ActiveTimerSession {
  id?: string;
  userId: string;
  subjectId: string;
  topic: string;
  notes?: string | null;
  mode: 'stopwatch' | 'pomodoro' | string;
  phase: 'focus' | 'short_break' | 'long_break' | string;
  status: 'running' | 'paused' | string;
  startedAt: string | Date;
  lastResumedAt: string | Date;
  accumulatedSeconds: number;
  targetDurationSeconds: number;
  completedPomodoros: number;
  stateVersion: number;
  clientDeviceId?: string | null;
  idempotencyKey: string;
  updatedAt?: string | Date;
}

export interface TaskItem {
  id: string;
  userId: string;
  subjectId: string;
  title: string;
  description?: string | null;
  dueDate: string | Date;
  priority: 'low' | 'medium' | 'high' | string;
  status: 'pending' | 'in_progress' | 'completed' | string;
  completedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ScheduleItem {
  id: string;
  userId: string;
  subjectId: string;
  dayOfWeek: number; // 0 = Sunday ... 6 = Saturday
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  description?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface GoalItem {
  id: string;
  userId: string;
  subjectId?: string | null;
  title: string;
  goalType: 'daily' | 'weekly' | 'monthly' | 'subject' | 'streak' | 'sessions' | string;
  targetValue: number;
  currentValue: number;
  unit: 'minutes' | 'sessions' | 'days' | string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: 'active' | 'completed' | 'expired' | string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface AchievementCatalogItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  requirementType: string;
  requirementValue: number;
}

export interface UserAchievementItem {
  id: string;
  userId: string;
  achievementId: string;
  unlockedAt: string | Date;
}

export interface NotificationPreferences {
  userId: string;
  browserNotificationsEnabled: boolean;
  soundChimesEnabled: boolean;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  scheduleReminderEnabled: boolean;
  taskDeadlineReminderEnabled: boolean;
  goalCompletionAlert: boolean;
  streakMilestoneAlert: boolean;
  updatedAt: string | Date;
}

export interface CurriculumResourceItem {
  id: string;
  userId: string;
  subjectId: string;
  topicId: string;
  title: string;
  url: string;
  resourceType: 'youtube' | 'drive' | 'pdf' | 'book_ref' | 'link' | string;
  pageReference?: string | null;
  notes?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface WorkspaceData {
  profile: Profile;
  notificationPreferences: NotificationPreferences;
  subjects: Subject[];
  studySessions: StudySession[];
  activeTimer: ActiveTimerSession | null;
  tasks: TaskItem[];
  schedules: ScheduleItem[];
  goals: GoalItem[];
  achievementsCatalog: AchievementCatalogItem[];
  userAchievements: UserAchievementItem[];
}

export type NavigationTab =
  | 'dashboard'
  | 'tracker'
  | 'timer'
  | 'revision'
  | 'subjects'
  | 'schedule'
  | 'goals'
  | 'analytics'
  | 'history'
  | 'achievements'
  | 'settings';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

// ==============================================================================
// REVISION TRACKER & CURRICULUM TYPES
// ==============================================================================

export type RevisionCategory =
  | 'class'
  | 'revision_note'
  | 'book_reading'
  | 'mcq_exam'
  | 'cq_solve'
  | 'test_paper_solving';

export interface RevisionCategoryMeta {
  id: RevisionCategory;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
}

export const REVISION_CATEGORIES: RevisionCategoryMeta[] = [
  {
    id: 'class',
    label: 'Class',
    shortLabel: 'Class',
    description: 'Completed or attended classes',
    color: '#3B82F6', // Indigo
  },
  {
    id: 'revision_note',
    label: 'Revision Note',
    shortLabel: 'Rev Note',
    description: 'Creation & review of revision notes',
    color: '#8B5CF6', // Purple
  },
  {
    id: 'book_reading',
    label: 'Book Reading',
    shortLabel: 'Reading',
    description: 'Textbook & reference-book reading',
    color: '#0EA5E9', // Sky
  },
  {
    id: 'mcq_exam',
    label: 'MCQ Exam',
    shortLabel: 'MCQ',
    description: 'MCQ exam attempts & practice',
    color: '#10B981', // Emerald
  },
  {
    id: 'cq_solve',
    label: 'CQ Solve',
    shortLabel: 'CQ',
    description: 'Creative Question solving activities',
    color: '#F59E0B', // Amber
  },
  {
    id: 'test_paper_solving',
    label: 'Test Paper Solving (On your own)',
    shortLabel: 'Test Paper',
    description: 'Self-paced test paper practice',
    color: '#EC4899', // Pink
  },
];

export interface CurriculumSubject {
  id: string;
  userId?: string | null;
  name: string;
  code: string;
  color: string;
  icon: string;
  displayOrder: number;
  isHidden?: boolean;
  papers?: CurriculumPaper[];
}

export interface CurriculumPaper {
  id: string;
  subjectId: string;
  userId?: string | null;
  title: string;
  paperCode?: string | null;
  displayOrder: number;
  isHidden?: boolean;
  topics?: CurriculumTopic[];
}

export interface CurriculumTopic {
  id: string;
  paperId: string;
  subjectId: string;
  userId?: string | null;
  title: string;
  chapterNumber?: number | null;
  displayOrder: number;
  isHidden?: boolean;
}

export interface UserCurriculumCustomization {
  id: string;
  userId: string;
  targetType: 'subject' | 'paper' | 'topic';
  targetId: string;
  isHidden: boolean;
  customTitle?: string | null;
  customOrder?: number | null;
}

export interface RevisionRecord {
  id: string;
  userId: string;
  subjectId: string;
  topicId: string;
  category: RevisionCategory;
  activityDate?: string | null;
  isCompleted: boolean;
  bookName?: string | null;
  pagesRead?: number | null;
  questionsSolved?: number | null;
  correctCount?: number | null;
  notes?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface RevisionWorkspacePayload {
  subjects: CurriculumSubject[];
  papers: CurriculumPaper[];
  topics: CurriculumTopic[];
  customizations: UserCurriculumCustomization[];
  records: RevisionRecord[];
  resources: CurriculumResourceItem[];
}
