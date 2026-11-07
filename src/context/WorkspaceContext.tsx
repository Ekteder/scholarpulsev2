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
  getInitialWorkspaceSessionAction,
  getWorkspaceDataAction,
  completeOnboardingAction,
  updateProfileAction,
  updateThemePreferenceAction,
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
  isBanned?: boolean;
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
  persistActiveTimer: (
    nextTimer: ActiveTimerSession | null,
    clearedIdempotencyKey?: string
  ) => Promise<void>;

  // Optimistic session helpers for 0ms timer completion
  insertOptimisticSession: (session: StudySession) => void;
  reconcileOptimisticSession: (tempId: string, realSession: StudySession) => void;
  removeOptimisticSession: (tempId: string) => void;

  // CRUD actions (All routed via Server Actions)
  refreshWorkspace: (
    opts?: { silent?: boolean; preserveLocalTimer?: boolean } | React.SyntheticEvent | unknown
  ) => Promise<void>;
  completeOnboarding: (payload: any) => Promise<void>;
  updateProfile: (payload: Partial<Profile>) => Promise<void>;
  setThemePreference: (theme: 'light' | 'dark' | 'system') => void;
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

function applyThemeToDOM(theme: 'light' | 'dark' | 'system') {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  const hasDarkPref =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && hasDarkPref);

  if (isDark) {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
  }
  root.style.colorScheme = isDark ? 'dark' : 'light';
}

