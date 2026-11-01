'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActiveTimerSession,
  CurriculumPaper,
  CurriculumResourceItem,
  CurriculumSubject,
  CurriculumTopic,
  FlashcardItem,
  GoalItem,
  NavigationTab,
  NotificationPreferences,
  Profile,
  RevisionCategory,
  RevisionRecord,
  RevisionWorkspacePayload,
  ScheduleItem,
  StudySession,
  Subject,
  TaskItem,
  ToastMessage,
  UserCurriculumCustomization,
  WorkspaceData,
} from '../types/index';
import {
  getCurrentUserAction,
  signOutAction,
} from '../actions/auth';
import {
  getWorkspaceDataAction,
  completeOnboardingAction,
  updateProfileAction,
  updateNotificationPreferencesAction,
  restoreBackupAction,
  deleteAccountAction,
} from '../actions/workspace';
import {
  createSubjectAction,
  updateSubjectAction,
  deleteSubjectAction,
} from '../actions/subjects';
import {
  createStudySessionAction,
  updateStudySessionAction,
  deleteStudySessionAction,
} from '../actions/sessions';
import {
  getActiveTimerAction,
  syncActiveTimerAction,
  deleteActiveTimerAction,
} from '../actions/timer';
import {
  createTaskAction,
  updateTaskAction,
  deleteTaskAction,
} from '../actions/tasks';
import {
  createScheduleAction,
  updateScheduleAction,
  deleteScheduleAction,
} from '../actions/schedules';
import {
  createGoalAction,
  updateGoalAction,
  deleteGoalAction,
} from '../actions/goals';
import {
  getRevisionWorkspaceAction,
  toggleRevisionAction,
  saveDetailedRevisionRecordAction,
  deleteRevisionRecordAction,
  addCustomCurriculumTopicAction,
  addCustomCurriculumSubjectAction,
  updateCurriculumCustomizationAction,
  createCurriculumResourceAction,
  deleteCurriculumResourceAction,
} from '../actions/revision';
import {
  createFlashcardAction,
  updateFlashcardAction,
  deleteFlashcardAction,
  reviewFlashcardAction,
} from '../actions/flashcards';
import { playTimerChime, sendBrowserNotification } from '../lib/audio';
import { useTheme } from 'next-themes';

