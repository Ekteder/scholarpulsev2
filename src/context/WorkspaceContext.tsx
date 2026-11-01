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
import { playTimerChime, sendBrowserNotification } from '../lib/audio';
import { useTheme } from 'next-themes';
import { useRealtimeSync, SyncStatus, getClientDeviceId } from '../hooks/useRealtimeSync';

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

  // Real-time synchronization state
  syncStatus: SyncStatus;
  lastSyncTime: Date | null;

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

  // Chapter Resources
  createResource: (payload: any) => Promise<CurriculumResourceItem>;
  deleteResource: (id: string) => Promise<void>;

  // Target Exam Setting
  updateExamTarget: (examName: string, examDate: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

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
              if (!workspace.activeTimer) {
                // Cloud confirms no active timer: remove stale local cache, do not resurrect!
                resolvedTimer = null;
                localStorage.removeItem(localKey);
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

  // Central Real-time Sync Event Handler (SSE + BroadcastChannel)
  const handleIncomingSyncEvent = useCallback(
    (eventType: string, payload: any, originDeviceId?: string) => {
      const isFromSelf = Boolean(originDeviceId && originDeviceId === getClientDeviceId());

      switch (eventType) {
        case 'connected': {
          const initialTimer = payload?.activeTimer as ActiveTimerSession | null | undefined;
          if (initialTimer) {
            setActiveTimer((current) => {
              if (
                !current ||
                (initialTimer.stateVersion || 0) >= (current.stateVersion || 0) ||
                initialTimer.idempotencyKey !== current.idempotencyKey
              ) {
                if (user && typeof window !== 'undefined') {
                  localStorage.setItem(
                    `scholarpulse_timer_${user.uid}`,
                    JSON.stringify(initialTimer)
                  );
                }
                return initialTimer;
              }
              return current;
            });
          } else if (initialTimer === null) {
            setActiveTimer(null);
            if (user && typeof window !== 'undefined') {
              localStorage.removeItem(`scholarpulse_timer_${user.uid}`);
            }
          }
          break;
        }

        case 'timer:update': {
          const incomingTimer = payload?.timer as ActiveTimerSession | undefined;
          if (!incomingTimer) return;

          setActiveTimer((current) => {
            if (
              !current ||
              (incomingTimer.stateVersion || 0) >= (current.stateVersion || 0) ||
              incomingTimer.idempotencyKey !== current.idempotencyKey
            ) {
              if (user && typeof window !== 'undefined') {
                localStorage.setItem(
                  `scholarpulse_timer_${user.uid}`,
                  JSON.stringify(incomingTimer)
                );
              }
              return incomingTimer;
            }
            return current;
          });
          break;
        }

        case 'timer:delete': {
          setActiveTimer(null);
          if (user && typeof window !== 'undefined') {
            localStorage.removeItem(`scholarpulse_timer_${user.uid}`);
          }
          break;
        }

        case 'task:create': {
          const task = payload?.task;
          if (task) {
            setData((prev) => {
              if (!prev) return null;
              if (prev.tasks.some((t) => t.id === task.id)) return prev;
              return { ...prev, tasks: [...prev.tasks, task] };
            });
          }
          break;
        }

        case 'task:update': {
          const task = payload?.task;
          if (task) {
            setData((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                tasks: prev.tasks.map((t) => (t.id === task.id ? task : t)),
              };
            });
          }
          break;
        }

        case 'task:delete': {
          const taskId = payload?.taskId;
          if (taskId) {
            setData((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                tasks: prev.tasks.filter((t) => t.id !== taskId),
              };
            });
          }
          break;
        }

        case 'session:create': {
          const session = payload?.session;
          if (session) {
            setData((prev) => {
              if (!prev) return null;
              if (prev.studySessions.some((s) => s.id === session.id)) return prev;
              return {
                ...prev,
                studySessions: [session, ...prev.studySessions],
              };
            });
          }
          if (!isFromSelf) {
            refreshWorkspace().catch(() => {});
          }
          break;
        }

        case 'session:update': {
          const session = payload?.session;
          if (session) {
            setData((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                studySessions: prev.studySessions.map((s) =>
                  s.id === session.id ? session : s
                ),
              };
            });
          }
          if (!isFromSelf) {
            refreshWorkspace().catch(() => {});
          }
          break;
        }

        case 'session:delete': {
          const sessionId = payload?.sessionId;
          if (sessionId) {
            setData((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                studySessions: prev.studySessions.filter((s) => s.id !== sessionId),
              };
            });
          }
          if (!isFromSelf) {
            refreshWorkspace().catch(() => {});
          }
          break;
        }

        case 'schedule:create': {
          const schedule = payload?.schedule;
          if (schedule) {
            setData((prev) => {
              if (!prev) return null;
              if (prev.schedules.some((s) => s.id === schedule.id)) return prev;
              return { ...prev, schedules: [...prev.schedules, schedule] };
            });
          }
          break;
        }

        case 'schedule:update': {
          const schedule = payload?.schedule;
          if (schedule) {
            setData((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                schedules: prev.schedules.map((s) =>
                  s.id === schedule.id ? schedule : s
                ),
              };
            });
          }
          break;
        }

        case 'schedule:delete': {
          const scheduleId = payload?.scheduleId;
          if (scheduleId) {
            setData((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                schedules: prev.schedules.filter((s) => s.id !== scheduleId),
              };
            });
          }
          break;
        }

        case 'goal:create': {
          const goal = payload?.goal;
          if (goal) {
            setData((prev) => {
              if (!prev) return null;
              if (prev.goals.some((g) => g.id === goal.id)) return prev;
              return { ...prev, goals: [...prev.goals, goal] };
            });
          }
          break;
        }

        case 'goal:update': {
          const goal = payload?.goal;
          if (goal) {
            setData((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                goals: prev.goals.map((g) => (g.id === goal.id ? goal : g)),
              };
            });
          }
          break;
        }

        case 'goal:delete': {
          const goalId = payload?.goalId;
          if (goalId) {
            setData((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                goals: prev.goals.filter((g) => g.id !== goalId),
              };
            });
          }
          break;
        }

        case 'subject:create': {
          const subject = payload?.subject;
          if (subject) {
            setData((prev) => {
              if (!prev) return null;
              if (prev.subjects.some((s) => s.id === subject.id)) return prev;
              return { ...prev, subjects: [...prev.subjects, subject] };
            });
          }
          break;
        }

        case 'subject:update': {
          const subject = payload?.subject;
          if (subject) {
            setData((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                subjects: prev.subjects.map((s) =>
                  s.id === subject.id ? subject : s
                ),
              };
            });
          }
          break;
        }

        case 'subject:delete': {
          const subjectId = payload?.subjectId;
          if (subjectId) {
            setData((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                subjects: prev.subjects.filter((s) => s.id !== subjectId),
              };
            });
          }
          break;
        }

        case 'revision:toggle': {
          const { record, topicId, category, isCompleted } = payload || {};
          if (topicId && category) {
            if (!isFromSelf) {
              setData((prev) => {
                if (!prev) return null;
                const prevRecord = revisionData?.records.find(
                  (r) => r.topicId === topicId && r.category === category
                );
                const wasCompleted = prevRecord?.isCompleted ?? false;
                const xpDelta = !wasCompleted && isCompleted ? 25 : wasCompleted && !isCompleted ? -25 : 0;
                if (xpDelta === 0) return prev;
                return {
                  ...prev,
                  profile: {
                    ...prev.profile,
                    gamificationXp: Math.max(0, (prev.profile.gamificationXp || 0) + xpDelta),
                  },
                };
              });
            }

            setRevisionData((prev) => {
              if (!prev) return null;
              const filtered = prev.records.filter(
                (r) => !(r.topicId === topicId && r.category === category)
              );
              const nextRecords =
                isCompleted && record ? [...filtered, record] : filtered;
              const updated = { ...prev, records: nextRecords };
              revisionCacheRef.current = updated;
              return updated;
            });
          }
          break;
        }

        case 'revision:detailed': {
          const record = payload?.record;
          if (record) {
            setRevisionData((prev) => {
              if (!prev) return null;
              const filtered = prev.records.filter(
                (r) =>
                  r.id !== record.id &&
                  !(r.topicId === record.topicId && r.category === record.category)
              );
              const nextRecords = [...filtered, record];
              const updated = { ...prev, records: nextRecords };
              revisionCacheRef.current = updated;
              return updated;
            });
          }
          break;
        }

        case 'revision:delete': {
          const recordId = payload?.recordId;
          if (recordId) {
            setRevisionData((prev) => {
              if (!prev) return null;
              const nextRecords = prev.records.filter((r) => r.id !== recordId);
              const updated = { ...prev, records: nextRecords };
              revisionCacheRef.current = updated;
              return updated;
            });
          }
          break;
        }

        case 'revision:topic:create': {
          const topic = payload?.topic;
          if (topic) {
            setRevisionData((prev) => {
              if (!prev) return null;
              if (prev.topics.some((t) => t.id === topic.id)) return prev;
              const updated = { ...prev, topics: [...prev.topics, topic] };
              revisionCacheRef.current = updated;
              return updated;
            });
          }
          break;
        }

        case 'revision:subject:create':
        case 'revision:refresh': {
          if (!isFromSelf) {
            fetchRevisionWorkspace(true).catch(() => {});
          }
          break;
        }

        case 'revision:customization:update': {
          const cust = payload?.customization;
          if (cust) {
            setRevisionData((prev) => {
              if (!prev) return null;
              const filtered = prev.customizations.filter(
                (c) =>
                  !(
                    c.targetType === cust.targetType &&
                    c.targetId === cust.targetId
                  )
              );
              const updated = { ...prev, customizations: [...filtered, cust] };
              revisionCacheRef.current = updated;
              return updated;
            });
          }
          break;
        }

        case 'revision:resource:create': {
          const resource = payload?.resource;
          if (resource) {
            setRevisionData((prev) => {
              if (!prev) return null;
              if ((prev.resources || []).some((r) => r.id === resource.id))
                return prev;
              const updated = {
                ...prev,
                resources: [resource, ...(prev.resources || [])],
              };
              revisionCacheRef.current = updated;
              return updated;
            });
          }
          break;
        }

        case 'revision:resource:delete': {
          const resourceId = payload?.resourceId;
          if (resourceId) {
            setRevisionData((prev) => {
              if (!prev) return null;
              const updated = {
                ...prev,
                resources: (prev.resources || []).filter(
                  (r) => r.id !== resourceId
                ),
              };
              revisionCacheRef.current = updated;
              return updated;
            });
          }
          break;
        }

        case 'profile:update': {
          const profile = payload?.profile;
          if (profile) {
            setData((prev) =>
              prev ? { ...prev, profile: { ...prev.profile, ...profile } } : null
            );
            if (profile.themePreference) {
              setTheme(profile.themePreference);
            }
          }
          break;
        }

        case 'preferences:update': {
          const preferences = payload?.preferences;
          if (preferences) {
            setData((prev) =>
              prev ? { ...prev, notificationPreferences: preferences } : null
            );
          }
          break;
        }

        case 'workspace:refresh': {
          if (!isFromSelf) {
            refreshWorkspace().catch(() => {});
          }
          break;
        }

        default:
          break;
      }
    },
    [user, refreshWorkspace, setTheme]
  );

  // Connect native real-time sync (SSE + BroadcastChannel)
  const { syncStatus, lastSyncTime, broadcastLocal } = useRealtimeSync({
    userId: user?.uid,
    onEvent: handleIncomingSyncEvent,
  });

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

  // Persist Active Timer via Server Action and Real-Time Broadcast
  const persistActiveTimer = useCallback(
    async (nextTimer: ActiveTimerSession | null) => {
      setActiveTimer(nextTimer);
      if (!user) return;
      const localKey = `scholarpulse_timer_${user.uid}`;
      const deviceId = getClientDeviceId();

      if (!nextTimer) {
        if (typeof window !== 'undefined') localStorage.removeItem(localKey);
        broadcastLocal('timer:delete', {});
        await deleteActiveTimerAction(deviceId).catch(() => {});
      } else {
        const timerWithDevice = { ...nextTimer, clientDeviceId: deviceId };
        if (typeof window !== 'undefined') {
          localStorage.setItem(localKey, JSON.stringify(timerWithDevice));
        }
        broadcastLocal('timer:update', { timer: timerWithDevice });
        const res = await syncActiveTimerAction(timerWithDevice).catch(() => null);
        if (res?.success && res.timer) {
          if (typeof window !== 'undefined') {
            localStorage.setItem(localKey, JSON.stringify(res.timer));
          }
          setActiveTimer(res.timer);
        }
      }
    },
    [user, broadcastLocal]
  );

  // Complete onboarding
  const completeOnboarding = useCallback(async (payload: any) => {
    const res = await completeOnboardingAction({ ...payload, clientDeviceId: getClientDeviceId() });
    if (res.success && res.data) {
      setData(res.data as unknown as WorkspaceData);
      broadcastLocal('workspace:refresh', {});
      addToast({
        title: 'Welcome to ScholarPulse!',
        description: 'Your academic workspace is set up.',
        variant: 'success',
      });
    }
  }, [addToast, broadcastLocal]);

  // Update profile
  const updateProfile = useCallback(async (payload: Partial<Profile>) => {
    const res = await updateProfileAction({ ...payload, clientDeviceId: getClientDeviceId() });
    if (res.success && res.profile) {
      setData((prev) => prev ? { ...prev, profile: res.profile as Profile } : null);
      if (payload.themePreference) {
        setTheme(payload.themePreference);
      }
      broadcastLocal('profile:update', { profile: res.profile });
      addToast({
        title: 'Profile Updated',
        description: 'Your study preferences were saved.',
        variant: 'success',
      });
    }
  }, [addToast, setTheme, broadcastLocal]);

  // Update notification prefs
  const updateNotificationPrefs = useCallback(async (payload: Partial<NotificationPreferences>) => {
    const res = await updateNotificationPreferencesAction({ ...payload, clientDeviceId: getClientDeviceId() });
    if (res.success && res.preferences) {
      setData((prev) => prev ? { ...prev, notificationPreferences: res.preferences as NotificationPreferences } : null);
      broadcastLocal('preferences:update', { preferences: res.preferences });
      addToast({
        title: 'Preferences Saved',
        description: 'Notification settings have been updated.',
        variant: 'success',
      });
    }
  }, [addToast, broadcastLocal]);

  // Subjects CRUD
  const createSubject = useCallback(async (payload: Partial<Subject>) => {
    const res = await createSubjectAction({ ...payload, clientDeviceId: getClientDeviceId() });
    if (!res.success || !res.subject) throw new Error('Failed to create subject');
    const created = res.subject as Subject;
    setData((prev) => prev ? { ...prev, subjects: [...prev.subjects, created] } : null);
    broadcastLocal('subject:create', { subject: created });
    addToast({ title: 'Subject Created', description: `Added ${created.name}`, variant: 'success' });
    return created;
  }, [addToast, broadcastLocal]);

  const updateSubject = useCallback(async (id: string, payload: Partial<Subject>) => {
    const res = await updateSubjectAction(id, { ...payload, clientDeviceId: getClientDeviceId() });
    if (!res.success || !res.subject) throw new Error('Failed to update subject');
    const updated = res.subject as Subject;
    setData((prev) => prev ? {
      ...prev,
      subjects: prev.subjects.map((s) => s.id === id ? updated : s),
    } : null);
    broadcastLocal('subject:update', { subject: updated });
    addToast({ title: 'Subject Updated', description: `Saved changes to ${updated.name}`, variant: 'success' });
    return updated;
  }, [addToast, broadcastLocal]);

  const deleteSubject = useCallback(async (id: string) => {
    await deleteSubjectAction(id, getClientDeviceId());
    setData((prev) => prev ? {
      ...prev,
      subjects: prev.subjects.filter((s) => s.id !== id),
    } : null);
    broadcastLocal('subject:delete', { subjectId: id });
    addToast({ title: 'Subject Deleted', description: 'Subject and its records removed.', variant: 'default' });
  }, [addToast, broadcastLocal]);

  // Study Sessions CRUD
  const createSession = useCallback(async (payload: any) => {
    const res = await createStudySessionAction({ ...payload, clientDeviceId: getClientDeviceId() });
    if (!res.success || !res.session) throw new Error('Failed to save study session');
    const session = res.session as StudySession;
    broadcastLocal('session:create', { session });
    await refreshWorkspace();
    addToast({ title: 'Session Saved', description: 'Study activity logged successfully.', variant: 'success' });
    return session;
  }, [addToast, refreshWorkspace, broadcastLocal]);

  const updateSession = useCallback(async (id: string, payload: any) => {
    const res = await updateStudySessionAction(id, { ...payload, clientDeviceId: getClientDeviceId() });
    if (!res.success || !res.session) throw new Error('Failed to update session');
    const session = res.session as StudySession;
    broadcastLocal('session:update', { session });
    await refreshWorkspace();
    addToast({ title: 'Session Updated', description: 'Session details modified.', variant: 'success' });
    return session;
  }, [addToast, refreshWorkspace, broadcastLocal]);

  const deleteSession = useCallback(async (id: string) => {
    await deleteStudySessionAction(id, getClientDeviceId());
    broadcastLocal('session:delete', { sessionId: id });
    await refreshWorkspace();
    addToast({ title: 'Session Deleted', description: 'Session was removed from log.', variant: 'default' });
  }, [addToast, refreshWorkspace, broadcastLocal]);

  // Tasks CRUD
  const createTask = useCallback(async (payload: any) => {
    const res = await createTaskAction({ ...payload, clientDeviceId: getClientDeviceId() });
    if (!res.success || !res.task) throw new Error('Failed to create task');
    const task = res.task as unknown as TaskItem;
    setData((prev) => prev ? { ...prev, tasks: [...prev.tasks, task] } : null);
    broadcastLocal('task:create', { task });
    addToast({ title: 'Task Created', description: `Added "${task.title}"`, variant: 'success' });
    return task;
  }, [addToast, broadcastLocal]);

  const updateTask = useCallback(async (id: string, payload: any) => {
    const res = await updateTaskAction(id, { ...payload, clientDeviceId: getClientDeviceId() });
    if (!res.success || !res.task) throw new Error('Failed to update task');
    const task = res.task as unknown as TaskItem;
    setData((prev) => prev ? {
      ...prev,
      tasks: prev.tasks.map((t) => t.id === id ? task : t),
    } : null);
    broadcastLocal('task:update', { task });
    return task;
  }, [broadcastLocal]);

  const deleteTask = useCallback(async (id: string) => {
    await deleteTaskAction(id, getClientDeviceId());
    setData((prev) => prev ? {
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== id),
    } : null);
    broadcastLocal('task:delete', { taskId: id });
    addToast({ title: 'Task Deleted', description: 'Task removed.', variant: 'default' });
  }, [addToast, broadcastLocal]);

  // Schedules CRUD
  const createSchedule = useCallback(async (payload: any) => {
    const res = await createScheduleAction({ ...payload, clientDeviceId: getClientDeviceId() });
    if (!res.success || !res.schedule) throw new Error('Failed to create schedule');
    const schedule = res.schedule as unknown as ScheduleItem;
    setData((prev) => prev ? { ...prev, schedules: [...prev.schedules, schedule] } : null);
    broadcastLocal('schedule:create', { schedule });
    addToast({ title: 'Timetable Updated', description: 'Class schedule added.', variant: 'success' });
    return schedule;
  }, [addToast, broadcastLocal]);

  const updateSchedule = useCallback(async (id: string, payload: any) => {
    const res = await updateScheduleAction(id, { ...payload, clientDeviceId: getClientDeviceId() });
    if (!res.success || !res.schedule) throw new Error('Failed to update schedule');
    const schedule = res.schedule as unknown as ScheduleItem;
    setData((prev) => prev ? {
      ...prev,
      schedules: prev.schedules.map((s) => s.id === id ? schedule : s),
    } : null);
    broadcastLocal('schedule:update', { schedule });
    return schedule;
  }, [broadcastLocal]);

  const deleteSchedule = useCallback(async (id: string) => {
    await deleteScheduleAction(id, getClientDeviceId());
    setData((prev) => prev ? {
      ...prev,
      schedules: prev.schedules.filter((s) => s.id !== id),
    } : null);
    broadcastLocal('schedule:delete', { scheduleId: id });
    addToast({ title: 'Schedule Removed', description: 'Time slot deleted.', variant: 'default' });
  }, [addToast, broadcastLocal]);

  // Goals CRUD
  const createGoal = useCallback(async (payload: any) => {
    const res = await createGoalAction({ ...payload, clientDeviceId: getClientDeviceId() });
    if (!res.success || !res.goal) throw new Error('Failed to create goal');
    const goal = res.goal as unknown as GoalItem;
    setData((prev) => prev ? { ...prev, goals: [...prev.goals, goal] } : null);
    broadcastLocal('goal:create', { goal });
    addToast({ title: 'Goal Created', description: `Target: ${goal.title}`, variant: 'success' });
    return goal;
  }, [addToast, broadcastLocal]);

  const updateGoal = useCallback(async (id: string, payload: any) => {
    const res = await updateGoalAction(id, { ...payload, clientDeviceId: getClientDeviceId() });
    if (!res.success || !res.goal) throw new Error('Failed to update goal');
    const goal = res.goal as unknown as GoalItem;
    setData((prev) => prev ? {
      ...prev,
      goals: prev.goals.map((g) => g.id === id ? goal : g),
    } : null);
    broadcastLocal('goal:update', { goal });
    return goal;
  }, [broadcastLocal]);

  const deleteGoal = useCallback(async (id: string) => {
    await deleteGoalAction(id, getClientDeviceId());
    setData((prev) => prev ? {
      ...prev,
      goals: prev.goals.filter((g) => g.id !== id),
    } : null);
    broadcastLocal('goal:delete', { goalId: id });
    addToast({ title: 'Goal Removed', description: 'Goal deleted.', variant: 'default' });
  }, [addToast, broadcastLocal]);

  // Backup & Account
  const restoreBackup = useCallback(async (mode: 'merge' | 'replace', backupData: any) => {
    const res = await restoreBackupAction({ ...backupData, mode, clientDeviceId: getClientDeviceId() });
    if (res.success && res.data) {
      setData(res.data as unknown as WorkspaceData);
      broadcastLocal('workspace:refresh', {});
      addToast({ title: 'Backup Restored', description: 'Your study data was recovered.', variant: 'success' });
    }
  }, [addToast, broadcastLocal]);

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
    const res = await toggleRevisionAction({ ...opts, clientDeviceId: getClientDeviceId() });
    if (!res.success || !res.record) throw new Error('Failed to toggle revision');
    const rec = res.record as unknown as RevisionRecord;
    
    // Check if completion status changed to update gamification XP
    const prevRecord = revisionData?.records.find(
      (r) => r.topicId === opts.topicId && r.category === opts.category
    );
    const wasCompleted = prevRecord?.isCompleted ?? false;
    const xpDelta = !wasCompleted && opts.isCompleted ? 25 : wasCompleted && !opts.isCompleted ? -25 : 0;

    if (xpDelta !== 0) {
      setData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          profile: {
            ...prev.profile,
            gamificationXp: Math.max(0, (prev.profile.gamificationXp || 0) + xpDelta),
          },
        };
      });
    }

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

    broadcastLocal('revision:toggle', {
      record: rec,
      subjectId: opts.subjectId,
      topicId: opts.topicId,
      category: opts.category,
      isCompleted: opts.isCompleted,
    });

    return rec;
  }, [revisionData?.records, broadcastLocal]);

  const saveDetailedRevision = useCallback(async (opts: any) => {
    const prevRecord = revisionData?.records.find((r) => r.id === opts.id || (r.topicId === opts.topicId && r.category === opts.category));
    const wasCompleted = prevRecord?.isCompleted ?? false;
    const isCompleted = opts.isCompleted !== undefined ? opts.isCompleted : true;
    const xpDelta = !wasCompleted && isCompleted ? 25 : wasCompleted && !isCompleted ? -25 : 0;

    const res = await saveDetailedRevisionRecordAction({ ...opts, clientDeviceId: getClientDeviceId() });
    if (!res.success || !res.record) throw new Error('Failed to save detailed record');
    const rec = res.record as unknown as RevisionRecord;

    if (xpDelta !== 0) {
      setData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          profile: {
            ...prev.profile,
            gamificationXp: Math.max(0, (prev.profile.gamificationXp || 0) + xpDelta),
          },
        };
      });
    }

    setRevisionData((prev) => {
      if (!prev) return null;
      const filtered = prev.records.filter((r) => r.id !== rec.id && !(r.topicId === rec.topicId && r.category === rec.category));
      const nextRecords = [...filtered, rec];
      const updated = { ...prev, records: nextRecords };
      revisionCacheRef.current = updated;
      return updated;
    });

    broadcastLocal('revision:detailed', { record: rec });
    return rec;
  }, [revisionData?.records, broadcastLocal]);

  const deleteRevisionRecordItem = useCallback(async (recordId: string) => {
    const existing = revisionData?.records.find((r) => r.id === recordId);
    if (existing?.isCompleted) {
      setData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          profile: {
            ...prev.profile,
            gamificationXp: Math.max(0, (prev.profile.gamificationXp || 0) - 25),
          },
        };
      });
    }

    await deleteRevisionRecordAction(recordId, getClientDeviceId());
    setRevisionData((prev) => {
      if (!prev) return null;
      const nextRecords = prev.records.filter((r) => r.id !== recordId);
      const updated = { ...prev, records: nextRecords };
      revisionCacheRef.current = updated;
      return updated;
    });

    broadcastLocal('revision:delete', { recordId });
  }, [revisionData?.records, broadcastLocal]);

  const addCustomCurriculumTopicItem = useCallback(async (opts: any) => {
    const res = await addCustomCurriculumTopicAction({ ...opts, clientDeviceId: getClientDeviceId() });
    if (!res.success || !res.topic) throw new Error('Failed to add custom topic');
    const topic = res.topic as CurriculumTopic;
    setRevisionData((prev) => {
      if (!prev) return null;
      const updated = { ...prev, topics: [...prev.topics, topic] };
      revisionCacheRef.current = updated;
      return updated;
    });
    broadcastLocal('revision:topic:create', { topic });
    return topic;
  }, [broadcastLocal]);

  const addCustomCurriculumSubjectItem = useCallback(async (opts: any) => {
    const res = await addCustomCurriculumSubjectAction({ ...opts, clientDeviceId: getClientDeviceId() });
    if (!res.success || !res.subject) throw new Error('Failed to add custom subject');
    const subject = res.subject as { subject: CurriculumSubject; paper: CurriculumPaper };
    broadcastLocal('revision:subject:create', { subject });
    await fetchRevisionWorkspace(true);
    return subject;
  }, [fetchRevisionWorkspace, broadcastLocal]);

  const updateCurriculumCustomizationItem = useCallback(async (opts: any) => {
    const res = await updateCurriculumCustomizationAction({ ...opts, clientDeviceId: getClientDeviceId() });
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
    broadcastLocal('revision:customization:update', { customization: cust });
    return cust;
  }, [broadcastLocal]);

  // Chapter Resources
  const createResource = useCallback(async (payload: any) => {
    const res = await createCurriculumResourceAction({ ...payload, clientDeviceId: getClientDeviceId() });
    if (!res.success || !res.resource) throw new Error('Failed to save resource');
    const resource = res.resource as unknown as CurriculumResourceItem;
    setRevisionData((prev) => {
      if (!prev) return null;
      const updated = { ...prev, resources: [resource, ...(prev.resources || [])] };
      revisionCacheRef.current = updated;
      return updated;
    });
    broadcastLocal('revision:resource:create', { resource });
    addToast({ title: 'Resource Saved', description: `Saved: ${resource.title}`, variant: 'success' });
    return resource;
  }, [addToast, broadcastLocal]);

  const deleteResource = useCallback(async (id: string) => {
    await deleteCurriculumResourceAction(id, getClientDeviceId());
    setRevisionData((prev) => {
      if (!prev) return null;
      const updated = {
        ...prev,
        resources: (prev.resources || []).filter((r) => r.id !== id),
      };
      revisionCacheRef.current = updated;
      return updated;
    });
    broadcastLocal('revision:resource:delete', { resourceId: id });
    addToast({ title: 'Resource Removed', description: 'Link deleted.', variant: 'default' });
  }, [addToast, broadcastLocal]);

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
    broadcastLocal('profile:update', { profile: { targetExamName, targetExamDate } });
    addToast({ title: 'Exam Target Updated', description: `${targetExamName} set to ${targetExamDate}`, variant: 'success' });
  }, [addToast, updateProfileAction, broadcastLocal]);

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
    createResource,
    deleteResource,
    syncStatus,
    lastSyncTime,
    updateExamTarget,
  }), [
    syncStatus,
    lastSyncTime,
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