export interface WorkspaceProviderProps {
  children: React.ReactNode;
  initialUser?: AuthUser | null;
  initialData?: WorkspaceData | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({
  children,
  initialUser,
  initialData,
}: WorkspaceProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(initialUser ?? null);
  const [authLoading, setAuthLoading] = useState(initialUser === undefined);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [data, setData] = useState<WorkspaceData | null>(initialData ?? null);
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
  const needsFollowUpRefreshRef = useRef(false);
  const lastLocalThemeChangeRef = useRef<number>(0);
  const { setTheme } = useTheme();
  const setThemeRef = useRef(setTheme);
  setThemeRef.current = setTheme;
  const dataRef = useRef(data);
  dataRef.current = data;
  const activeTimerRef = useRef(activeTimer);
  activeTimerRef.current = activeTimer;
  const pendingDeletedIdsRef = useRef<Set<string>>(new Set());
  const recentlyClearedTimerKeyRef = useRef<{ key: string; clearedAt: number } | null>(null);

  const isRecentlyClearedTimer = useCallback((idempotencyKey?: string | null): boolean => {
    if (!idempotencyKey || !recentlyClearedTimerKeyRef.current) return false;
    return (
      recentlyClearedTimerKeyRef.current.key === idempotencyKey &&
      Date.now() - recentlyClearedTimerKeyRef.current.clearedAt < 60000
    );
  }, []);

  const cacheWorkspaceLocally = useCallback((uid: string, wData: WorkspaceData) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`scholarpulse_cache_${uid}`, JSON.stringify(wData));
    } catch {}
  }, []);

  // Sync initialUser if server props update
  useEffect(() => {
    if (initialUser !== undefined) {
      setUser(initialUser);
      setAuthLoading(false);
    }
  }, [initialUser]);

  // Instantly restore cached workspace data on client mount if available
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentUid = user?.uid;
    if (currentUid && !data) {
      try {
        const cachedRaw = localStorage.getItem(`scholarpulse_cache_${currentUid}`);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached && typeof cached === 'object' && cached.profile) {
            setData(cached);
          }
        }
      } catch {}
    }
  }, [user?.uid]);

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
  const refreshWorkspace = useCallback(
    async (
      rawOpts?: { silent?: boolean; preserveLocalTimer?: boolean } | React.SyntheticEvent | unknown
    ) => {
      const opts =
        rawOpts && typeof rawOpts === 'object' && !('nativeEvent' in rawOpts)
          ? (rawOpts as { silent?: boolean; preserveLocalTimer?: boolean })
          : undefined;

      if (refreshPromiseRef.current) {
        needsFollowUpRefreshRef.current = true;
        return refreshPromiseRef.current;
      }

      const promise = (async () => {
        let currentOpts = opts;
        try {
          if (!currentOpts?.silent) {
            setWorkspaceLoading(true);
          }
          setWorkspaceError(null);

          do {
            needsFollowUpRefreshRef.current = false;

            // If user is not yet known, verify session first
            let activeUser = user;
            if (!activeUser) {
              const session = await getInitialWorkspaceSessionAction();
              if (session.success && session.user) {
                setUser(session.user);
                activeUser = session.user;
                if (session.user.isBanned) {
                  return;
                }
                if (session.data) {
                  const workspace = session.data as unknown as WorkspaceData;
                  setData(workspace);
                  cacheWorkspaceLocally(session.user.uid, workspace);
                  return;
                }
              }
            }

            const res = await getWorkspaceDataAction();
            if (!res.success || !res.data) {
              throw new Error('Failed to load workspace data');
            }

            const workspace = res.data as unknown as WorkspaceData;
            setData((prev) => {
              const pendingDeletes = pendingDeletedIdsRef.current;
              const filteredSubjects = (workspace.subjects || []).filter(
                (s) => !pendingDeletes.has(s.id)
              );
              let mergedSessions = (workspace.studySessions || []).filter(
                (s) => !pendingDeletes.has(s.id) && !pendingDeletes.has(s.subjectId)
              );
              const filteredTasks = (workspace.tasks || []).filter(
                (t) => !pendingDeletes.has(t.id) && (!t.subjectId || !pendingDeletes.has(t.subjectId))
              );
              const filteredSchedules = (workspace.schedules || []).filter(
                (s) => !pendingDeletes.has(s.id) && !pendingDeletes.has(s.subjectId)
              );
              const filteredGoals = (workspace.goals || []).filter(
                (g) => !pendingDeletes.has(g.id) && (!g.subjectId || !pendingDeletes.has(g.subjectId))
              );

              // Retain any in-flight optimistic sessions that haven't arrived in server snapshot yet
              if (prev?.studySessions) {
                const serverKeys = new Set(
                  mergedSessions.map((s) => s.idempotencyKey).filter(Boolean)
                );
                const inFlightOptimistic = prev.studySessions.filter(
                  (s) =>
                    String(s.id).startsWith('optimistic_') &&
                    !pendingDeletes.has(s.id) &&
                    !pendingDeletes.has(s.subjectId) &&
                    (!s.idempotencyKey || !serverKeys.has(s.idempotencyKey))
                );
                if (inFlightOptimistic.length > 0) {
                  mergedSessions = [...inFlightOptimistic, ...mergedSessions].sort(
                    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
                  );
                }
              }

              const nextWorkspace: WorkspaceData = {
                ...workspace,
                subjects: filteredSubjects,
                studySessions: mergedSessions,
                tasks: filteredTasks,
                schedules: filteredSchedules,
                goals: filteredGoals,
              };

              if (activeUser?.uid) {
                cacheWorkspaceLocally(activeUser.uid, nextWorkspace);
              }
              return nextWorkspace;
            });

            // Sync theme with next-themes if specified in profile, respecting recent local actions
            if (workspace.profile?.themePreference) {
              const profileTheme = workspace.profile.themePreference as 'light' | 'dark' | 'system';
              const localTheme = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
              if (!localTheme || Date.now() - lastLocalThemeChangeRef.current > 10000) {
                if (localTheme !== profileTheme) {
                  applyThemeToDOM(profileTheme);
                  if (typeof window !== 'undefined') {
                    try {
                      localStorage.setItem('theme', profileTheme);
                    } catch {}
                  }
                  setThemeRef.current?.(profileTheme);
                }
              }
            }

            // Active timer sync (skipped during background session/goal refreshes to avoid timer race conditions)
            const uid = workspace.profile?.userId;
            if (!currentOpts?.preserveLocalTimer && uid && typeof window !== 'undefined') {
              const localKey = `scholarpulse_timer_${uid}`;
              const localRaw = localStorage.getItem(localKey);
              let resolvedTimer: ActiveTimerSession | null = workspace.activeTimer;

              // Anti-resurrection guard for timers cleared optimistically milliseconds ago
              if (resolvedTimer && isRecentlyClearedTimer(resolvedTimer.idempotencyKey)) {
                resolvedTimer = null;
              }

              if (localRaw) {
                try {
                  if (!resolvedTimer) {
                    // Cloud confirms no active timer: remove stale local cache, do not resurrect!
                    localStorage.removeItem(localKey);
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

            if (needsFollowUpRefreshRef.current) {
              currentOpts = { silent: true, preserveLocalTimer: true };
            }
          } while (needsFollowUpRefreshRef.current);
        } catch (err: any) {
          needsFollowUpRefreshRef.current = false;
          console.error('refreshWorkspace error:', err);
          if (!opts?.silent) {
            setWorkspaceError(err?.message || 'Failed to load workspace.');
          }
          if (err?.message?.toLowerCase().includes('banned')) {
            setUser((prev) => (prev ? { ...prev, isBanned: true } : null));
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    profile: prev.profile ? { ...prev.profile, isBanned: true } : prev.profile,
                  }
                : null
            );
            setActiveTimer(null);
          }
        } finally {
          if (!opts?.silent) {
            setWorkspaceLoading(false);
          }
          refreshPromiseRef.current = null;
        }
      })();

      refreshPromiseRef.current = promise;
      return promise;
    },
    [user, cacheWorkspaceLocally, isRecentlyClearedTimer]
  );

  // Central Real-time Sync Event Handler (SSE + BroadcastChannel)
  const handleIncomingSyncEvent = useCallback(
    (eventType: string, payload: any, originDeviceId?: string) => {
      const isFromSelf = Boolean(
        originDeviceId &&
        originDeviceId === getClientDeviceId() &&
        !originDeviceId.startsWith('crosstab_')
      );

      switch (eventType) {
        case 'connected': {
          setUser((prev) => {
            if (prev?.isBanned) {
              refreshWorkspace().catch(() => {});
              return { ...prev, isBanned: false };
            }
            return prev;
          });
          const initialTimer = payload?.activeTimer as ActiveTimerSession | null | undefined;
          if (initialTimer) {
            if (isRecentlyClearedTimer(initialTimer.idempotencyKey)) {
              break;
            }
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
          if (isRecentlyClearedTimer(incomingTimer.idempotencyKey)) return;

          // Forward to Native Android Bridge if running inside native shell
          const updateTimestamp = payload?.serverUpdatedAt || Date.now();
          if (typeof window !== 'undefined' && (window as any).ScholarPulseBridge?.call) {
            try {
              const action = incomingTimer.status === 'paused' ? 'PAUSE' : 'RESUME';
              (window as any).ScholarPulseBridge.call('timer.onRemoteSync', {
                action,
                accumulatedSeconds: incomingTimer.accumulatedSeconds,
                updatedAt: updateTimestamp,
                originDeviceId: incomingTimer.clientDeviceId || '',
                idempotencyKey: incomingTimer.idempotencyKey || '',
              });
            } catch (e) {
              console.warn('[WorkspaceContext] Failed to forward timer:update to native bridge:', e);
            }
          } else if (typeof window !== 'undefined' && typeof (window as any).ScholarPulseBridge?.onRemoteTimerSync === 'function') {
            try {
              const action = incomingTimer.status === 'paused' ? 'PAUSE' : 'RESUME';
              (window as any).ScholarPulseBridge.onRemoteTimerSync(
                action,
                incomingTimer.accumulatedSeconds || 0,
                updateTimestamp,
                incomingTimer.clientDeviceId || ''
              );
            } catch (e) {
              console.warn('[WorkspaceContext] Failed to forward timer:update to native bridge via onRemoteTimerSync:', e);
            }
          }

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
          const deletedKey = payload?.idempotencyKey as string | undefined;
          if (deletedKey) {
            recentlyClearedTimerKeyRef.current = { key: deletedKey, clearedAt: Date.now() };
            // If a brand-new timer with a DIFFERENT idempotencyKey is already running, ignore stale delete
            if (
              activeTimerRef.current &&
              activeTimerRef.current.idempotencyKey !== deletedKey
            ) {
              break;
            }
          }

          const deleteTimestamp = payload?.serverUpdatedAt || Date.now();
          if (typeof window !== 'undefined' && (window as any).ScholarPulseBridge?.call) {
            try {
              (window as any).ScholarPulseBridge.call('timer.onRemoteSync', {
                action: 'STOP',
                updatedAt: deleteTimestamp,
                originDeviceId: '',
                idempotencyKey: deletedKey || '',
              });
            } catch (e) {
              console.warn('[WorkspaceContext] Failed to forward timer:delete to native bridge:', e);
            }
          } else if (typeof window !== 'undefined' && typeof (window as any).ScholarPulseBridge?.onRemoteTimerSync === 'function') {
            try {
              (window as any).ScholarPulseBridge.onRemoteTimerSync('STOP', 0, deleteTimestamp, '');
            } catch (e) {
              console.warn('[WorkspaceContext] Failed to forward timer:delete to native bridge via onRemoteTimerSync:', e);
            }
          }

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
          const session = payload?.session as StudySession | undefined;
          if (session) {
            setData((prev) => {
              if (!prev) return null;
              const filtered = prev.studySessions.filter(
                (s) =>
                  s.id !== session.id &&
                  !(session.idempotencyKey && s.idempotencyKey === session.idempotencyKey)
              );
              const nextSessions = [session, ...filtered].sort(
                (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
              );
              return {
                ...prev,
                studySessions: nextSessions,
              };
            });
          }
          if (!isFromSelf) {
            refreshWorkspace({ silent: true, preserveLocalTimer: true }).catch(() => {});
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
            refreshWorkspace({ silent: true, preserveLocalTimer: true }).catch(() => {});
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
            refreshWorkspace({ silent: true, preserveLocalTimer: true }).catch(() => {});
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
                const prevRecord = revisionCacheRef.current?.records.find(
                  (r) => r.topicId === topicId && r.category === category
                ) || revisionData?.records.find(
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
            } else if (record?.id) {
              // Silently reconcile database ID for local optimistic update
              setRevisionData((prev) => {
                if (!prev) return null;
                const nextRecords = prev.records.map((r) =>
                  r.topicId === topicId && r.category === category
                    ? { ...r, id: record.id, updatedAt: record.updatedAt }
                    : r
                );
                const updated = { ...prev, records: nextRecords };
                revisionCacheRef.current = updated;
                return updated;
              });
            }
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
            if (profile.themePreference && !isFromSelf) {
              const incomingTheme = profile.themePreference as 'light' | 'dark' | 'system';
              applyThemeToDOM(incomingTheme);
              if (typeof window !== 'undefined') {
                try {
                  localStorage.setItem('theme', incomingTheme);
                } catch {}
              }
              setThemeRef.current?.(incomingTheme);
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

        case 'goals:recalculated': {
          const unlocked = payload?.newlyUnlockedAchievements as string[] | undefined;
          if (unlocked && unlocked.length > 0) {
            addToast({
              title: 'Achievement Unlocked!',
              description: `Earned: ${unlocked.join(', ')}`,
              variant: 'success',
            });
          }
          refreshWorkspace({ silent: true, preserveLocalTimer: true }).catch(() => {});
          break;
        }

        case 'workspace:refresh': {
          if (payload?.targetedAnnouncement !== undefined) {
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    targetedAnnouncement: payload.targetedAnnouncement,
                    profile: prev.profile
                      ? { ...prev.profile, targetedAnnouncement: payload.targetedAnnouncement }
                      : prev.profile,
                  }
                : null
            );
          }
          if (!isFromSelf) {
            refreshWorkspace({ silent: true }).catch(() => {});
          }
          break;
        }

        case 'user:banned': {
          const isBanned = payload?.isBanned ?? true;
          setUser((prev) => (prev ? { ...prev, isBanned } : null));
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  profile: prev.profile ? { ...prev.profile, isBanned } : prev.profile,
                }
              : null
          );
          if (isBanned) {
            setActiveTimer(null);
            if (typeof window !== 'undefined' && user?.uid) {
              try {
                localStorage.removeItem(`scholarpulse_timer_${user.uid}`);
              } catch {}
            }
          } else {
            refreshWorkspace().catch(() => {});
          }
          break;
        }

        default:
          break;
      }
    },
    [refreshWorkspace, isRecentlyClearedTimer, user]
  );

  // Connect native real-time sync (SSE + BroadcastChannel)
  const { syncStatus, lastSyncTime, broadcastLocal } = useRealtimeSync({
    userId: user?.uid,
    onEvent: handleIncomingSyncEvent,
  });

  // Initial Auth & Workspace verification (Runs strictly ONCE on mount)
  useEffect(() => {
    // If the server explicitly confirmed no session, end auth loading immediately
    if (initialUser === null) {
      setAuthLoading(false);
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        if (initialUser === undefined) {
          setAuthLoading(true);
        }
        setWorkspaceError(null);

        // Safety fallback timeout to prevent hanging on network stalls
        const timeoutPromise = new Promise<{
          success: false;
          user: null;
          data: null;
          error: string;
        }>((resolve) =>
          setTimeout(
            () =>
              resolve({
                success: false,
                user: null,
                data: null,
                error: 'Session check timed out. Please retry connection.',
              }),
            8000
          )
        );

        const res = await Promise.race([
          getInitialWorkspaceSessionAction(),
          timeoutPromise,
        ]);

        if (!isMounted) return;

        if (res.success && res.user && res.data) {
          setUser(res.user);
          const workspace = res.data;
          setData(workspace as unknown as WorkspaceData);
          cacheWorkspaceLocally(res.user.uid, workspace as unknown as WorkspaceData);

          // Synchronize theme preference from profile if not recently modified locally
          if (workspace.profile?.themePreference) {
            const profileTheme = workspace.profile.themePreference as 'light' | 'dark' | 'system';
            const localTheme = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
            if (!localTheme || Date.now() - lastLocalThemeChangeRef.current > 10000) {
              if (localTheme !== profileTheme) {
                applyThemeToDOM(profileTheme);
                if (typeof window !== 'undefined') {
                  try {
                    localStorage.setItem('theme', profileTheme);
                  } catch {}
                }
                setThemeRef.current?.(profileTheme);
              }
            }
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
        } else if (res.success && !res.user) {
          setUser(null);
          setData(null);
          setActiveTimer(null);
          setRevisionData(null);
        } else {
          if (res.user) {
            setUser(res.user);
          }
          if (!dataRef.current) {
            setWorkspaceError(res.error || 'Failed to verify session.');
          }
        }
      } catch (err: any) {
        console.error('Session verification error:', err);
        if (isMounted && !dataRef.current) {
          setWorkspaceError(err?.message || 'Failed to load workspace.');
        }
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [initialUser, cacheWorkspaceLocally]);

  // Persist Active Timer via 0ms Optimistic State + Non-Blocking Background Sync
  const persistActiveTimer = useCallback(
    async (nextTimer: ActiveTimerSession | null, clearedIdempotencyKey?: string) => {
      const keyToClear = clearedIdempotencyKey || activeTimerRef.current?.idempotencyKey;
      if (!nextTimer && keyToClear) {
        recentlyClearedTimerKeyRef.current = { key: keyToClear, clearedAt: Date.now() };
      }

      activeTimerRef.current = nextTimer;
      setActiveTimer(nextTimer);

      if (!user) return;
      const localKey = `scholarpulse_timer_${user.uid}`;
      const deviceId = getClientDeviceId();

      if (!nextTimer) {
        if (typeof window !== 'undefined') localStorage.removeItem(localKey);
        broadcastLocal('timer:delete', keyToClear ? { idempotencyKey: keyToClear } : {});
        deleteActiveTimerAction(deviceId, keyToClear).catch((err) => {
          console.warn('Background deleteActiveTimerAction failed:', err);
        });
      } else {
        const timerWithDevice = { ...nextTimer, clientDeviceId: deviceId };
        if (typeof window !== 'undefined') {
          localStorage.setItem(localKey, JSON.stringify(timerWithDevice));
        }
        broadcastLocal('timer:update', { timer: timerWithDevice });
        syncActiveTimerAction(timerWithDevice)
          .then((res) => {
            if (res?.success && res.timer) {
              const serverTimer = res.timer;
              if (isRecentlyClearedTimer(serverTimer.idempotencyKey)) return;
              setActiveTimer((current) => {
                if (!current) return null;
                if (current.idempotencyKey !== serverTimer.idempotencyKey) return current;
                if ((current.stateVersion || 0) > (serverTimer.stateVersion || 0)) return current;
                if (typeof window !== 'undefined') {
                  localStorage.setItem(localKey, JSON.stringify(serverTimer));
                }
                return serverTimer;
              });
            }
          })
          .catch((err) => {
            console.warn('Background syncActiveTimerAction failed:', err);
          });
      }
    },
    [user, broadcastLocal, isRecentlyClearedTimer]
  );

  // Optimistic study session helpers for 0ms timer completion
  const insertOptimisticSession = useCallback(
    (session: StudySession) => {
      setData((prev) => {
        if (!prev) return null;
        const filtered = prev.studySessions.filter(
          (s) =>
            s.id !== session.id &&
            !(session.idempotencyKey && s.idempotencyKey === session.idempotencyKey)
        );
        const nextSessions = [session, ...filtered].sort(
          (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );
        const updated = { ...prev, studySessions: nextSessions };
        if (prev.profile?.userId) cacheWorkspaceLocally(prev.profile.userId, updated);
        return updated;
      });
      broadcastLocal('session:create', { session });
    },
    [broadcastLocal, cacheWorkspaceLocally]
  );

  const reconcileOptimisticSession = useCallback(
    (tempId: string, realSession: StudySession) => {
      setData((prev) => {
        if (!prev) return null;
        const filtered = prev.studySessions.filter(
          (s) =>
            s.id !== tempId &&
            s.id !== realSession.id &&
            !(realSession.idempotencyKey && s.idempotencyKey === realSession.idempotencyKey)
        );
        const nextSessions = [realSession, ...filtered].sort(
          (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );
        const updated = { ...prev, studySessions: nextSessions };
        if (prev.profile?.userId) cacheWorkspaceLocally(prev.profile.userId, updated);
        return updated;
      });
      broadcastLocal('session:create', { session: realSession });
    },
    [broadcastLocal, cacheWorkspaceLocally]
  );

  const removeOptimisticSession = useCallback(
    (tempId: string) => {
      setData((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          studySessions: prev.studySessions.filter((s) => s.id !== tempId),
        };
        if (prev.profile?.userId) cacheWorkspaceLocally(prev.profile.userId, updated);
        return updated;
      });
      broadcastLocal('session:delete', { sessionId: tempId });
    },
    [broadcastLocal, cacheWorkspaceLocally]
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

  // 0ms instant optimistic theme switching
  const setThemePreference = useCallback(
    (nextTheme: 'light' | 'dark' | 'system') => {
      lastLocalThemeChangeRef.current = Date.now();

      // 1. Instant 0ms synchronous DOM manipulation
      applyThemeToDOM(nextTheme);

      // 2. Synchronous localStorage update
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('theme', nextTheme);
        } catch {}
      }

      // 3. Update next-themes hook state
      setThemeRef.current?.(nextTheme);

      // 4. Optimistically update local workspace React state in 0ms
      setData((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          profile: {
            ...prev.profile,
            themePreference: nextTheme,
          },
        };
        if (prev.profile?.userId) {
          cacheWorkspaceLocally(prev.profile.userId, updated);
        }
        return updated;
      });

      // 5. Broadcast to other open browser tabs
      broadcastLocal('profile:update', { profile: { themePreference: nextTheme } });

      // 6. Background cloud persist without blocking UI, toast, or spinner
      updateThemePreferenceAction(nextTheme, getClientDeviceId()).catch((err) => {
        console.warn('Failed to sync theme preference to cloud:', err);
      });
    },
    [broadcastLocal, cacheWorkspaceLocally]
  );

  // Update profile
  const updateProfile = useCallback(
    async (payload: Partial<Profile>) => {
      if (payload.themePreference) {
        const nextTheme = payload.themePreference as 'light' | 'dark' | 'system';
        lastLocalThemeChangeRef.current = Date.now();
        applyThemeToDOM(nextTheme);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('theme', nextTheme);
          } catch {}
        }
        setThemeRef.current?.(nextTheme);
      }
      setData((prev) =>
        prev ? { ...prev, profile: { ...prev.profile, ...payload } } : null
      );

      const res = await updateProfileAction({
        ...payload,
        clientDeviceId: getClientDeviceId(),
      });
      if (res.success && res.profile) {
        setData((prev) =>
          prev ? { ...prev, profile: res.profile as Profile } : null
        );
        broadcastLocal('profile:update', { profile: res.profile });
        addToast({
          title: 'Profile Updated',
          description: 'Your study preferences were saved.',
          variant: 'success',
        });
      }
    },
    [addToast, broadcastLocal]
  );

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
    const prevSnapshot = dataRef.current;
    pendingDeletedIdsRef.current.add(id);
    // 0ms optimistic removal (subject + cascaded sessions/tasks/schedules/goals)
    setData((prev) => {
      if (!prev) return null;
      const updated = {
        ...prev,
        subjects: prev.subjects.filter((s) => s.id !== id),
        studySessions: prev.studySessions.filter((s) => s.subjectId !== id),
        tasks: prev.tasks.filter((t) => t.subjectId !== id),
        schedules: prev.schedules.filter((s) => s.subjectId !== id),
        goals: prev.goals.filter((g) => g.subjectId !== id),
      };
      if (prev.profile?.userId) cacheWorkspaceLocally(prev.profile.userId, updated);
      return updated;
    });
    broadcastLocal('subject:delete', { subjectId: id });
    addToast({ title: 'Subject Deleted', description: 'Subject and its records removed.', variant: 'default' });

    deleteSubjectAction(id, getClientDeviceId())
      .then(() => {
        pendingDeletedIdsRef.current.delete(id);
        refreshWorkspace({ silent: true, preserveLocalTimer: true }).catch(() => {});
      })
      .catch((err) => {
        pendingDeletedIdsRef.current.delete(id);
        console.error('Failed to delete subject:', err);
        if (prevSnapshot) {
          setData(prevSnapshot);
          if (prevSnapshot.profile?.userId) {
            cacheWorkspaceLocally(prevSnapshot.profile.userId, prevSnapshot);
          }
        }
        addToast({
          title: 'Failed to Delete Subject',
          description: err?.message || 'Could not delete subject. Changes restored.',
          variant: 'error',
        });
      });
  }, [addToast, broadcastLocal, cacheWorkspaceLocally, refreshWorkspace]);

  // Study Sessions CRUD (0ms Optimistic UI + Background Reconciliation)
  const createSession = useCallback(async (payload: any) => {
    const nowIso = new Date().toISOString();
    const startMs = new Date(payload.startTime).getTime();
    const endMs = new Date(payload.endTime).getTime();
    const durationSeconds =
      payload.durationSeconds || Math.max(1, Math.round((endMs - startMs) / 1000));
    const idempotencyKey =
      payload.idempotencyKey || `manual_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const tempId = `optimistic_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const optimisticSession: StudySession = {
      id: tempId,
      userId: user?.uid || dataRef.current?.profile?.userId || '',
      subjectId: payload.subjectId,
      idempotencyKey,
      startTime: payload.startTime,
      endTime: payload.endTime,
      durationSeconds,
      topic: payload.topic?.trim() || 'Focused Study',
      notes: payload.notes || '',
      productivityRating: payload.productivityRating || 4,
      sessionType: payload.sessionType || 'manual',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    insertOptimisticSession(optimisticSession);

    try {
      const res = await createStudySessionAction({
        ...payload,
        durationSeconds,
        idempotencyKey,
        clientDeviceId: getClientDeviceId(),
      });
      if (!res.success || !res.session) throw new Error('Failed to save study session');
      const session = res.session as StudySession;
      reconcileOptimisticSession(tempId, session);
      addToast({ title: 'Session Saved', description: 'Study activity logged successfully.', variant: 'success' });
      refreshWorkspace({ silent: true, preserveLocalTimer: true }).catch(() => {});
      return session;
    } catch (err) {
      removeOptimisticSession(tempId);
      throw err;
    }
  }, [
    user?.uid,
    addToast,
    refreshWorkspace,
    insertOptimisticSession,
    reconcileOptimisticSession,
    removeOptimisticSession,
  ]);

  const updateSession = useCallback(async (id: string, payload: any) => {
    const prevSession = dataRef.current?.studySessions.find((s) => s.id === id);
    if (prevSession) {
      const nextStart = payload.startTime ?? prevSession.startTime;
      const nextEnd = payload.endTime ?? prevSession.endTime;
      const nextDuration =
        payload.durationSeconds ??
        Math.max(1, Math.round((new Date(nextEnd).getTime() - new Date(nextStart).getTime()) / 1000));
      const optimisticUpdated: StudySession = {
        ...prevSession,
        ...payload,
        durationSeconds: nextDuration,
        updatedAt: new Date().toISOString(),
      };
      setData((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          studySessions: prev.studySessions
            .map((s) => (s.id === id ? optimisticUpdated : s))
            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
        };
        if (prev.profile?.userId) cacheWorkspaceLocally(prev.profile.userId, updated);
        return updated;
      });
      broadcastLocal('session:update', { session: optimisticUpdated });
    }

    try {
      const res = await updateStudySessionAction(id, { ...payload, clientDeviceId: getClientDeviceId() });
      if (!res.success || !res.session) throw new Error('Failed to update session');
      const session = res.session as StudySession;
      setData((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          studySessions: prev.studySessions
            .map((s) => (s.id === id ? session : s))
            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
        };
        if (prev.profile?.userId) cacheWorkspaceLocally(prev.profile.userId, updated);
        return updated;
      });
      broadcastLocal('session:update', { session });
      addToast({ title: 'Session Updated', description: 'Session details modified.', variant: 'success' });
      refreshWorkspace({ silent: true, preserveLocalTimer: true }).catch(() => {});
      return session;
    } catch (err) {
      if (prevSession) {
        setData((prev) => {
          if (!prev) return null;
          const updated = {
            ...prev,
            studySessions: prev.studySessions
              .map((s) => (s.id === id ? prevSession : s))
              .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
          };
          if (prev.profile?.userId) cacheWorkspaceLocally(prev.profile.userId, updated);
          return updated;
        });
        broadcastLocal('session:update', { session: prevSession });
      }
      throw err;
    }
  }, [addToast, refreshWorkspace, broadcastLocal, cacheWorkspaceLocally]);

  const deleteSession = useCallback(async (id: string) => {
    const prevSession = dataRef.current?.studySessions.find((s) => s.id === id);
    pendingDeletedIdsRef.current.add(id);

    // 1. Instant 0ms optimistic state removal
    setData((prev) => {
      if (!prev) return null;
      const updated = {
        ...prev,
        studySessions: prev.studySessions.filter((s) => s.id !== id),
      };
      if (prev.profile?.userId) cacheWorkspaceLocally(prev.profile.userId, updated);
      return updated;
    });
    broadcastLocal('session:delete', { sessionId: id });
    addToast({ title: 'Session Deleted', description: 'Session was removed from log.', variant: 'default' });

    // If this was an unsynced optimistic session, skip server call
    if (String(id).startsWith('optimistic_')) {
      pendingDeletedIdsRef.current.delete(id);
      return;
    }

    // 2. Non-blocking background server deletion + silent goal reconciliation
    deleteStudySessionAction(id, getClientDeviceId())
      .then(() => {
        pendingDeletedIdsRef.current.delete(id);
        refreshWorkspace({ silent: true, preserveLocalTimer: true }).catch(() => {});
      })
      .catch((err) => {
        console.error('Failed to delete study session:', err);
        pendingDeletedIdsRef.current.delete(id);
        if (prevSession) {
          setData((prev) => {
            if (!prev) return null;
            if (prev.studySessions.some((s) => s.id === prevSession.id)) return prev;
            const restored = [prevSession, ...prev.studySessions].sort(
              (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
            );
            const updated = { ...prev, studySessions: restored };
            if (prev.profile?.userId) cacheWorkspaceLocally(prev.profile.userId, updated);
            return updated;
          });
          broadcastLocal('session:create', { session: prevSession });
        }
        addToast({
          title: 'Failed to Delete Session',
          description: err?.message || 'Network error while deleting session. Entry restored.',
          variant: 'error',
        });
      });
  }, [addToast, refreshWorkspace, broadcastLocal, cacheWorkspaceLocally]);

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
    const prevTask = dataRef.current?.tasks.find((t) => t.id === id);
    if (prevTask) {
      const optimisticTask: TaskItem = {
        ...prevTask,
        ...payload,
        completedAt:
          payload.status === 'completed'
            ? new Date().toISOString()
            : payload.status === 'pending' || payload.status === 'in_progress'
              ? null
              : prevTask.completedAt,
        updatedAt: new Date().toISOString(),
      };
      setData((prev) =>
        prev
          ? {
              ...prev,
              tasks: prev.tasks.map((t) => (t.id === id ? optimisticTask : t)),
            }
          : null
      );
      broadcastLocal('task:update', { task: optimisticTask });
    }

    try {
      const res = await updateTaskAction(id, { ...payload, clientDeviceId: getClientDeviceId() });
      if (!res.success || !res.task) throw new Error('Failed to update task');
      const task = res.task as unknown as TaskItem;
      setData((prev) =>
        prev
          ? {
              ...prev,
              tasks: prev.tasks.map((t) => (t.id === id ? task : t)),
            }
          : null
      );
      broadcastLocal('task:update', { task });
      return task;
    } catch (err) {
      if (prevTask) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                tasks: prev.tasks.map((t) => (t.id === id ? prevTask : t)),
              }
            : null
        );
        broadcastLocal('task:update', { task: prevTask });
      }
      throw err;
    }
  }, [broadcastLocal]);

  const deleteTask = useCallback(async (id: string) => {
    const prevTask = dataRef.current?.tasks.find((t) => t.id === id);
    pendingDeletedIdsRef.current.add(id);
    setData((prev) => prev ? {
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== id),
    } : null);
    broadcastLocal('task:delete', { taskId: id });
    addToast({ title: 'Task Deleted', description: 'Task removed.', variant: 'default' });

    deleteTaskAction(id, getClientDeviceId())
      .then(() => {
        pendingDeletedIdsRef.current.delete(id);
      })
      .catch((err) => {
        pendingDeletedIdsRef.current.delete(id);
        console.error('Failed to delete task:', err);
        if (prevTask) {
          setData((prev) =>
            prev && !prev.tasks.some((t) => t.id === prevTask.id)
              ? { ...prev, tasks: [...prev.tasks, prevTask] }
              : prev
          );
          broadcastLocal('task:create', { task: prevTask });
        }
        addToast({
          title: 'Failed to Delete Task',
          description: 'Network error while deleting task. Entry restored.',
          variant: 'error',
        });
      });
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
    const prevSchedule = dataRef.current?.schedules.find((s) => s.id === id);
    pendingDeletedIdsRef.current.add(id);
    setData((prev) => prev ? {
      ...prev,
      schedules: prev.schedules.filter((s) => s.id !== id),
    } : null);
    broadcastLocal('schedule:delete', { scheduleId: id });
    addToast({ title: 'Schedule Removed', description: 'Time slot deleted.', variant: 'default' });

    deleteScheduleAction(id, getClientDeviceId())
      .then(() => {
        pendingDeletedIdsRef.current.delete(id);
      })
      .catch((err) => {
        pendingDeletedIdsRef.current.delete(id);
        console.error('Failed to delete schedule:', err);
        if (prevSchedule) {
          setData((prev) =>
            prev && !prev.schedules.some((s) => s.id === prevSchedule.id)
              ? { ...prev, schedules: [...prev.schedules, prevSchedule] }
              : prev
          );
          broadcastLocal('schedule:create', { schedule: prevSchedule });
        }
        addToast({
          title: 'Failed to Delete Schedule',
          description: 'Network error while deleting time slot. Entry restored.',
          variant: 'error',
        });
      });
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
    const prevGoal = dataRef.current?.goals.find((g) => g.id === id);
    pendingDeletedIdsRef.current.add(id);
    setData((prev) => prev ? {
      ...prev,
      goals: prev.goals.filter((g) => g.id !== id),
    } : null);
    broadcastLocal('goal:delete', { goalId: id });
    addToast({ title: 'Goal Removed', description: 'Goal deleted.', variant: 'default' });

    deleteGoalAction(id, getClientDeviceId())
      .then(() => {
        pendingDeletedIdsRef.current.delete(id);
      })
      .catch((err) => {
        pendingDeletedIdsRef.current.delete(id);
        console.error('Failed to delete goal:', err);
        if (prevGoal) {
          setData((prev) =>
            prev && !prev.goals.some((g) => g.id === prevGoal.id)
              ? { ...prev, goals: [...prev.goals, prevGoal] }
              : prev
          );
          broadcastLocal('goal:create', { goal: prevGoal });
        }
        addToast({
          title: 'Failed to Delete Goal',
          description: 'Network error while deleting goal. Entry restored.',
          variant: 'error',
        });
      });
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
    if (user && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`scholarpulse_cache_${user.uid}`);
        localStorage.removeItem(`scholarpulse_timer_${user.uid}`);
      } catch {}
    }
    setUser(null);
    setData(null);
    setActiveTimer(null);
    setRevisionData(null);
    try {
      await deleteAccountAction();
      await signOutAction();
    } catch (e) {
      console.error('Delete account error:', e);
    }
    if (typeof window !== 'undefined') {
      window.location.replace('/');
    }
  }, [user]);

  const signOut = useCallback(async () => {
    if (user && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`scholarpulse_cache_${user.uid}`);
        localStorage.removeItem(`scholarpulse_timer_${user.uid}`);
      } catch {}
    }
    setUser(null);
    setData(null);
    setActiveTimer(null);
    setRevisionData(null);
    try {
      await signOutAction();
    } catch (e) {
      console.error('Sign out error:', e);
    }
    if (typeof window !== 'undefined') {
      window.location.replace('/');
    }
  }, [user]);

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
    const nowYmd = opts.activityDate || new Date().toISOString().slice(0, 10);
    const prevRecords = revisionCacheRef.current?.records || revisionData?.records || [];
    const prevRecord = prevRecords.find(
      (r) => r.topicId === opts.topicId && r.category === opts.category
    );
    const wasCompleted = prevRecord?.isCompleted ?? false;

    // 1. Instant 0ms optimistic record
    const optimisticRecord: RevisionRecord = {
      id: prevRecord?.id || `temp_${Date.now()}`,
      userId: user?.uid || 'current',
      subjectId: opts.subjectId,
      topicId: opts.topicId,
      category: opts.category,
      activityDate: nowYmd,
      isCompleted: opts.isCompleted,
      bookName: prevRecord?.bookName,
      pagesRead: prevRecord?.pagesRead,
      questionsSolved: prevRecord?.questionsSolved,
      correctCount: prevRecord?.correctCount,
      notes: opts.notes !== undefined ? opts.notes : prevRecord?.notes,
      createdAt: prevRecord?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 2. Instantly update context cache and state
    setRevisionData((prev) => {
      if (!prev) return null;
      const filtered = prev.records.filter(
        (r) => !(r.topicId === opts.topicId && r.category === opts.category)
      );
      const nextRecords = opts.isCompleted ? [...filtered, optimisticRecord] : filtered;
      const updated = { ...prev, records: nextRecords };
      revisionCacheRef.current = updated;
      return updated;
    });

    // 3. Instantly update gamification XP
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

    // 4. Background server sync
    try {
      const res = await toggleRevisionAction({ ...opts, clientDeviceId: getClientDeviceId() });
      if (!res.success || !res.record) throw new Error('Failed to toggle revision');
      const rec = res.record as unknown as RevisionRecord;

      // Reconcile server record silently
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
    } catch (err) {
      // Rollback on network or server error
      setRevisionData((prev) => {
        if (!prev) return null;
        const filtered = prev.records.filter(
          (r) => !(r.topicId === opts.topicId && r.category === opts.category)
        );
        const nextRecords = wasCompleted && prevRecord ? [...filtered, prevRecord] : filtered;
        const updated = { ...prev, records: nextRecords };
        revisionCacheRef.current = updated;
        return updated;
      });
      if (xpDelta !== 0) {
        setData((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            profile: {
              ...prev.profile,
              gamificationXp: Math.max(0, (prev.profile.gamificationXp || 0) - xpDelta),
            },
          };
        });
      }
      throw err;
    }
  }, [user?.uid, revisionData?.records, broadcastLocal]);

  const saveDetailedRevision = useCallback(async (opts: any) => {
    const prevRecords = revisionCacheRef.current?.records || revisionData?.records || [];
    const prevRecord = prevRecords.find(
      (r) => r.id === opts.id || (r.topicId === opts.topicId && r.category === opts.category)
    );
    const wasCompleted = prevRecord?.isCompleted ?? false;
    const isCompleted = opts.isCompleted !== undefined ? opts.isCompleted : true;
    const nowYmd = opts.activityDate || new Date().toISOString().slice(0, 10);

    // 1. Optimistic record
    const optimisticRecord: RevisionRecord = {
      id: opts.id || prevRecord?.id || `temp_${Date.now()}`,
      userId: user?.uid || 'current',
      subjectId: opts.subjectId,
      topicId: opts.topicId,
      category: opts.category,
      activityDate: nowYmd,
      isCompleted,
      bookName: opts.bookName !== undefined ? opts.bookName : prevRecord?.bookName,
      pagesRead: opts.pagesRead !== undefined ? opts.pagesRead : prevRecord?.pagesRead,
      questionsSolved: opts.questionsSolved !== undefined ? opts.questionsSolved : prevRecord?.questionsSolved,
      correctCount: opts.correctCount !== undefined ? opts.correctCount : prevRecord?.correctCount,
      notes: opts.notes !== undefined ? opts.notes : prevRecord?.notes,
      createdAt: prevRecord?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 2. Instantly update context state
    setRevisionData((prev) => {
      if (!prev) return null;
      const filtered = prev.records.filter(
        (r) => !(r.topicId === opts.topicId && r.category === opts.category)
      );
      const nextRecords = isCompleted ? [...filtered, optimisticRecord] : filtered;
      const updated = { ...prev, records: nextRecords };
      revisionCacheRef.current = updated;
      return updated;
    });

    const xpDelta = !wasCompleted && isCompleted ? 25 : wasCompleted && !isCompleted ? -25 : 0;
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

    try {
      const res = await saveDetailedRevisionRecordAction({ ...opts, clientDeviceId: getClientDeviceId() });
      if (!res.success || !res.record) throw new Error('Failed to save detailed record');
      const rec = res.record as unknown as RevisionRecord;

      setRevisionData((prev) => {
        if (!prev) return null;
        const filtered = prev.records.filter(
          (r) => !(r.topicId === opts.topicId && r.category === opts.category)
        );
        const nextRecords = isCompleted ? [...filtered, rec] : filtered;
        const updated = { ...prev, records: nextRecords };
        revisionCacheRef.current = updated;
        return updated;
      });

      broadcastLocal('revision:detailed', { record: rec });
      return rec;
    } catch (err) {
      // Rollback
      setRevisionData((prev) => {
        if (!prev) return null;
        const filtered = prev.records.filter(
          (r) => !(r.topicId === opts.topicId && r.category === opts.category)
        );
        const nextRecords = wasCompleted && prevRecord ? [...filtered, prevRecord] : filtered;
        const updated = { ...prev, records: nextRecords };
        revisionCacheRef.current = updated;
        return updated;
      });
      if (xpDelta !== 0) {
        setData((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            profile: {
              ...prev.profile,
              gamificationXp: Math.max(0, (prev.profile.gamificationXp || 0) - xpDelta),
            },
          };
        });
      }
      throw err;
    }
  }, [user?.uid, revisionData?.records, broadcastLocal]);

  const deleteRevisionRecordItem = useCallback(async (recordId: string) => {
    const prevRecords = revisionCacheRef.current?.records || revisionData?.records || [];
    const existing = prevRecords.find((r) => r.id === recordId);

    // Optimistic delete
    setRevisionData((prev) => {
      if (!prev) return null;
      const nextRecords = prev.records.filter((r) => r.id !== recordId);
      const updated = { ...prev, records: nextRecords };
      revisionCacheRef.current = updated;
      return updated;
    });

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

    try {
      await deleteRevisionRecordAction(recordId, getClientDeviceId());
      broadcastLocal('revision:delete', { recordId });
    } catch (err) {
      // Rollback
      if (existing) {
        setRevisionData((prev) => {
          if (!prev) return null;
          const updated = { ...prev, records: [...prev.records, existing] };
          revisionCacheRef.current = updated;
          return updated;
        });
      }
      throw err;
    }
  }, [user?.uid, revisionData?.records, broadcastLocal]);

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
    insertOptimisticSession,
    reconcileOptimisticSession,
    removeOptimisticSession,
    refreshWorkspace,
    completeOnboarding,
    updateProfile,
    setThemePreference,
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
    insertOptimisticSession,
    reconcileOptimisticSession,
    removeOptimisticSession,
    refreshWorkspace,
    completeOnboarding,
    updateProfile,
    setThemePreference,
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