export interface AuthUser {
  uid: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface WorkspaceContextValue {
  user: AuthUser | null;
  authLoading: boolean;
  workspaceLoading: boolean;
  workspaceError: string | null;
  data: WorkspaceData | null;
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  selectedSubjectId: string | null;
  setSelectedSubjectId: (id: string | null) => void;
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;

  // Timer state
  activeTimer: ActiveTimerSession | null;
  recoveredSessionNotice: boolean;
  dismissRecoveredNotice: () => void;
  persistActiveTimer: (nextTimer: ActiveTimerSession | null) => Promise<void>;

  // CRUD actions (All routed via Server Actions)
  refreshWorkspace: () => Promise<void>;
  completeOnboarding: (payload: any) => Promise<void>;
  updateProfile: (payload: Partial<Profile>) => Promise<void>;
  updateNotificationPrefs: (payload: Partial<NotificationPreferences>) => Promise<void>;
  createSubject: (payload: Partial<Subject>) => Promise<Subject>;
  updateSubject: (id: string, payload: Partial<Subject>) => Promise<Subject>;
  deleteSubject: (id: string) => Promise<void>;
  createSession: (payload: any) => Promise<StudySession>;
  updateSession: (id: string, payload: any) => Promise<StudySession>;
  deleteSession: (id: string) => Promise<void>;
  createTask: (payload: any) => Promise<TaskItem>;
  updateTask: (id: string, payload: any) => Promise<TaskItem>;
  deleteTask: (id: string) => Promise<void>;
  createSchedule: (payload: any) => Promise<ScheduleItem>;
  updateSchedule: (id: string, payload: any) => Promise<ScheduleItem>;
  deleteSchedule: (id: string) => Promise<void>;
  createGoal: (payload: any) => Promise<GoalItem>;
  updateGoal: (id: string, payload: any) => Promise<GoalItem>;
  deleteGoal: (id: string) => Promise<void>;
  restoreBackup: (mode: 'merge' | 'replace', backupData: any) => Promise<void>;
  deleteAccount: () => Promise<void>;
  signOut: () => Promise<void>;

  // Revision Tracker & Curriculum
  revisionData: RevisionWorkspacePayload | null;
  fetchRevisionWorkspace: (forceRefresh?: boolean) => Promise<RevisionWorkspacePayload>;
  toggleRevisionActivity: (opts: {
    subjectId: string;
    topicId: string;
    category: RevisionCategory;
    isCompleted: boolean;
    activityDate?: string;
    notes?: string;
  }) => Promise<RevisionRecord>;
  saveDetailedRevision: (opts: {
    id?: string;
    subjectId: string;
    topicId: string;
    category: RevisionCategory;
    isCompleted?: boolean;
    activityDate?: string;
    bookName?: string;
    pagesRead?: number;
    questionsSolved?: number;
    correctCount?: number;
    notes?: string;
  }) => Promise<RevisionRecord>;
  deleteRevisionRecordItem: (recordId: string) => Promise<void>;
  addCustomCurriculumTopicItem: (opts: {
    paperId: string;
    subjectId: string;
    title: string;
    chapterNumber?: number;
  }) => Promise<CurriculumTopic>;
  addCustomCurriculumSubjectItem: (opts: {
    name: string;
    code?: string;
    color?: string;
    icon?: string;
    paperTitles?: string[];
    defaultPaperTitle?: string;
  }) => Promise<{ subject: CurriculumSubject; paper: CurriculumPaper }>;
  updateCurriculumCustomizationItem: (opts: {
    targetType: 'subject' | 'paper' | 'topic';
    targetId: string;
    isHidden?: boolean;
    customTitle?: string;
    customOrder?: number;
  }) => Promise<UserCurriculumCustomization>;

  // Spaced Repetition Flashcards
  createFlashcard: (payload: any) => Promise<FlashcardItem>;
  updateFlashcard: (id: string, payload: any) => Promise<FlashcardItem>;
  deleteFlashcard: (id: string) => Promise<void>;
  reviewFlashcard: (id: string, grade: 1 | 2 | 3 | 4) => Promise<FlashcardItem>;

  // Chapter Resources
  createResource: (payload: any) => Promise<CurriculumResourceItem>;
  deleteResource: (id: string) => Promise<void>;

  // Target Exam Setting
  updateExamTarget: (examName: string, examDate: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

function getClientDeviceId(): string {
  if (typeof window === 'undefined') return 'server_device';
  const key = 'scholarpulse_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [activeTimer, setActiveTimer] = useState<ActiveTimerSession | null>(null);
  const [recoveredSessionNotice, setRecoveredSessionNotice] = useState<boolean>(false);

  const [revisionData, setRevisionData] = useState<RevisionWorkspacePayload | null>(null);
  const revisionCacheRef = useRef<RevisionWorkspacePayload | null>(null);
  const revisionFetchPromiseRef = useRef<Promise<RevisionWorkspacePayload> | null>(null);

  const initialTimerRecoveryChecked = useRef(false);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const { setTheme } = useTheme();

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-4), { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissRecoveredNotice = useCallback(() => {
    setRecoveredSessionNotice(false);
  }, []);

  // Fetch full workspace state via Server Action
  const refreshWorkspace = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const promise = (async () => {
      try {
        setWorkspaceLoading(true);
        setWorkspaceError(null);

        const res = await getWorkspaceDataAction();
        if (!res.success || !res.data) {
          throw new Error('Failed to load workspace data');
        }

        const workspace = res.data;
        setData(workspace as unknown as WorkspaceData);

        // Sync theme with next-themes if specified in profile
        if (workspace.profile?.themePreference) {
          setTheme(workspace.profile.themePreference);
        }

        // Active timer sync
        const uid = workspace.profile?.userId;
        if (uid && typeof window !== 'undefined') {
          const localKey = `scholarpulse_timer_${uid}`;
          const localRaw = localStorage.getItem(localKey);
          let resolvedTimer: ActiveTimerSession | null = workspace.activeTimer;

          if (localRaw) {
            try {
              const parsedLocal: ActiveTimerSession = JSON.parse(localRaw);
              if (!workspace.activeTimer) {
                if (parsedLocal.id) {
                  resolvedTimer = null;
                  localStorage.removeItem(localKey);
                } else {
                  resolvedTimer = parsedLocal;
                  syncActiveTimerAction(parsedLocal).then((res) => {
                    if (res?.success && res.timer) {
                      localStorage.setItem(localKey, JSON.stringify(res.timer));
                      setActiveTimer(res.timer);
                    }
                  }).catch(() => {});
                }
              } else {
                resolvedTimer = workspace.activeTimer;
              }
            } catch {
              localStorage.removeItem(localKey);
            }
          }

          if (resolvedTimer) {
            localStorage.setItem(localKey, JSON.stringify(resolvedTimer));
            setActiveTimer(resolvedTimer);
            if (!initialTimerRecoveryChecked.current) {
              initialTimerRecoveryChecked.current = true;
              setRecoveredSessionNotice(true);
            }
          } else {
            localStorage.removeItem(localKey);
            setActiveTimer(null);
            initialTimerRecoveryChecked.current = true;
          }
        }
      } catch (err: any) {
        console.error('refreshWorkspace error:', err);
        setWorkspaceError(err?.message || 'Failed to load workspace.');
      } finally {
        setWorkspaceLoading(false);
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = promise;
    return promise;
  }, [setTheme]);

  // Initial Auth verification
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setAuthLoading(true);
        const currentUser = await getCurrentUserAction();
        if (!isMounted) return;
        setUser(currentUser);
        if (currentUser) {
          await refreshWorkspace();
        } else {
          setData(null);
          setActiveTimer(null);
          setRevisionData(null);
        }
      } catch (err) {
        console.error('Auth verification error:', err);
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [refreshWorkspace]);

  // Persist Active Timer via Server Action
  const persistActiveTimer = useCallback(async (nextTimer: ActiveTimerSession | null) => {
    setActiveTimer(nextTimer);
    if (!user) return;
    const localKey = `scholarpulse_timer_${user.uid}`;

    if (!nextTimer) {
      if (typeof window !== 'undefined') localStorage.removeItem(localKey);
      await deleteActiveTimerAction().catch(() => {});
    } else {
      if (typeof window !== 'undefined') {
        localStorage.setItem(localKey, JSON.stringify(nextTimer));
      }
      await syncActiveTimerAction(nextTimer).catch(() => {});
    }
  }, [user]);

  // Complete onboarding
  const completeOnboarding = useCallback(async (payload: any) => {
    const res = await completeOnboardingAction(payload);
    if (res.success && res.data) {
      setData(res.data as unknown as WorkspaceData);
      addToast({
        title: 'Welcome to ScholarPulse!',
        description: 'Your academic workspace is set up.',
        variant: 'success',
      });
    }
  }, [addToast]);

  // Update profile
  const updateProfile = useCallback(async (payload: Partial<Profile>) => {
    const res = await updateProfileAction(payload);
    if (res.success && res.profile) {
      setData((prev) => prev ? { ...prev, profile: res.profile as Profile } : null);
      if (payload.themePreference) {
        setTheme(payload.themePreference);
      }
      addToast({
        title: 'Profile Updated',
        description: 'Your study preferences were saved.',
        variant: 'success',
      });
    }
  }, [addToast, setTheme]);

  // Update notification prefs
  const updateNotificationPrefs = useCallback(async (payload: Partial<NotificationPreferences>) => {
    const res = await updateNotificationPreferencesAction(payload);
    if (res.success && res.preferences) {
      setData((prev) => prev ? { ...prev, notificationPreferences: res.preferences as NotificationPreferences } : null);
      addToast({
        title: 'Preferences Saved',
        description: 'Notification settings have been updated.',
        variant: 'success',
      });
    }
  }, [addToast]);

  // Subjects CRUD
  const createSubject = useCallback(async (payload: Partial<Subject>) => {
    const res = await createSubjectAction(payload);
    if (!res.success || !res.subject) throw new Error('Failed to create subject');
    const created = res.subject as Subject;
    setData((prev) => prev ? { ...prev, subjects: [...prev.subjects, created] } : null);
    addToast({ title: 'Subject Created', description: `Added ${created.name}`, variant: 'success' });
    return created;
  }, [addToast]);

  const updateSubject = useCallback(async (id: string, payload: Partial<Subject>) => {
    const res = await updateSubjectAction(id, payload);
    if (!res.success || !res.subject) throw new Error('Failed to update subject');
    const updated = res.subject as Subject;
    setData((prev) => prev ? {
      ...prev,
      subjects: prev.subjects.map((s) => s.id === id ? updated : s),
    } : null);
    addToast({ title: 'Subject Updated', description: `Saved changes to ${updated.name}`, variant: 'success' });
    return updated;
  }, [addToast]);

  const deleteSubject = useCallback(async (id: string) => {
    await deleteSubjectAction(id);
    setData((prev) => prev ? {
      ...prev,
      subjects: prev.subjects.filter((s) => s.id !== id),
    } : null);
    addToast({ title: 'Subject Deleted', description: 'Subject and its records removed.', variant: 'default' });
  }, [addToast]);

  // Study Sessions CRUD
  const createSession = useCallback(async (payload: any) => {
    const res = await createStudySessionAction(payload);
    if (!res.success || !res.session) throw new Error('Failed to save study session');
    const session = res.session as StudySession;
    await refreshWorkspace();
    addToast({ title: 'Session Saved', description: 'Study activity logged successfully.', variant: 'success' });
    return session;
  }, [addToast, refreshWorkspace]);

  const updateSession = useCallback(async (id: string, payload: any) => {
    const res = await updateStudySessionAction(id, payload);
    if (!res.success || !res.session) throw new Error('Failed to update session');
    const session = res.session as StudySession;
    await refreshWorkspace();
    addToast({ title: 'Session Updated', description: 'Session details modified.', variant: 'success' });
    return session;
  }, [addToast, refreshWorkspace]);

  const deleteSession = useCallback(async (id: string) => {
    await deleteStudySessionAction(id);
    await refreshWorkspace();
    addToast({ title: 'Session Deleted', description: 'Session was removed from log.', variant: 'default' });
  }, [addToast, refreshWorkspace]);

  // Tasks CRUD
  const createTask = useCallback(async (payload: any) => {
    const res = await createTaskAction(payload);
    if (!res.success || !res.task) throw new Error('Failed to create task');
    const task = res.task as unknown as TaskItem;
    setData((prev) => prev ? { ...prev, tasks: [...prev.tasks, task] } : null);
    addToast({ title: 'Task Created', description: `Added "${task.title}"`, variant: 'success' });
    return task;
  }, [addToast]);

  const updateTask = useCallback(async (id: string, payload: any) => {
    const res = await updateTaskAction(id, payload);
    if (!res.success || !res.task) throw new Error('Failed to update task');
    const task = res.task as unknown as TaskItem;
    setData((prev) => prev ? {
      ...prev,
      tasks: prev.tasks.map((t) => t.id === id ? task : t),
    } : null);
    return task;
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    await deleteTaskAction(id);
    setData((prev) => prev ? {
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== id),
    } : null);
    addToast({ title: 'Task Deleted', description: 'Task removed.', variant: 'default' });
  }, [addToast]);

  // Schedules CRUD
  const createSchedule = useCallback(async (payload: any) => {
    const res = await createScheduleAction(payload);
    if (!res.success || !res.schedule) throw new Error('Failed to create schedule');
    const schedule = res.schedule as unknown as ScheduleItem;
    setData((prev) => prev ? { ...prev, schedules: [...prev.schedules, schedule] } : null);
    addToast({ title: 'Timetable Updated', description: 'Class schedule added.', variant: 'success' });
    return schedule;
  }, [addToast]);

  const updateSchedule = useCallback(async (id: string, payload: any) => {
    const res = await updateScheduleAction(id, payload);
    if (!res.success || !res.schedule) throw new Error('Failed to update schedule');
    const schedule = res.schedule as unknown as ScheduleItem;
    setData((prev) => prev ? {
      ...prev,
      schedules: prev.schedules.map((s) => s.id === id ? schedule : s),
    } : null);
    return schedule;
  }, []);

  const deleteSchedule = useCallback(async (id: string) => {
    await deleteScheduleAction(id);
    setData((prev) => prev ? {
      ...prev,
      schedules: prev.schedules.filter((s) => s.id !== id),
    } : null);
    addToast({ title: 'Schedule Removed', description: 'Time slot deleted.', variant: 'default' });
  }, [addToast]);

  // Goals CRUD
  const createGoal = useCallback(async (payload: any) => {
    const res = await createGoalAction(payload);
    if (!res.success || !res.goal) throw new Error('Failed to create goal');
    const goal = res.goal as unknown as GoalItem;
    setData((prev) => prev ? { ...prev, goals: [...prev.goals, goal] } : null);
    addToast({ title: 'Goal Created', description: `Target: ${goal.title}`, variant: 'success' });
    return goal;
  }, [addToast]);

  const updateGoal = useCallback(async (id: string, payload: any) => {
    const res = await updateGoalAction(id, payload);
    if (!res.success || !res.goal) throw new Error('Failed to update goal');
    const goal = res.goal as unknown as GoalItem;
    setData((prev) => prev ? {
      ...prev,
      goals: prev.goals.map((g) => g.id === id ? goal : g),
    } : null);
    return goal;
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    await deleteGoalAction(id);
    setData((prev) => prev ? {
      ...prev,
      goals: prev.goals.filter((g) => g.id !== id),
    } : null);
    addToast({ title: 'Goal Removed', description: 'Goal deleted.', variant: 'default' });
  }, [addToast]);

  // Backup & Account
  const restoreBackup = useCallback(async (mode: 'merge' | 'replace', backupData: any) => {
    const res = await restoreBackupAction(backupData);
    if (res.success && res.data) {
      setData(res.data as unknown as WorkspaceData);
      addToast({ title: 'Backup Restored', description: 'Your study data was recovered.', variant: 'success' });
    }
  }, [addToast]);

  const deleteAccount = useCallback(async () => {
    await deleteAccountAction();
    await signOutAction();
  }, []);

  const signOut = useCallback(async () => {
    await signOutAction();
  }, []);

  // Revision Tracker
  const fetchRevisionWorkspace = useCallback(async (forceRefresh = false): Promise<RevisionWorkspacePayload> => {
    if (!forceRefresh && revisionCacheRef.current) {
      return revisionCacheRef.current;
    }
    if (revisionFetchPromiseRef.current) {
      return revisionFetchPromiseRef.current;
    }

    const promise = (async () => {
      try {
        const res = await getRevisionWorkspaceAction();
        if (!res.success || !res.data) throw new Error('Failed to load revision workspace');
        const payload = res.data as RevisionWorkspacePayload;
        revisionCacheRef.current = payload;
        setRevisionData(payload);
        return payload;
      } finally {
        revisionFetchPromiseRef.current = null;
      }
    })();

    revisionFetchPromiseRef.current = promise;
    return promise;
  }, []);

  const toggleRevisionActivity = useCallback(async (opts: {
    subjectId: string;
    topicId: string;
    category: RevisionCategory;
    isCompleted: boolean;
    activityDate?: string;
    notes?: string;
  }) => {
    const res = await toggleRevisionAction(opts);
    if (!res.success || !res.record) throw new Error('Failed to toggle revision');
    const rec = res.record as unknown as RevisionRecord;
    setRevisionData((prev) => {
      if (!prev) return null;
      const filtered = prev.records.filter(
        (r) => !(r.topicId === opts.topicId && r.category === opts.category)
      );
      const nextRecords = opts.isCompleted ? [...filtered, rec] : filtered;
      const updated = { ...prev, records: nextRecords };
      revisionCacheRef.current = updated;
      return updated;
    });
    return rec;
  }, []);

  const saveDetailedRevision = useCallback(async (opts: any) => {
    const res = await saveDetailedRevisionRecordAction(opts);
    if (!res.success || !res.record) throw new Error('Failed to save detailed record');
    const rec = res.record as unknown as RevisionRecord;
    setRevisionData((prev) => {
      if (!prev) return null;
      const filtered = prev.records.filter((r) => r.id !== rec.id);
      const nextRecords = [...filtered, rec];
      const updated = { ...prev, records: nextRecords };
      revisionCacheRef.current = updated;
      return updated;
    });
    return rec;
  }, []);

  const deleteRevisionRecordItem = useCallback(async (recordId: string) => {
    await deleteRevisionRecordAction(recordId);
    setRevisionData((prev) => {
      if (!prev) return null;
      const nextRecords = prev.records.filter((r) => r.id !== recordId);
      const updated = { ...prev, records: nextRecords };
      revisionCacheRef.current = updated;
      return updated;
    });
  }, []);

  const addCustomCurriculumTopicItem = useCallback(async (opts: any) => {
    const res = await addCustomCurriculumTopicAction(opts);
    if (!res.success || !res.topic) throw new Error('Failed to add custom topic');
    const topic = res.topic as CurriculumTopic;
    setRevisionData((prev) => {
      if (!prev) return null;
      const updated = { ...prev, topics: [...prev.topics, topic] };
      revisionCacheRef.current = updated;
      return updated;
    });
    return topic;
  }, []);

  const addCustomCurriculumSubjectItem = useCallback(async (opts: any) => {
    const res = await addCustomCurriculumSubjectAction(opts);
    if (!res.success || !res.subject) throw new Error('Failed to add custom subject');
    const subject = res.subject as { subject: CurriculumSubject; paper: CurriculumPaper };
    await fetchRevisionWorkspace(true);
    return subject;
  }, [fetchRevisionWorkspace]);

  const updateCurriculumCustomizationItem = useCallback(async (opts: any) => {
    const res = await updateCurriculumCustomizationAction(opts);
    if (!res.success || !res.customization) throw new Error('Failed to customize');
    const cust = res.customization as UserCurriculumCustomization;
    setRevisionData((prev) => {
      if (!prev) return null;
      const filtered = prev.customizations.filter(
        (c) => !(c.targetType === opts.targetType && c.targetId === opts.targetId)
      );
      const updated = { ...prev, customizations: [...filtered, cust] };
      revisionCacheRef.current = updated;
      return updated;
    });
    return cust;
  }, []);

  // Spaced Repetition Flashcards
  const createFlashcard = useCallback(async (payload: any) => {
    const res = await createFlashcardAction(payload);
    if (!res.success || !res.flashcard) throw new Error('Failed to create flashcard');
    const card = res.flashcard as unknown as FlashcardItem;
    setData((prev) => prev ? { ...prev, flashcards: [...(prev.flashcards || []), card] } : null);
    addToast({ title: 'Flashcard Created', description: 'Added to your spaced repetition deck.', variant: 'success' });
    return card;
  }, [addToast]);

  const updateFlashcard = useCallback(async (id: string, payload: any) => {
    const res = await updateFlashcardAction(id, payload);
    if (!res.success || !res.flashcard) throw new Error('Failed to update flashcard');
    const card = res.flashcard as unknown as FlashcardItem;
    setData((prev) => prev ? {
      ...prev,
      flashcards: (prev.flashcards || []).map((f) => f.id === id ? card : f),
    } : null);
    return card;
  }, []);

  const deleteFlashcard = useCallback(async (id: string) => {
    await deleteFlashcardAction(id);
    setData((prev) => prev ? {
      ...prev,
      flashcards: (prev.flashcards || []).filter((f) => f.id !== id),
    } : null);
    addToast({ title: 'Flashcard Removed', description: 'Deleted from your deck.', variant: 'default' });
  }, [addToast]);

  const reviewFlashcard = useCallback(async (id: string, grade: 1 | 2 | 3 | 4) => {
    const res = await reviewFlashcardAction({ id, grade });
    if (!res.success || !res.flashcard) throw new Error('Failed to review flashcard');
    const card = res.flashcard as unknown as FlashcardItem;
    setData((prev) => {
      if (!prev) return null;
      const updatedProfile = {
        ...prev.profile,
        gamificationXp: (prev.profile.gamificationXp || 0) + 5,
      };
      return {
        ...prev,
        profile: updatedProfile,
        flashcards: (prev.flashcards || []).map((f) => f.id === id ? card : f),
      };
    });
    return card;
  }, []);

  // Chapter Resources
  const createResource = useCallback(async (payload: any) => {
    const res = await createCurriculumResourceAction(payload);
    if (!res.success || !res.resource) throw new Error('Failed to save resource');
    const resource = res.resource as unknown as CurriculumResourceItem;
    setRevisionData((prev) => {
      if (!prev) return null;
      const updated = { ...prev, resources: [resource, ...(prev.resources || [])] };
      revisionCacheRef.current = updated;
      return updated;
    });
    addToast({ title: 'Resource Saved', description: `Saved: ${resource.title}`, variant: 'success' });
    return resource;
  }, [addToast]);

  const deleteResource = useCallback(async (id: string) => {
    await deleteCurriculumResourceAction(id);
    setRevisionData((prev) => {
      if (!prev) return null;
      const updated = {
        ...prev,
        resources: (prev.resources || []).filter((r) => r.id !== id),
      };
      revisionCacheRef.current = updated;
      return updated;
    });
    addToast({ title: 'Resource Removed', description: 'Link deleted.', variant: 'default' });
  }, [addToast]);

  // Target Exam & Burndown settings
  const updateExamTarget = useCallback(async (targetExamName: string, targetExamDate: string) => {
    await updateProfileAction({ targetExamName, targetExamDate });
    setData((prev) => prev ? {
      ...prev,
      profile: {
        ...prev.profile,
        targetExamName,
        targetExamDate,
      },
    } : null);
    addToast({ title: 'Exam Target Updated', description: `${targetExamName} set to ${targetExamDate}`, variant: 'success' });
  }, [addToast, updateProfileAction]);

  const value = useMemo<WorkspaceContextValue>(() => ({
    user,
    authLoading,
    workspaceLoading,
    workspaceError,
    data,
    activeTab,
    setActiveTab,
    selectedSubjectId,
    setSelectedSubjectId,
    toasts,
    addToast,
    dismissToast,
    activeTimer,
    recoveredSessionNotice,
    dismissRecoveredNotice,
    persistActiveTimer,
    refreshWorkspace,
    completeOnboarding,
    updateProfile,
    updateNotificationPrefs,
    createSubject,
    updateSubject,
    deleteSubject,
    createSession,
    updateSession,
    deleteSession,
    createTask,
    updateTask,
    deleteTask,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    createGoal,
    updateGoal,
    deleteGoal,
    restoreBackup,
    deleteAccount,
    signOut,
    revisionData,
    fetchRevisionWorkspace,
    toggleRevisionActivity,
    saveDetailedRevision,
    deleteRevisionRecordItem,
    addCustomCurriculumTopicItem,
    addCustomCurriculumSubjectItem,
    updateCurriculumCustomizationItem,
    createFlashcard,
    updateFlashcard,
    deleteFlashcard,
    reviewFlashcard,
    createResource,
    deleteResource,
    updateExamTarget,
  }), [
    user,
    authLoading,
    workspaceLoading,
    workspaceError,
    data,
    activeTab,
    selectedSubjectId,
    toasts,
    addToast,
    dismissToast,
    activeTimer,
    recoveredSessionNotice,
    dismissRecoveredNotice,
    persistActiveTimer,
    refreshWorkspace,
    completeOnboarding,
    updateProfile,
    updateNotificationPrefs,
    createSubject,
    updateSubject,
    deleteSubject,
    createSession,
    updateSession,
    deleteSession,
    createTask,
    updateTask,
    deleteTask,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    createGoal,
    updateGoal,
    deleteGoal,
    restoreBackup,
    deleteAccount,
    signOut,
    revisionData,
    fetchRevisionWorkspace,
    toggleRevisionActivity,
    saveDetailedRevision,
    deleteRevisionRecordItem,
    addCustomCurriculumTopicItem,
    addCustomCurriculumSubjectItem,
    updateCurriculumCustomizationItem,
    createFlashcard,
    updateFlashcard,
    deleteFlashcard,
    reviewFlashcard,
    createResource,
    deleteResource,
    updateExamTarget,
  ]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

export { useTimer, TimerProvider } from './TimerContext';
