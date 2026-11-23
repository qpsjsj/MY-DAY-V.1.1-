import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Check,
  FolderPlus,
  LayoutGrid,
  LogIn,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Settings,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import {
  AccentId,
  AiPlanProposal,
  AppTab,
  BuiltinWidgetId,
  CalendarViewMode,
  CustomWidget,
  CustomWidgetKind,
  DDayItem,
  DesignSettings,
  ExpenseItem,
  FontChoice,
  HabitItem,
  ImportanceLevel,
  LayoutStyle,
  NoteItem,
  PlannerState,
  PlannerWorkspace,
  RepeatRule,
  ScheduleEvent,
  ThemeId,
  TodoItem,
} from './types/planner';
import {
  addDaysYmd,
  detectScheduleConflicts,
  diffDaysYmd,
  formatDDayBadge,
  formatKoreanFullDate,
  formatKoreanMonthDay,
  formatScheduleTimeRange,
  formatTimeDisplay,
  getKstTodayString,
  getSchedulesForDate,
  isValidYmd,
} from './utils/dateKst';
import { getKoreanHoliday } from './utils/koreanHolidays';
import {
  ACCENT_OPTIONS,
  THEME_OPTIONS,
  createInitialPlannerState,
} from './utils/sampleData';
import { executeVerifiedAiProposal } from './utils/aiPlannerExecutor';
import {
  createBlankPlannerInWorkspace,
  deletePlannerInWorkspace,
  getActivePlannerRecord,
  hasMigratedGuestToUid,
  hasPlannerUserData,
  loadPendingSyncFlag,
  loadPlannerWorkspace,
  loadUserCachedWorkspace,
  markGuestMigratedToUid,
  renamePlannerInWorkspace,
  savePlannerWorkspace,
  saveUserCachedWorkspace,
  setPendingSyncFlag,
  switchActivePlannerInWorkspace,
  updateActivePlannerDataInWorkspace,
} from './utils/storage';
import {
  fetchUserCloudWorkspace,
  initializeUserCloudWorkspace,
  subscribeToUserCloudWorkspace,
  syncWorkspaceDiffToFirestore,
} from './utils/firestorePlannerSync';
import { useAuth } from './contexts/AuthContext';
import { isNetworkOrOfflineError, isPermissionDeniedError } from './firebase';
import { AuthModal } from './components/AuthModal';
import {
  CloudSaveStatus,
  SaveStatusIndicator,
  SidebarAccountCard,
} from './components/AccountControls';
import { WelcomeScreen } from './components/WelcomeScreen';
import { OnboardingFlow } from './components/OnboardingFlow';
import { AiPlannerBar } from './components/AiPlannerBar';
import { CalendarSection } from './components/CalendarSection';
import { ScheduleModal } from './components/ScheduleModal';
import { TodoWidget } from './components/widgets/TodoWidget';
import { HabitWidget } from './components/widgets/HabitWidget';
import { DDayWidget } from './components/widgets/DDayWidget';
import { FocusWidget } from './components/widgets/FocusWidget';
import { ExpenseWidget } from './components/widgets/ExpenseWidget';
import { NoteWidget } from './components/widgets/NoteWidget';
import {
  AiRecommendWidget,
  ChecklistWidget,
  RoutineWidget,
} from './components/widgets/RoutineAndChecklistWidgets';
import {
  CustomWidgetCard,
  NewCustomWidgetModal,
} from './components/widgets/CustomWidgetCard';
import { SettingsView } from './components/SettingsView';
import { WidgetOrderManager } from './components/WidgetOrderManager';
import { SiteFooter } from './components/SiteFooter';

export default function App() {
  const {
    user,
    authReady,
    emailVerified,
    signOutUser,
    resendVerificationEmail,
    refreshVerificationStatus,
  } = useAuth();

  const [workspace, setWorkspace] = useState<PlannerWorkspace>(() => loadPlannerWorkspace());
  const activePlanner = useMemo(() => getActivePlannerRecord(workspace), [workspace]);
  const state = activePlanner.data;
  const setState = (
    updater: PlannerState | ((prev: PlannerState) => PlannerState)
  ) => {
    setWorkspace((prevWs) =>
      updateActivePlannerDataInWorkspace(prevWs, (prevData) =>
        typeof updater === 'function' ? updater(prevData) : updater
      )
    );
  };

  // Cloud auth / save / sync state
  const [saveStatus, setSaveStatus] = useState<CloudSaveStatus>('guest');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const [cloudHydratedUid, setCloudHydratedUid] = useState<string | null>(null);
  const [guestDraftOfferAvailable, setGuestDraftOfferAvailable] = useState(false);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [authModalReason, setAuthModalReason] = useState<string | undefined>(undefined);

  const workspaceRef = useRef<PlannerWorkspace>(workspace);
  workspaceRef.current = workspace;
  const lastSyncedWorkspaceRef = useRef<PlannerWorkspace | null>(null);
  const isHydratingFromCloudRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const prevAuthUidRef = useRef<string | null>(null);
  const saveInProgressRef = useRef(false);

  const [undoSnapshot, setUndoSnapshot] = useState<PlannerState | null>(null);
  const [todayKst, setTodayKst] = useState<string>(() => getKstTodayString());
  const [selectedDate, setSelectedDate] = useState<string>(() => getKstTodayString());
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const saved = window.localStorage.getItem('myday_active_tab_v1');
    if (saved === 'dashboard' || saved === 'calendar' || saved === 'widgets' || saved === 'settings') {
      return saved;
    }
    return 'dashboard';
  });
  const [calendarView, setCalendarView] = useState<CalendarViewMode>(
    () => state.design.defaultView
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarConfirmDeleteId, setSidebarConfirmDeleteId] = useState<string | null>(null);
  const [sidebarRenamingId, setSidebarRenamingId] = useState<string | null>(null);
  const [sidebarRenameDraft, setSidebarRenameDraft] = useState('');
  const [plannerSwitchNotice, setPlannerSwitchNotice] = useState<string | null>(null);

  // Schedule Modal state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleModalDate, setScheduleModalDate] = useState(todayKst);
  const [scheduleStartTime, setScheduleStartTime] = useState<string | undefined>(undefined);
  const [scheduleEndTime, setScheduleEndTime] = useState<string | undefined>(undefined);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleEvent | null>(null);

  // Quick todo input in Selected Date Detail Panel
  const [quickDateTodoTitle, setQuickDateTodoTitle] = useState('');

  // New Custom Widget Modal
  const [customWidgetModalOpen, setCustomWidgetModalOpen] = useState(false);

  // Weekly goal inline editing
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(state.profile.weeklyGoal);

  // Dashboard inline widget visibility/order editor
  const [dashboardWidgetEditorOpen, setDashboardWidgetEditorOpen] = useState(false);

  const persistLocalForCurrentSession = useCallback(
    (ws: PlannerWorkspace): boolean => {
      if (user?.uid) {
        return saveUserCachedWorkspace(user.uid, ws);
      }
      return savePlannerWorkspace(ws);
    },
    [user?.uid]
  );

  const openAuthModal = useCallback(
    (mode: 'login' | 'signup' = 'login', reason?: string) => {
      setAuthModalMode(mode);
      setAuthModalReason(reason);
      setAuthModalOpen(true);
    },
    []
  );

  const formatSavedClock = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const flushSaveToCloud = useCallback(
    async (targetWs?: PlannerWorkspace): Promise<boolean> => {
      if (!user) return false;
      const wsToSave = targetWs ?? workspaceRef.current;
      saveUserCachedWorkspace(user.uid, wsToSave);

      if (!user.emailVerified) {
        setPendingSyncFlag(user.uid, true);
        setSaveStatus('unverified');
        setSaveErrorMsg(
          '이메일 인증을 완료해야 클라우드에 저장됩니다. 작성하신 내용은 이 기기에 임시 보관 중입니다.'
        );
        return false;
      }

      if (saveInProgressRef.current) {
        return false;
      }

      saveInProgressRef.current = true;
      setSaveStatus('saving');
      setSaveErrorMsg(null);

      try {
        const userInfo = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
        };
        const synced = lastSyncedWorkspaceRef.current
          ? await syncWorkspaceDiffToFirestore(
              userInfo,
              wsToSave,
              lastSyncedWorkspaceRef.current
            )
          : await initializeUserCloudWorkspace(userInfo, wsToSave);

        lastSyncedWorkspaceRef.current = synced;
        setPendingSyncFlag(user.uid, false);
        setSaveStatus('saved');
        setLastSavedAt(formatSavedClock());
        setSaveErrorMsg(null);
        return true;
      } catch (err) {
        setPendingSyncFlag(user.uid, true);
        if (isPermissionDeniedError(err) && !user.emailVerified) {
          setSaveStatus('unverified');
          setSaveErrorMsg('이메일 인증 후 클라우드에 저장할 수 있습니다.');
        } else if (isNetworkOrOfflineError(err)) {
          setSaveStatus('error');
          setSaveErrorMsg(
            '네트워크 연결이 불안정해 클라우드에 저장하지 못했습니다. 변경 사항은 이 기기에 임시 보관되었습니다.'
          );
        } else {
          setSaveStatus('error');
          setSaveErrorMsg(
            '클라우드 저장 중 오류가 발생했습니다. 데이터는 이 기기에 안전하게 보관 중이니 다시 시도해 주세요.'
          );
        }
        return false;
      } finally {
        saveInProgressRef.current = false;
      }
    },
    [user]
  );

  const handleManualSave = useCallback(async () => {
    if (!user) {
      openAuthModal(
        'login',
        '개인 플래너와 일정을 계정에 안전하게 저장하고 다른 기기에서도 불러오려면 로그인해 주세요. 현재 작성 중인 내용은 로그인 후 그대로 저장할 수 있습니다.'
      );
      return;
    }
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!user.emailVerified) {
      try {
        await refreshVerificationStatus();
      } catch {
        // Ignore refresh error; handled by flushSaveToCloud
      }
    }
    await flushSaveToCloud();
  }, [user, openAuthModal, refreshVerificationStatus, flushSaveToCloud]);

  const handleLogout = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (user?.uid && user.emailVerified && loadPendingSyncFlag(user.uid)) {
      await flushSaveToCloud().catch(() => false);
    }
    await signOutUser();
    setCloudHydratedUid(null);
    lastSyncedWorkspaceRef.current = null;
    setGuestDraftOfferAvailable(false);
    setSaveErrorMsg(null);
    setLastSavedAt(null);
    setSaveStatus('guest');
  }, [user, flushSaveToCloud, signOutUser]);

  // Hydrate user workspace from Cloud Firestore on auth change (strict UID isolation)
  useEffect(() => {
    if (!authReady) return;

    const currentUid = user?.uid ?? null;
    const prevUid = prevAuthUidRef.current;

    if (!currentUid) {
      prevAuthUidRef.current = null;
      setCloudHydratedUid(null);
      lastSyncedWorkspaceRef.current = null;
      setGuestDraftOfferAvailable(false);
      setSaveStatus('guest');
      setSaveErrorMsg(null);
      if (prevUid !== null) {
        const guestWs = loadPlannerWorkspace();
        isHydratingFromCloudRef.current = true;
        setWorkspace(guestWs);
        const activeRec = getActivePlannerRecord(guestWs);
        setCalendarView(activeRec.data.design.defaultView);
        setGoalDraft(activeRec.data.profile.weeklyGoal);
      }
      return;
    }

    if (prevUid === currentUid && cloudHydratedUid === currentUid) {
      return;
    }

    let cancelled = false;
    prevAuthUidRef.current = currentUid;
    setSaveStatus('loading');
    setSaveErrorMsg(null);

    const hydrate = async () => {
      const cachedWs = loadUserCachedWorkspace(currentUid);
      const hasPending = loadPendingSyncFlag(currentUid);
      if (hasPending && cachedWs) {
        isHydratingFromCloudRef.current = true;
        setWorkspace(cachedWs);
        const activeRec = getActivePlannerRecord(cachedWs);
        setCalendarView(activeRec.data.design.defaultView);
        setGoalDraft(activeRec.data.profile.weeklyGoal);
      }

      try {
        const cloudRes = await fetchUserCloudWorkspace(currentUid);
        if (cancelled) return;

        if (cloudRes.exists && cloudRes.workspace) {
          if (hasPending && cachedWs) {
            lastSyncedWorkspaceRef.current = cloudRes.workspace;
            setCloudHydratedUid(currentUid);
            if (user?.emailVerified) {
              await flushSaveToCloud(cachedWs);
            } else {
              setSaveStatus('unverified');
            }
          } else {
            isHydratingFromCloudRef.current = true;
            setWorkspace(cloudRes.workspace);
            saveUserCachedWorkspace(currentUid, cloudRes.workspace);
            lastSyncedWorkspaceRef.current = cloudRes.workspace;
            const activeRec = getActivePlannerRecord(cloudRes.workspace);
            setCalendarView(activeRec.data.design.defaultView);
            setGoalDraft(activeRec.data.profile.weeklyGoal);
            setCloudHydratedUid(currentUid);
            setSaveStatus('saved');
            setLastSavedAt(formatSavedClock());

            // Check if unmigrated guest draft exists locally so we never silently discard it
            if (!hasMigratedGuestToUid(currentUid)) {
              const guestWs = loadPlannerWorkspace();
              if (guestWs.planners.some((p) => hasPlannerUserData(p.data))) {
                setGuestDraftOfferAvailable(true);
              }
            }
          }
        } else {
          // Brand new cloud account: preserve existing local guest data if present
          const guestWs = loadPlannerWorkspace();
          const guestHasData =
            Boolean(guestWs.hasOpenedApp) ||
            guestWs.planners.length > 1 ||
            guestWs.planners.some((p) => hasPlannerUserData(p.data));

          const initialWs =
            cachedWs && (hasPending || cachedWs.planners.some((p) => hasPlannerUserData(p.data)))
              ? cachedWs
              : guestHasData
              ? guestWs
              : guestWs;

          const activeWs: PlannerWorkspace = {
            ...initialWs,
            stage: initialWs.stage === 'welcome' && guestHasData ? 'app' : initialWs.stage,
          };

          isHydratingFromCloudRef.current = true;
          setWorkspace(activeWs);
          saveUserCachedWorkspace(currentUid, activeWs);
          const activeRec = getActivePlannerRecord(activeWs);
          setCalendarView(activeRec.data.design.defaultView);
          setGoalDraft(activeRec.data.profile.weeklyGoal);
          setCloudHydratedUid(currentUid);

          if (user?.emailVerified) {
            const synced = await initializeUserCloudWorkspace(
              {
                uid: currentUid,
                email: user.email || '',
                displayName: user.displayName || '',
              },
              activeWs
            );
            if (cancelled) return;
            lastSyncedWorkspaceRef.current = synced;
            setPendingSyncFlag(currentUid, false);
            markGuestMigratedToUid(currentUid);
            setSaveStatus('saved');
            setLastSavedAt(formatSavedClock());
          } else {
            lastSyncedWorkspaceRef.current = null;
            setPendingSyncFlag(currentUid, true);
            setSaveStatus('unverified');
            setSaveErrorMsg(
              '이메일 인증을 완료하시면 현재 플래너가 계정에 자동 저장됩니다.'
            );
          }
        }
      } catch (err) {
        if (cancelled) return;
        setCloudHydratedUid(currentUid);
        if (cachedWs) {
          isHydratingFromCloudRef.current = true;
          setWorkspace(cachedWs);
        }
        setSaveStatus('error');
        setSaveErrorMsg(
          isNetworkOrOfflineError(err)
            ? '오프라인 상태이거나 네트워크가 불안정합니다. 기기에 저장된 내용으로 계속 사용할 수 있습니다.'
            : '클라우드에서 플래너를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'
        );
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [authReady, user?.uid, user?.email, user?.displayName, user?.emailVerified, cloudHydratedUid, flushSaveToCloud]);

  // If user becomes verified after signup, automatically flush pending workspace
  useEffect(() => {
    if (
      authReady &&
      user &&
      emailVerified &&
      cloudHydratedUid === user.uid &&
      loadPendingSyncFlag(user.uid)
    ) {
      void flushSaveToCloud();
    }
  }, [authReady, user, emailVerified, cloudHydratedUid, flushSaveToCloud]);

  // Real-time remote sync across devices when authenticated and no local pending writes
  useEffect(() => {
    if (!authReady || !user || cloudHydratedUid !== user.uid) return;
    const unsubscribe = subscribeToUserCloudWorkspace(
      user.uid,
      (remoteWs) => {
        if (loadPendingSyncFlag(user.uid) || saveInProgressRef.current) {
          return;
        }
        if (JSON.stringify(remoteWs) === JSON.stringify(workspaceRef.current)) {
          return;
        }
        isHydratingFromCloudRef.current = true;
        setWorkspace(remoteWs);
        saveUserCachedWorkspace(user.uid, remoteWs);
        lastSyncedWorkspaceRef.current = remoteWs;
        const activeRec = getActivePlannerRecord(remoteWs);
        setCalendarView(activeRec.data.design.defaultView);
        setGoalDraft(activeRec.data.profile.weeklyGoal);
        setSaveStatus('saved');
      },
      (err) => {
        if (!isNetworkOrOfflineError(err)) {
          console.error('Firestore subscription warning:', err);
        }
      }
    );
    return () => unsubscribe();
  }, [authReady, user, cloudHydratedUid]);

  // Auto-retry pending cloud save when network connectivity recovers
  useEffect(() => {
    if (!user) return;
    const onOnline = () => {
      if (loadPendingSyncFlag(user.uid) && user.emailVerified) {
        void flushSaveToCloud();
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [user, flushSaveToCloud]);

  // Persist locally & schedule debounced auto-save to Firestore (1,000ms)
  useEffect(() => {
    if (!user) {
      savePlannerWorkspace(workspace);
      setSaveStatus('guest');
      return;
    }

    saveUserCachedWorkspace(user.uid, workspace);

    if (isHydratingFromCloudRef.current) {
      isHydratingFromCloudRef.current = false;
      return;
    }

    if (cloudHydratedUid !== user.uid) {
      return;
    }

    setPendingSyncFlag(user.uid, true);

    if (!emailVerified) {
      setSaveStatus('unverified');
      return;
    }

    setSaveStatus('pending');
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void flushSaveToCloud();
    }, 1000);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [workspace, user, emailVerified, cloudHydratedUid, flushSaveToCloud]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('myday_active_tab_v1', activeTab);
    }
  }, [activeTab]);

  // Keep todayKst fresh across midnight KST or when returning to tab
  useEffect(() => {
    const syncToday = () => {
      const current = getKstTodayString();
      setTodayKst((prev) => (prev === current ? prev : current));
    };
    const interval = window.setInterval(syncToday, 60_000);
    const onVisChange = () => {
      if (document.visibilityState === 'visible') {
        syncToday();
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, []);

  const handleChangeCalendarView = (mode: CalendarViewMode) => {
    setCalendarView(mode);
    setState((prev) => ({
      ...prev,
      design: { ...prev.design, defaultView: mode },
    }));
  };

  // Apply theme, accent CSS variables, dark class, and font class on document root
  useEffect(() => {
    const root = document.documentElement;
    const themeClasses = [
      'theme-cream',
      'theme-white',
      'theme-sage',
      'theme-lavender',
      'theme-pastel',
      'theme-monotone',
      'theme-dark',
    ];
    root.classList.remove(...themeClasses);
    root.classList.add(`theme-${state.design.theme}`);

    if (state.design.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    const fontClasses = [
      'font-planner-sans',
      'font-planner-rounded',
      'font-planner-serif',
      'font-planner-mono',
    ];
    root.classList.remove(...fontClasses);
    root.classList.add(`font-planner-${state.design.font}`);

    const accentObj =
      ACCENT_OPTIONS.find((a) => a.id === state.design.accent) ?? ACCENT_OPTIONS[0];
    root.style.setProperty('--accent-primary', accentObj.primary);
    root.style.setProperty('--accent-soft', accentObj.soft);
    root.style.setProperty('--accent-contrast', accentObj.contrast);
  }, [state.design.theme, state.design.accent, state.design.font]);

  // Derived today/selected stats
  const selectedDaySchedules = useMemo(
    () => getSchedulesForDate(state.schedules, selectedDate),
    [state.schedules, selectedDate]
  );
  const selectedDayTodos = useMemo(
    () => state.todos.filter((t) => t.dueDate === selectedDate),
    [state.todos, selectedDate]
  );
  const todaySchedules = useMemo(
    () => getSchedulesForDate(state.schedules, todayKst),
    [state.schedules, todayKst]
  );
  const todayTodos = useMemo(
    () => state.todos.filter((t) => t.dueDate === todayKst),
    [state.todos, todayKst]
  );
  const selectedDayHoliday = useMemo(
    () => getKoreanHoliday(selectedDate),
    [selectedDate]
  );

  // Weekly goal achievement rate calculated from todos + habits
  const weeklyCompletionRate = useMemo(() => {
    const totalTodos = state.todos.length;
    const completedTodos = state.todos.filter((t) => t.completed).length;
    const totalHabitTargets = state.habits.length;
    const habitsDoneToday = state.habits.filter((h) =>
      h.completedDates.includes(todayKst)
    ).length;

    const totalItems = totalTodos + totalHabitTargets;
    if (totalItems === 0) return 0;
    return Math.round(((completedTodos + habitsDoneToday) / totalItems) * 100);
  }, [state.todos, state.habits, todayKst]);

  const upcomingDDays = useMemo(() => {
    return [...state.ddays]
      .filter((d) => diffDaysYmd(d.targetDate, todayKst) >= 0)
      .sort(
        (a, b) =>
          diffDaysYmd(a.targetDate, todayKst) - diffDaysYmd(b.targetDate, todayKst)
      )
      .slice(0, 3);
  }, [state.ddays, todayKst]);

  const upcomingSchedules = useMemo(() => {
    const list: Array<{ ymd: string; event: ScheduleEvent }> = [];
    for (let i = 0; i <= 5; i++) {
      const ymd = addDaysYmd(todayKst, i);
      const evs = getSchedulesForDate(state.schedules, ymd);
      for (const ev of evs) {
        list.push({ ymd, event: ev });
      }
    }
    return list.slice(0, 4);
  }, [state.schedules, todayKst]);

  const handleCreateBlankPlanner = (options?: {
    reuseUnusedInitial?: boolean;
    name?: string;
    patchData?: (fresh: PlannerState) => PlannerState;
  }) => {
    const { nextWorkspace, newPlanner } = createBlankPlannerInWorkspace(workspace, options);
    persistLocalForCurrentSession(nextWorkspace);
    setWorkspace(nextWorkspace);
    setSelectedDate(todayKst);
    setCalendarView(newPlanner.data.design.defaultView);
    setUndoSnapshot(null);
    setEditingGoal(false);
    setGoalDraft(newPlanner.data.profile.weeklyGoal);
    setScheduleModalOpen(false);
    setMobileMenuOpen(false);
    setQuickDateTodoTitle('');
    setSidebarConfirmDeleteId(null);
    setSidebarRenamingId(null);
    setPlannerSwitchNotice(null);
  };

  const handleSwitchPlanner = (plannerId: string) => {
    const target = workspace.planners.find((p) => p.plannerId === plannerId);
    if (!target) return;
    const nextWs = switchActivePlannerInWorkspace(workspace, plannerId);
    persistLocalForCurrentSession(nextWs);
    setWorkspace(nextWs);
    setSelectedDate(todayKst);
    setCalendarView(target.data.design.defaultView);
    setUndoSnapshot(null);
    setEditingGoal(false);
    setGoalDraft(target.data.profile.weeklyGoal);
    setScheduleModalOpen(false);
    setMobileMenuOpen(false);
    setQuickDateTodoTitle('');
    setSidebarConfirmDeleteId(null);
    setSidebarRenamingId(null);
    setPlannerSwitchNotice(null);
  };

  const handleRenamePlanner = (plannerId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setPlannerSwitchNotice('플래너 이름을 한 글자 이상 입력해 주세요.');
      return;
    }
    const nextWs = renamePlannerInWorkspace(workspace, plannerId, trimmed);
    persistLocalForCurrentSession(nextWs);
    setWorkspace(nextWs);
    setSidebarRenamingId(null);
    setPlannerSwitchNotice(null);
  };

  const handleDeletePlanner = (
    plannerId: string
  ): { ok: boolean; error?: string } => {
    const res = deletePlannerInWorkspace(workspace, plannerId);
    if (!res.ok) {
      setPlannerSwitchNotice(res.error);
      return { ok: false, error: res.error };
    }
    const nextActive = getActivePlannerRecord(res.nextWorkspace);
    persistLocalForCurrentSession(res.nextWorkspace);
    setWorkspace(res.nextWorkspace);
    if (workspace.activePlannerId === plannerId) {
      setSelectedDate(todayKst);
      setCalendarView(nextActive.data.design.defaultView);
      setUndoSnapshot(null);
      setEditingGoal(false);
      setGoalDraft(nextActive.data.profile.weeklyGoal);
      setScheduleModalOpen(false);
      setQuickDateTodoTitle('');
    }
    setSidebarConfirmDeleteId(null);
    setPlannerSwitchNotice(null);
    return { ok: true };
  };

  const handleImportGuestDraft = () => {
    if (!user) return;
    const guestWs = loadPlannerWorkspace();
    const candidate =
      guestWs.planners.find((p) => hasPlannerUserData(p.data)) ??
      getActivePlannerRecord(guestWs);
    handleCreateBlankPlanner({
      name: candidate.name ? `${candidate.name} (기기에서 가져옴)`.slice(0, 40) : '가져온 기존 플래너',
      patchData: () => ({ ...candidate.data, stage: 'app' }),
    });
    markGuestMigratedToUid(user.uid);
    setGuestDraftOfferAvailable(false);
  };

  // Apply AI operations strictly through verified application executor and verify persistence
  const handleApplyAiProposal = (
    proposal: AiPlanProposal
  ): {
    appliedCount: number;
    savedOk: boolean;
    touchedDates: string[];
    appliedSummaries: string[];
    warnings: string[];
    errors: string[];
  } => {
    const result = executeVerifiedAiProposal(state, proposal, {
      todayKst,
      selectedDate,
    });
    if (result.appliedCount === 0) {
      return {
        appliedCount: 0,
        savedOk: false,
        touchedDates: [],
        appliedSummaries: [],
        warnings: result.warnings,
        errors: result.errors,
      };
    }

    const nextWs = updateActivePlannerDataInWorkspace(workspace, () => result.nextState);
    const savedOk = persistLocalForCurrentSession(nextWs);
    if (!savedOk) {
      return {
        appliedCount: result.appliedCount,
        savedOk: false,
        touchedDates: result.touchedDates,
        appliedSummaries: [],
        warnings: result.warnings,
        errors: [
          ...result.errors,
          '브라우저 저장소(localStorage)에 저장하지 못해 일정 등록을 완료할 수 없습니다.',
        ],
      };
    }

    setUndoSnapshot(state);
    setWorkspace(nextWs);
    if (result.syncedDefaultView) {
      setCalendarView(result.syncedDefaultView);
    }
    if (result.touchedDates.length > 0) {
      setSelectedDate(result.touchedDates[0]);
      if (activeTab === 'widgets') {
        setActiveTab('dashboard');
      }
    }

    return {
      appliedCount: result.appliedCount,
      savedOk: true,
      touchedDates: result.touchedDates,
      appliedSummaries: result.appliedSummaries,
      warnings: result.warnings,
      errors: result.errors,
    };
  };

  const hasExistingPlanner =
    Boolean(workspace.hasOpenedApp) ||
    workspace.planners.length > 1 ||
    workspace.planners.some((p) => hasPlannerUserData(p.data));

  const authModalElement = (
    <AuthModal
      isOpen={authModalOpen}
      initialMode={authModalMode}
      reasonMessage={authModalReason}
      onClose={() => {
        setAuthModalOpen(false);
        setAuthModalReason(undefined);
      }}
    />
  );

  // Welcome stage
  if (workspace.stage === 'welcome') {
    return (
      <>
        <WelcomeScreen
          hasExistingPlanner={hasExistingPlanner}
          activePlannerName={activePlanner.name}
          user={user}
          authReady={authReady}
          onContinueExisting={() =>
            setWorkspace((prev) => ({ ...prev, stage: 'app', hasOpenedApp: true }))
          }
          onStartOnboarding={() =>
            setWorkspace((prev) => ({ ...prev, stage: 'onboarding' }))
          }
          onCreateBlankPlanner={() => {
            handleCreateBlankPlanner({ reuseUnusedInitial: true });
            setActiveTab('dashboard');
          }}
          onOpenAuth={openAuthModal}
          onLogout={handleLogout}
        />
        {authModalElement}
      </>
    );
  }

  // Onboarding stage
  if (workspace.stage === 'onboarding') {
    const freshDefaults = createInitialPlannerState(todayKst);
    const initialEnabledBuiltins = freshDefaults.widgets
      .filter((w) => w.type === 'builtin' && w.visible)
      .map((w) => w.id as BuiltinWidgetId);

    return (
      <>
        <OnboardingFlow
          initialProfile={freshDefaults.profile}
          initialDesign={freshDefaults.design}
          initialSelectedWidgets={initialEnabledBuiltins}
          onSkip={() => {
            if (hasExistingPlanner) {
              setWorkspace((prev) => ({ ...prev, stage: 'app', hasOpenedApp: true }));
            } else {
              handleCreateBlankPlanner({ reuseUnusedInitial: true });
              setActiveTab('dashboard');
            }
          }}
          onComplete={(profile, design, selectedWidgets) => {
            handleCreateBlankPlanner({
              reuseUnusedInitial: true,
              name: hasExistingPlanner ? '맞춤 플래너' : undefined,
              patchData: (fresh) => {
                const allBuiltinKeys: BuiltinWidgetId[] = [
                  'todos',
                  'dday',
                  'habits',
                  'focus',
                  'expenses',
                  'notes',
                  'routines',
                  'checklists',
                  'ai_recommend',
                ];
                const updatedBuiltinPlacements = allBuiltinKeys.map((id) => ({
                  id,
                  type: 'builtin' as const,
                  visible: selectedWidgets.includes(id),
                  size: (id === 'ai_recommend' ? 'wide' : 'compact') as 'wide' | 'compact',
                }));
                return {
                  ...fresh,
                  stage: 'app',
                  profile,
                  design,
                  widgets: updatedBuiltinPlacements,
                };
              },
            });
            setActiveTab('dashboard');
          }}
        />
        {authModalElement}
      </>
    );
  }

  // Render individual widget by placement
  const renderWidgetById = (id: string, type: 'builtin' | 'custom') => {
    if (type === 'custom') {
      const custom = state.customWidgets.find((c) => c.id === id);
      if (!custom) return null;
      return (
        <CustomWidgetCard
          widget={custom}
          onUpdateWidget={(updated) =>
            setState((prev) => ({
              ...prev,
              customWidgets: prev.customWidgets.map((c) =>
                c.id === updated.id ? updated : c
              ),
            }))
          }
          onDeleteWidget={(delId) =>
            setState((prev) => ({
              ...prev,
              customWidgets: prev.customWidgets.filter((c) => c.id !== delId),
              widgets: prev.widgets.filter((w) => w.id !== delId),
            }))
          }
        />
      );
    }

    switch (id as BuiltinWidgetId) {
      case 'todos':
        return (
          <TodoWidget
            todayKst={todayKst}
            selectedDate={selectedDate}
            todos={state.todos}
            onAddTodo={(todo) =>
              setState((prev) => ({ ...prev, todos: [todo, ...prev.todos] }))
            }
            onToggleTodo={(tid) =>
              setState((prev) => ({
                ...prev,
                todos: prev.todos.map((t) =>
                  t.id === tid ? { ...t, completed: !t.completed } : t
                ),
              }))
            }
            onDeleteTodo={(tid) =>
              setState((prev) => ({
                ...prev,
                todos: prev.todos.filter((t) => t.id !== tid),
              }))
            }
            onMoveUnfinishedToDate={(_from, targetDate) => {
              if (!isValidYmd(targetDate)) return;
              setState((prev) => ({
                ...prev,
                todos: prev.todos.map((t) =>
                  !t.completed ? { ...t, dueDate: targetDate } : t
                ),
              }));
            }}
          />
        );
      case 'habits':
        return (
          <HabitWidget
            todayKst={todayKst}
            habits={state.habits}
            onAddHabit={(habit) =>
              setState((prev) => ({ ...prev, habits: [...prev.habits, habit] }))
            }
            onUpdateHabit={(updated) =>
              setState((prev) => ({
                ...prev,
                habits: prev.habits.map((h) => (h.id === updated.id ? updated : h)),
              }))
            }
            onToggleHabitDate={(hid, dateYmd) =>
              setState((prev) => ({
                ...prev,
                habits: prev.habits.map((h) => {
                  if (h.id !== hid) return h;
                  const has = h.completedDates.includes(dateYmd);
                  return {
                    ...h,
                    completedDates: has
                      ? h.completedDates.filter((d) => d !== dateYmd)
                      : [...h.completedDates, dateYmd],
                  };
                }),
              }))
            }
            onDeleteHabit={(hid) =>
              setState((prev) => ({
                ...prev,
                habits: prev.habits.filter((h) => h.id !== hid),
              }))
            }
          />
        );
      case 'dday':
        return (
          <DDayWidget
            todayKst={todayKst}
            ddays={state.ddays}
            onAddDDay={(item) =>
              setState((prev) => ({ ...prev, ddays: [...prev.ddays, item] }))
            }
            onUpdateDDay={(updated) =>
              setState((prev) => ({
                ...prev,
                ddays: prev.ddays.map((d) => (d.id === updated.id ? updated : d)),
              }))
            }
            onDeleteDDay={(did) =>
              setState((prev) => ({
                ...prev,
                ddays: prev.ddays.filter((d) => d.id !== did),
              }))
            }
          />
        );
      case 'focus':
        return (
          <FocusWidget
            todayKst={todayKst}
            entries={state.focusEntries}
            onAddEntry={(entry) =>
              setState((prev) => ({
                ...prev,
                focusEntries: [...prev.focusEntries, entry],
              }))
            }
            onAddMinutes={(fid, minutes) =>
              setState((prev) => ({
                ...prev,
                focusEntries: prev.focusEntries.map((f) =>
                  f.id === fid
                    ? { ...f, actualMinutes: f.actualMinutes + minutes }
                    : f
                ),
              }))
            }
            onDeleteEntry={(fid) =>
              setState((prev) => ({
                ...prev,
                focusEntries: prev.focusEntries.filter((f) => f.id !== fid),
              }))
            }
          />
        );
      case 'expenses':
        return (
          <ExpenseWidget
            todayKst={todayKst}
            selectedDate={selectedDate}
            expenses={state.expenses}
            monthlyBudget={state.monthlyBudget}
            onUpdateMonthlyBudget={(budget) =>
              setState((prev) => ({ ...prev, monthlyBudget: budget }))
            }
            onAddExpense={(item) =>
              setState((prev) => ({
                ...prev,
                expenses: [item, ...prev.expenses],
              }))
            }
            onUpdateExpense={(updated) =>
              setState((prev) => ({
                ...prev,
                expenses: prev.expenses.map((e) =>
                  e.id === updated.id ? updated : e
                ),
              }))
            }
            onDeleteExpense={(eid) =>
              setState((prev) => ({
                ...prev,
                expenses: prev.expenses.filter((e) => e.id !== eid),
              }))
            }
          />
        );
      case 'notes':
        return (
          <NoteWidget
            selectedDate={selectedDate}
            notes={state.notes}
            onSaveNote={(note) =>
              setState((prev) => {
                const exists = prev.notes.some((n) => n.id === note.id);
                return {
                  ...prev,
                  notes: exists
                    ? prev.notes.map((n) => (n.id === note.id ? note : n))
                    : [note, ...prev.notes],
                };
              })
            }
            onDeleteNote={(nid) =>
              setState((prev) => ({
                ...prev,
                notes: prev.notes.filter((n) => n.id !== nid),
              }))
            }
          />
        );
      case 'routines':
        return (
          <RoutineWidget
            todayKst={todayKst}
            routines={state.routines}
            onAddRoutine={(item) =>
              setState((prev) => ({ ...prev, routines: [...prev.routines, item] }))
            }
            onToggleRoutineToday={(rid, dateYmd) =>
              setState((prev) => ({
                ...prev,
                routines: prev.routines.map((r) => {
                  if (r.id !== rid) return r;
                  const has = r.completedDates.includes(dateYmd);
                  return {
                    ...r,
                    completedDates: has
                      ? r.completedDates.filter((d) => d !== dateYmd)
                      : [...r.completedDates, dateYmd],
                  };
                }),
              }))
            }
            onDeleteRoutine={(rid) =>
              setState((prev) => ({
                ...prev,
                routines: prev.routines.filter((r) => r.id !== rid),
              }))
            }
          />
        );
      case 'checklists':
        return (
          <ChecklistWidget
            checklists={state.checklists}
            onAddChecklist={(item) =>
              setState((prev) => ({
                ...prev,
                checklists: [...prev.checklists, item],
              }))
            }
            onToggleChecklist={(cid) =>
              setState((prev) => ({
                ...prev,
                checklists: prev.checklists.map((c) =>
                  c.id === cid ? { ...c, checked: !c.checked } : c
                ),
              }))
            }
            onDeleteChecklist={(cid) =>
              setState((prev) => ({
                ...prev,
                checklists: prev.checklists.filter((c) => c.id !== cid),
              }))
            }
          />
        );
      case 'ai_recommend':
        return (
          <AiRecommendWidget
            todayKst={todayKst}
            selectedDate={selectedDate}
            profile={state.profile}
            schedules={state.schedules}
            todos={state.todos}
            ddays={state.ddays}
            onScheduleSuggestedFocus={(event) =>
              setState((prev) => ({
                ...prev,
                schedules: [...prev.schedules, event],
              }))
            }
          />
        );
      default:
        return null;
    }
  };

  const visibleWidgets = state.widgets.filter((w) => w.visible);

  const navItems: Array<{ id: AppTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'dashboard',
      label: '대시보드',
      icon: <LayoutGrid className="w-4 h-4" />,
    },
    {
      id: 'calendar',
      label: '달력',
      icon: <CalendarDays className="w-4 h-4" />,
    },
    {
      id: 'widgets',
      label: '생활 위젯',
      icon: <SlidersHorizontal className="w-4 h-4" />,
    },
    {
      id: 'settings',
      label: '커스터마이징',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  const openNewScheduleFor = (date: string, startTime?: string, endTime?: string) => {
    setEditingSchedule(null);
    setScheduleModalDate(date);
    setScheduleStartTime(startTime);
    setScheduleEndTime(endTime);
    setScheduleModalOpen(true);
  };

  const openEditSchedule = (event: ScheduleEvent) => {
    setEditingSchedule(event);
    setScheduleModalDate(event.date);
    setScheduleStartTime(undefined);
    setScheduleEndTime(undefined);
    setScheduleModalOpen(true);
  };

  const handleToggleWidgetVisible = (wid: string) =>
    setState((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.id === wid ? { ...w, visible: !w.visible } : w
      ),
    }));

  const handleMoveWidgetOrder = (index: number, direction: -1 | 1) =>
    setState((prev) => {
      const arr = [...prev.widgets];
      const targetIdx = index + direction;
      if (targetIdx < 0 || targetIdx >= arr.length) return prev;
      const [moved] = arr.splice(index, 1);
      arr.splice(targetIdx, 0, moved);
      return { ...prev, widgets: arr };
    });

  const handleToggleWidgetSize = (wid: string) =>
    setState((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.id === wid
          ? { ...w, size: w.size === 'wide' ? 'compact' : 'wide' }
          : w
      ),
    }));

  const handleDeleteCustomWidget = (wid: string) =>
    setState((prev) => ({
      ...prev,
      customWidgets: prev.customWidgets.filter((c) => c.id !== wid),
      widgets: prev.widgets.filter((w) => w.id !== wid),
    }));

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-[260px] lg:shrink-0 lg:flex-col lg:justify-between border-r border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sticky top-0 h-screen overflow-y-auto">
        <div className="space-y-8">
          <div>
            <p className="text-xl font-bold tracking-tight">MY DAY</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              당신의 하루를 당신답게
            </p>
          </div>

          <nav className="space-y-1.5" aria-label="주 메뉴">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'font-semibold bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]/60 hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span style={active ? { color: 'var(--accent-primary)' } : undefined}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => openNewScheduleFor(selectedDate)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-contrast)',
            }}
          >
            <Plus className="w-4 h-4" />
            <span>새 일정 추가</span>
          </button>

          {/* Planner Switcher & Blank Planner Creation */}
          <div className="pt-4 border-t border-[var(--border-hairline)] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-[var(--text-muted)]">
                내 플래너 ({workspace.planners.length})
              </p>
              <button
                type="button"
                onClick={() => handleCreateBlankPlanner()}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer whitespace-nowrap"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>빈 플래너 만들기</span>
              </button>
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
              {workspace.planners.map((p) => {
                const isActive = p.plannerId === workspace.activePlannerId;
                const confirming = sidebarConfirmDeleteId === p.plannerId;
                const renaming = sidebarRenamingId === p.plannerId;
                return (
                  <div key={p.plannerId} className="space-y-1">
                    {renaming ? (
                      <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg border border-[var(--accent-primary)] bg-[var(--bg-canvas)]">
                        <input
                          type="text"
                          value={sidebarRenameDraft}
                          onChange={(e) => setSidebarRenameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleRenamePlanner(p.plannerId, sidebarRenameDraft);
                            } else if (e.key === 'Escape') {
                              setSidebarRenamingId(null);
                              setPlannerSwitchNotice(null);
                            }
                          }}
                          aria-label={`${p.name} 새 이름`}
                          maxLength={40}
                          autoFocus
                          className="flex-1 min-w-0 px-1.5 py-0.5 text-xs bg-transparent focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleRenamePlanner(p.plannerId, sidebarRenameDraft)}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer shrink-0"
                          style={{
                            backgroundColor: 'var(--accent-primary)',
                            color: 'var(--accent-contrast)',
                          }}
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSidebarRenamingId(null);
                            setPlannerSwitchNotice(null);
                          }}
                          aria-label="이름 변경 취소"
                          className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                          isActive
                            ? 'bg-[var(--bg-canvas)] border-[var(--accent-primary)] font-semibold'
                            : 'border-transparent hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSwitchPlanner(p.plannerId)}
                          className="flex-1 min-w-0 flex items-center gap-1.5 text-left cursor-pointer"
                        >
                          {isActive && (
                            <Check className="w-3 h-3 text-[var(--accent-primary)] shrink-0" />
                          )}
                          <span className="truncate">{p.name}</span>
                          <span className="text-[10px] text-[var(--text-muted)] tabular-nums shrink-0">
                            {p.data.schedules.length}
                          </span>
                        </button>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setPlannerSwitchNotice(null);
                              setSidebarConfirmDeleteId(null);
                              setSidebarRenamingId(p.plannerId);
                              setSidebarRenameDraft(p.name);
                            }}
                            aria-label={`${p.name} 이름 변경`}
                            title="이름 변경"
                            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>

                          {workspace.planners.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setPlannerSwitchNotice(null);
                                setSidebarRenamingId(null);
                                setSidebarConfirmDeleteId(confirming ? null : p.plannerId);
                              }}
                              aria-label={`${p.name} 삭제`}
                              title="플래너 삭제"
                              className="p-1 rounded text-[var(--text-muted)] hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {confirming && (
                      <div className="px-2.5 py-2 rounded-lg bg-red-500/10 border border-red-500/30 space-y-1.5">
                        <p className="text-[11px] text-red-700 dark:text-red-300 leading-snug">
                          ‘{p.name}’만 삭제할까요? 다른 플래너는 유지됩니다.
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDeletePlanner(p.plannerId)}
                            className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-semibold cursor-pointer"
                          >
                            삭제
                          </button>
                          <button
                            type="button"
                            onClick={() => setSidebarConfirmDeleteId(null)}
                            className="px-2 py-0.5 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[10px] cursor-pointer"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {plannerSwitchNotice && (
              <p className="text-[11px] text-red-600 dark:text-red-400">{plannerSwitchNotice}</p>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--border-hairline)] space-y-3 text-xs text-[var(--text-secondary)]">
          <SidebarAccountCard
            user={user}
            authReady={authReady}
            emailVerified={emailVerified}
            saveStatus={saveStatus}
            lastSavedAt={lastSavedAt}
            saveErrorMsg={saveErrorMsg}
            onOpenAuth={openAuthModal}
            onManualSave={handleManualSave}
            onRetrySave={() => void flushSaveToCloud()}
            onLogout={() => void handleLogout()}
            onResendVerification={resendVerificationEmail}
            onRefreshVerification={refreshVerificationStatus}
          />

          <div>
            <p className="text-[11px] text-[var(--text-muted)] mb-1.5">빠른 테마 전환</p>
            <div className="flex items-center gap-1.5">
              {THEME_OPTIONS.filter((t) =>
                ['cream', 'white', 'sage', 'lavender', 'dark'].includes(t.id)
              ).map((t) => {
                const active = state.design.theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    title={`${t.label} 테마`}
                    aria-label={`${t.label} 테마로 변경`}
                    aria-pressed={active}
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        design: { ...prev.design, theme: t.id },
                      }))
                    }
                    className={`w-6 h-6 rounded-lg border cursor-pointer transition-transform ${
                      active
                        ? 'ring-2 ring-[var(--accent-primary)] scale-105 border-transparent'
                        : 'border-[var(--border-hairline)] hover:scale-105'
                    }`}
                    style={{ backgroundColor: t.swatchBg }}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <p className="font-semibold text-[var(--text-primary)] truncate">
              {activePlanner.name}
            </p>
            <p className="truncate text-[var(--text-muted)]">
              {state.profile.lifestyle} · {state.profile.purposes.join(', ') || '자유 기록'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setWorkspace((prev) => ({ ...prev, stage: 'welcome' }))}
            className="text-xs text-[var(--accent-primary)] hover:underline cursor-pointer"
          >
            첫 화면으로 돌아가기
          </button>
        </div>
      </aside>

      {/* Mobile Top Header + Collapsible Drawer */}
      <header className="lg:hidden sticky top-0 z-30 bg-[var(--bg-surface)] border-b border-[var(--border-hairline)] px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={mobileMenuOpen}
            className="p-2 rounded-lg border border-[var(--border-hairline)] cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <span className="text-base font-bold tracking-tight whitespace-nowrap">
            MY DAY
          </span>
        </div>

        <div className="flex items-center gap-2">
          {authReady && !user && (
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-canvas)] cursor-pointer whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>로그인</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => openNewScheduleFor(selectedDate)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-contrast)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>일정 추가</span>
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="lg:hidden bg-[var(--bg-surface)] border-b border-[var(--border-hairline)] px-4 py-3 space-y-2.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer ${
                activeTab === item.id
                  ? 'bg-[var(--bg-subtle)] font-semibold'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}

          {/* Mobile Planner Switcher + Blank Planner Creation */}
          <div className="pt-2 border-t border-[var(--border-hairline)] space-y-1.5 px-1">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                내 플래너 ({workspace.planners.length})
              </span>
              <button
                type="button"
                onClick={() => handleCreateBlankPlanner()}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-primary)] cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>빈 플래너 만들기</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 px-2">
              {workspace.planners.map((p) => {
                const isActive = p.plannerId === workspace.activePlannerId;
                return (
                  <div
                    key={p.plannerId}
                    className={`inline-flex items-center rounded-lg text-xs border ${
                      isActive
                        ? 'border-[var(--accent-primary)] bg-[var(--bg-canvas)] font-semibold'
                        : 'border-[var(--border-hairline)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSwitchPlanner(p.plannerId)}
                      className="px-2.5 py-1 cursor-pointer"
                    >
                      {p.name} ({p.data.schedules.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPlannerSwitchNotice(null);
                        setSidebarRenamingId(p.plannerId);
                        setSidebarRenameDraft(p.name);
                      }}
                      aria-label={`${p.name} 이름 변경`}
                      className="pr-2 py-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
            {sidebarRenamingId && (
              <div className="flex items-center gap-1.5 px-2 pt-1">
                <input
                  type="text"
                  value={sidebarRenameDraft}
                  onChange={(e) => setSidebarRenameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleRenamePlanner(sidebarRenamingId, sidebarRenameDraft);
                    } else if (e.key === 'Escape') {
                      setSidebarRenamingId(null);
                    }
                  }}
                  aria-label="플래너 새 이름"
                  maxLength={40}
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-[var(--accent-primary)] bg-[var(--bg-canvas)] text-xs"
                />
                <button
                  type="button"
                  onClick={() => handleRenamePlanner(sidebarRenamingId, sidebarRenameDraft)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--accent-contrast)',
                  }}
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarRenamingId(null)}
                  className="px-2 py-1.5 rounded-lg text-xs border border-[var(--border-hairline)] bg-[var(--bg-surface)] cursor-pointer shrink-0"
                >
                  취소
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setCustomWidgetModalOpen(true);
              setMobileMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-xs text-[var(--accent-primary)] font-semibold cursor-pointer"
          >
            + 새 사용자 정의 위젯 추가
          </button>
          <div className="pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between px-3">
            <span className="text-xs text-[var(--text-muted)]">빠른 테마</span>
            <div className="flex items-center gap-1.5">
              {THEME_OPTIONS.filter((t) =>
                ['cream', 'white', 'sage', 'lavender', 'dark'].includes(t.id)
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-label={`${t.label} 테마`}
                  aria-pressed={state.design.theme === t.id}
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      design: { ...prev.design, theme: t.id },
                    }))
                  }
                  className={`w-6 h-6 rounded-lg border cursor-pointer ${
                    state.design.theme === t.id
                      ? 'ring-2 ring-[var(--accent-primary)] border-transparent'
                      : 'border-[var(--border-hairline)]'
                  }`}
                  style={{ backgroundColor: t.swatchBg }}
                />
              ))}
            </div>
          </div>
          <div className="pt-2 border-t border-[var(--border-hairline)] px-1">
            <SidebarAccountCard
              user={user}
              authReady={authReady}
              emailVerified={emailVerified}
              saveStatus={saveStatus}
              lastSavedAt={lastSavedAt}
              saveErrorMsg={saveErrorMsg}
              onOpenAuth={(m, r) => {
                setMobileMenuOpen(false);
                openAuthModal(m, r);
              }}
              onManualSave={handleManualSave}
              onRetrySave={() => void flushSaveToCloud()}
              onLogout={() => {
                setMobileMenuOpen(false);
                void handleLogout();
              }}
              onResendVerification={resendVerificationEmail}
              onRefreshVerification={refreshVerificationStatus}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 pb-24 lg:pb-12">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
          {/* Today Date Header + Save Status & Account Bar */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[var(--text-muted)]">
                오늘 · 한국 표준시(KST)
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-0.5 tabular-nums">
                {formatKoreanFullDate(todayKst)}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="planner-surface rounded-xl px-3 py-1.5">
                <SaveStatusIndicator
                  compact
                  status={saveStatus}
                  lastSavedAt={lastSavedAt}
                  errorMsg={saveErrorMsg}
                  onManualSave={handleManualSave}
                  onRetrySave={() => void flushSaveToCloud()}
                />
              </div>

              {authReady && !user && (
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] cursor-pointer whitespace-nowrap"
                >
                  <LogIn className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>로그인 · 회원가입</span>
                </button>
              )}

              {authReady && user && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
                  <span className="font-semibold truncate max-w-[140px]">
                    {user.displayName?.trim() || user.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="inline-flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>로그아웃</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {user && guestDraftOfferAvailable && (
            <div className="planner-surface rounded-2xl px-4 py-3 border border-[var(--accent-primary)]/40 flex flex-wrap items-center justify-between gap-3 text-xs">
              <p className="text-[var(--text-secondary)]">
                로그인 전에 이 기기에서 작성한 플래너 데이터가 남아 있습니다. 기존 클라우드 플래너와 별도로 계정에 추가할까요?
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleImportGuestDraft}
                  className="px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--accent-contrast)',
                  }}
                >
                  새 플래너로 추가
                </button>
                <button
                  type="button"
                  onClick={() => {
                    markGuestMigratedToUid(user.uid);
                    setGuestDraftOfferAvailable(false);
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  닫기
                </button>
              </div>
            </div>
          )}

          {/* AI Planner Bar (Always accessible on main views) */}
          {activeTab !== 'settings' && (
            <AiPlannerBar
              key={workspace.activePlannerId}
              todayKst={todayKst}
              selectedDate={selectedDate}
              state={state}
              onApplyProposal={handleApplyAiProposal}
              onUndoLastAiChange={() => {
                if (undoSnapshot) {
                  setState(undoSnapshot);
                  setCalendarView(undoSnapshot.design.defaultView);
                  setUndoSnapshot(null);
                }
              }}
              canUndo={Boolean(undoSnapshot)}
              onOpenNewSchedule={() => openNewScheduleFor(selectedDate)}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Top Overview Strip: Today Schedules, Today Todos, Weekly Goal & Upcoming */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Today's Schedules */}
                <div className="planner-surface rounded-2xl p-5 space-y-3 min-w-0">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold">오늘의 일정</h2>
                    <span className="text-xs text-[var(--text-muted)] tabular-nums">
                      {todaySchedules.length}건
                    </span>
                  </div>
                  {todaySchedules.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] py-3">
                      오늘 예정된 일정이 없습니다.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {todaySchedules.slice(0, 3).map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => openEditSchedule(ev)}
                          className="w-full text-left p-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] hover:border-[var(--accent-primary)] cursor-pointer flex items-center justify-between gap-2"
                        >
                          <span className="text-xs font-semibold truncate">{ev.title}</span>
                          <span className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">
                            {formatTimeDisplay(ev.startTime, state.design.timeFormat)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Today's Todos */}
                <div className="planner-surface rounded-2xl p-5 space-y-3 min-w-0">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold">오늘의 할 일</h2>
                    <span className="text-xs text-[var(--text-muted)] tabular-nums">
                      {todayTodos.filter((t) => t.completed).length}/{todayTodos.length} 완료
                    </span>
                  </div>
                  {todayTodos.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] py-3">
                      오늘 마감인 할 일이 없습니다.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {todayTodos.slice(0, 3).map((todo) => (
                        <button
                          key={todo.id}
                          type="button"
                          onClick={() =>
                            setState((prev) => ({
                              ...prev,
                              todos: prev.todos.map((t) =>
                                t.id === todo.id ? { ...t, completed: !t.completed } : t
                              ),
                            }))
                          }
                          className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-left cursor-pointer"
                        >
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              todo.completed
                                ? 'border-transparent'
                                : 'border-[var(--border-hairline)] bg-[var(--bg-surface)]'
                            }`}
                            style={
                              todo.completed
                                ? {
                                    backgroundColor: 'var(--accent-primary)',
                                    color: 'var(--accent-contrast)',
                                  }
                                : undefined
                            }
                          >
                            {todo.completed && <Check className="w-3 h-3" />}
                          </span>
                          <span
                            className={`text-xs truncate ${
                              todo.completed ? 'line-through text-[var(--text-muted)]' : 'font-medium'
                            }`}
                          >
                            {todo.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Weekly Goal + Upcoming D-day */}
                <div className="planner-surface rounded-2xl p-5 space-y-3 min-w-0">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold">이번 주 목표 · 달성률</h2>
                    <span className="text-sm font-bold text-[var(--accent-primary)] tabular-nums">
                      {weeklyCompletionRate}%
                    </span>
                  </div>

                  {!editingGoal ? (
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {state.profile.weeklyGoal || '이번 주 목표를 설정해 보세요.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setGoalDraft(state.profile.weeklyGoal);
                          setEditingGoal(true);
                        }}
                        aria-label="목표 수정"
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer shrink-0"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={goalDraft}
                        onChange={(e) => setGoalDraft(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setState((prev) => ({
                            ...prev,
                            profile: { ...prev.profile, weeklyGoal: goalDraft.trim() },
                          }));
                          setEditingGoal(false);
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                        style={{
                          backgroundColor: 'var(--accent-primary)',
                          color: 'var(--accent-contrast)',
                        }}
                      >
                        저장
                      </button>
                    </div>
                  )}

                  <div className="h-1.5 w-full rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${weeklyCompletionRate}%`,
                        backgroundColor: 'var(--accent-primary)',
                      }}
                    />
                  </div>

                  <div className="pt-2 border-t border-[var(--border-hairline)] flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)] tabular-nums">
                    {upcomingDDays.length > 0 ? (
                      upcomingDDays.map((dd) => (
                        <span key={dd.id}>
                          {dd.title}{' '}
                          <strong className="text-[var(--text-primary)]">
                            {formatDDayBadge(dd.targetDate, todayKst)}
                          </strong>
                        </span>
                      ))
                    ) : (
                      <span>
                        다가오는 일정 {upcomingSchedules.length}건
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Calendar + Selected Date Side Detail */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                <div className="xl:col-span-8 min-w-0">
                  <CalendarSection
                    todayKst={todayKst}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                    viewMode={calendarView}
                    onChangeViewMode={handleChangeCalendarView}
                    layout={state.design.layout}
                    weekStart={state.design.weekStart}
                    timeFormat={state.design.timeFormat}
                    conflictAlertEnabled={state.notifications.conflictAlert}
                    schedules={state.schedules}
                    todos={state.todos}
                    categoryColors={state.categoryColors}
                    onOpenNewSchedule={openNewScheduleFor}
                    onEditSchedule={openEditSchedule}
                  />
                </div>

                {/* Selected Date Detail Panel */}
                <aside className="xl:col-span-4 min-w-0 planner-surface rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">선택한 날짜</p>
                      <h3 className="text-base font-bold tabular-nums">
                        {formatKoreanFullDate(selectedDate)}
                      </h3>
                      {selectedDayHoliday && (
                        <p className="text-xs font-semibold text-red-600 dark:text-red-400 mt-0.5">
                          공휴일 · {selectedDayHoliday.name}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openNewScheduleFor(selectedDate)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                      style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: 'var(--accent-contrast)',
                      }}
                    >
                      + 일정
                    </button>
                  </div>

                  {state.notifications.conflictAlert &&
                    detectScheduleConflicts(selectedDaySchedules).length > 0 && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300">
                        선택한 날짜에 시간이 겹치는 일정이 있습니다.
                      </div>
                    )}

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[var(--text-secondary)]">
                      일정 ({selectedDaySchedules.length})
                    </p>
                    {selectedDaySchedules.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)] py-2">
                        등록된 일정이 없습니다.
                      </p>
                    ) : (
                      selectedDaySchedules.map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => openEditSchedule(ev)}
                          className="w-full text-left p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] hover:border-[var(--accent-primary)] cursor-pointer space-y-1"
                        >
                          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] tabular-nums">
                            <span>{ev.category}</span>
                            <span>
                              {formatScheduleTimeRange(
                                ev.startTime,
                                ev.endTime,
                                state.design.timeFormat
                              )}
                            </span>
                          </div>
                          <p className="text-sm font-semibold">{ev.title}</p>
                          {ev.memo && (
                            <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                              {ev.memo}
                            </p>
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  <div className="pt-3 border-t border-[var(--border-hairline)] space-y-2">
                    <p className="text-xs font-semibold text-[var(--text-secondary)]">
                      해당 날짜 할 일 ({selectedDayTodos.length})
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const trimmed = quickDateTodoTitle.trim();
                        if (!trimmed) return;
                        setState((prev) => ({
                          ...prev,
                          todos: [
                            {
                              id: `todo-${Date.now()}`,
                              title: trimmed,
                              completed: false,
                              importance: 'medium',
                              dueDate: selectedDate,
                              category: '할 일',
                            },
                            ...prev.todos,
                          ],
                        }));
                        setQuickDateTodoTitle('');
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        value={quickDateTodoTitle}
                        onChange={(e) => setQuickDateTodoTitle(e.target.value)}
                        placeholder={`${formatKoreanMonthDay(selectedDate)} 할 일 추가`}
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                      />
                      <button
                        type="submit"
                        disabled={!quickDateTodoTitle.trim()}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 cursor-pointer shrink-0"
                        style={{
                          backgroundColor: 'var(--accent-primary)',
                          color: 'var(--accent-contrast)',
                        }}
                      >
                        추가
                      </button>
                    </form>

                    {selectedDayTodos.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)] py-1">
                        마감 예정인 할 일이 없습니다.
                      </p>
                    ) : (
                      selectedDayTodos.map((t) => (
                        <div
                          key={t.id}
                          className="group flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)]"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setState((prev) => ({
                                ...prev,
                                todos: prev.todos.map((item) =>
                                  item.id === t.id
                                    ? { ...item, completed: !item.completed }
                                    : item
                                ),
                              }))
                            }
                            className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
                          >
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                t.completed
                                  ? 'border-transparent'
                                  : 'border-[var(--border-hairline)] bg-[var(--bg-surface)]'
                              }`}
                              style={
                                t.completed
                                  ? {
                                      backgroundColor: 'var(--accent-primary)',
                                      color: 'var(--accent-contrast)',
                                    }
                                  : undefined
                              }
                            >
                              {t.completed && <Check className="w-3 h-3" />}
                            </span>
                            <span
                              className={`text-xs truncate ${
                                t.completed
                                  ? 'line-through text-[var(--text-muted)]'
                                  : 'font-medium'
                              }`}
                            >
                              {t.title}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setState((prev) => ({
                                ...prev,
                                todos: prev.todos.filter((item) => item.id !== t.id),
                              }))
                            }
                            aria-label="할 일 삭제"
                            className="p-1 text-[var(--text-muted)] hover:text-red-600 opacity-70 group-hover:opacity-100 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Upcoming 5-day peek */}
                  <div className="pt-3 border-t border-[var(--border-hairline)] space-y-1.5">
                    <p className="text-xs font-semibold text-[var(--text-secondary)]">
                      다가오는 일정
                    </p>
                    {upcomingSchedules.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)]">
                        예정된 일정이 없습니다.
                      </p>
                    ) : (
                      upcomingSchedules.map(({ ymd, event }) => (
                        <button
                          key={`${ymd}-${event.id}`}
                          type="button"
                          onClick={() => {
                            setSelectedDate(ymd);
                            openEditSchedule(event);
                          }}
                          className="w-full flex items-center justify-between text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] py-0.5 tabular-nums cursor-pointer text-left"
                        >
                          <span className="truncate pr-2">{event.title}</span>
                          <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                            {formatKoreanMonthDay(ymd)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </aside>
              </div>

              {/* Active Dashboard Widgets Grid + Inline Visibility/Order Controls */}
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold tracking-tight">맞춤 생활 위젯</h2>
                    <span className="text-xs text-[var(--text-muted)] tabular-nums">
                      {visibleWidgets.length}/{state.widgets.length} 표시 중
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setDashboardWidgetEditorOpen((open) => !open)
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                      style={
                        dashboardWidgetEditorOpen
                          ? {
                              backgroundColor: 'var(--accent-primary)',
                              color: 'var(--accent-contrast)',
                              borderColor: 'transparent',
                            }
                          : undefined
                      }
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>
                        {dashboardWidgetEditorOpen ? '편집 완료' : '위젯 표시·순서 설정'}
                      </span>
                    </button>
                  </div>
                </div>

                {dashboardWidgetEditorOpen && (
                  <WidgetOrderManager
                    title="대시보드 위젯 구성"
                    description="위젯 표시 여부, 순서, 카드 너비를 바꾸면 즉시 반영되고 자동 저장됩니다."
                    widgets={state.widgets}
                    customWidgets={state.customWidgets}
                    compactGrid
                    allowDeleteCustom
                    onToggleVisible={handleToggleWidgetVisible}
                    onMoveOrder={handleMoveWidgetOrder}
                    onToggleSize={handleToggleWidgetSize}
                    onOpenNewCustomWidget={() => setCustomWidgetModalOpen(true)}
                    onDeleteCustomWidget={handleDeleteCustomWidget}
                  />
                )}

                {visibleWidgets.length === 0 ? (
                  <div className="planner-surface rounded-2xl p-6 text-center space-y-2">
                    <p className="text-sm font-medium text-[var(--text-secondary)]">
                      현재 대시보드에 표시 중인 위젯이 없습니다.
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      위젯 표시·순서 설정에서 D-day, 습관 트래커, 지출 기록, 메모 등 원하는 위젯을 켜 보세요.
                    </p>
                    {!dashboardWidgetEditorOpen && (
                      <button
                        type="button"
                        onClick={() => setDashboardWidgetEditorOpen(true)}
                        className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                        style={{
                          backgroundColor: 'var(--accent-primary)',
                          color: 'var(--accent-contrast)',
                        }}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>위젯 표시 설정 열기</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                    {visibleWidgets.map((w) => (
                      <div
                        key={w.id}
                        className={w.size === 'wide' ? 'md:col-span-2' : ''}
                      >
                        {renderWidgetById(w.id, w.type)}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* TAB: CALENDAR ONLY */}
          {activeTab === 'calendar' && (
            <div className="space-y-6">
              <CalendarSection
                todayKst={todayKst}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                viewMode={calendarView}
                onChangeViewMode={handleChangeCalendarView}
                layout={state.design.layout}
                weekStart={state.design.weekStart}
                timeFormat={state.design.timeFormat}
                conflictAlertEnabled={state.notifications.conflictAlert}
                schedules={state.schedules}
                todos={state.todos}
                categoryColors={state.categoryColors}
                onOpenNewSchedule={openNewScheduleFor}
                onEditSchedule={openEditSchedule}
              />
            </div>
          )}

          {/* TAB: ALL LIFE WIDGETS */}
          {activeTab === 'widgets' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">생활 관리 위젯 모음</h2>
                  <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                    활성화한 위젯과 사용자 정의 위젯을 한곳에서 관리합니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomWidgetModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--accent-contrast)',
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>사용자 정의 위젯 추가</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                {state.widgets.map((w) => (
                  <div
                    key={w.id}
                    className={w.size === 'wide' ? 'md:col-span-2' : ''}
                  >
                    {renderWidgetById(w.id, w.type)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && (
            <SettingsView
              workspace={workspace}
              state={state}
              onUpdateDesign={(patch) => {
                if (patch.defaultView) setCalendarView(patch.defaultView);
                setState((prev) => ({
                  ...prev,
                  design: { ...prev.design, ...patch },
                }));
              }}
              onUpdateProfile={(patch) =>
                setState((prev) => ({
                  ...prev,
                  profile: { ...prev.profile, ...patch },
                }))
              }
              onUpdateNotifications={(patch) =>
                setState((prev) => ({
                  ...prev,
                  notifications: { ...prev.notifications, ...patch },
                }))
              }
              onToggleWidgetVisible={handleToggleWidgetVisible}
              onMoveWidgetOrder={handleMoveWidgetOrder}
              onToggleWidgetSize={handleToggleWidgetSize}
              onOpenNewCustomWidget={() => setCustomWidgetModalOpen(true)}
              onDeleteCustomWidget={handleDeleteCustomWidget}
              onCreateBlankPlanner={(name) => handleCreateBlankPlanner({ name })}
              onSwitchPlanner={handleSwitchPlanner}
              onRenamePlanner={handleRenamePlanner}
              onDeletePlanner={handleDeletePlanner}
              onImportBackup={(imported) => {
                if (imported.kind === 'workspace') {
                  persistLocalForCurrentSession(imported.workspace);
                  setWorkspace(imported.workspace);
                  const active = getActivePlannerRecord(imported.workspace);
                  setCalendarView(active.data.design.defaultView);
                  setSelectedDate(todayKst);
                  setUndoSnapshot(null);
                  setEditingGoal(false);
                  setGoalDraft(active.data.profile.weeklyGoal);
                } else {
                  const { nextWorkspace, newPlanner } = createBlankPlannerInWorkspace(
                    workspace,
                    {
                      name: '가져온 플래너',
                      patchData: () => ({ ...imported.state, stage: 'app' }),
                    }
                  );
                  persistLocalForCurrentSession(nextWorkspace);
                  setWorkspace(nextWorkspace);
                  setCalendarView(newPlanner.data.design.defaultView);
                  setSelectedDate(todayKst);
                  setUndoSnapshot(null);
                  setEditingGoal(false);
                  setGoalDraft(newPlanner.data.profile.weeklyGoal);
                }
              }}
              onRestartOnboarding={() =>
                setWorkspace((prev) => ({ ...prev, stage: 'onboarding' }))
              }
              user={user}
              saveStatus={saveStatus}
              lastSavedAt={lastSavedAt}
              saveErrorMsg={saveErrorMsg}
              guestDraftAvailable={guestDraftOfferAvailable}
              onManualSave={() => void handleManualSave()}
              onRetrySave={() => void flushSaveToCloud()}
              onOpenAuth={openAuthModal}
              onImportGuestDraft={handleImportGuestDraft}
            />
          )}
        </div>
        <div className="mt-8">
          <SiteFooter maxWidthClass="max-w-[1200px]" />
        </div>
      </main>

      {/* Mobile Bottom Navigation (<= 15% viewport height) */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[var(--bg-surface)] border-t border-[var(--border-hairline)] grid grid-cols-4 h-16"
        aria-label="모바일 하단 내비게이션"
      >
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] cursor-pointer ${
                active ? 'font-bold' : 'text-[var(--text-secondary)]'
              }`}
              style={active ? { color: 'var(--accent-primary)' } : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modals */}
      <ScheduleModal
        isOpen={scheduleModalOpen}
        initialDate={scheduleModalDate}
        initialStartTime={scheduleStartTime}
        initialEndTime={scheduleEndTime}
        editingEvent={editingSchedule}
        allSchedules={state.schedules}
        categoryColors={state.categoryColors}
        onSave={(event, updatedCategoryColor) => {
          setState((prev) => {
            const exists = prev.schedules.some((s) => s.id === event.id);
            const nextSchedules = exists
              ? prev.schedules.map((s) => (s.id === event.id ? event : s))
              : [...prev.schedules, event];
            const nextColors = updatedCategoryColor
              ? {
                  ...prev.categoryColors,
                  [updatedCategoryColor.name]: updatedCategoryColor.color,
                }
              : prev.categoryColors;
            return {
              ...prev,
              schedules: nextSchedules,
              categoryColors: nextColors,
            };
          });
        }}
        onDelete={(id) =>
          setState((prev) => ({
            ...prev,
            schedules: prev.schedules.filter((s) => s.id !== id),
          }))
        }
        onClose={() => setScheduleModalOpen(false)}
      />

      <NewCustomWidgetModal
        isOpen={customWidgetModalOpen}
        onClose={() => setCustomWidgetModalOpen(false)}
        onCreate={(cw) =>
          setState((prev) => ({
            ...prev,
            customWidgets: [cw, ...prev.customWidgets],
            widgets: [
              { id: cw.id, type: 'custom', visible: true, size: 'compact' },
              ...prev.widgets,
            ],
          }))
        }
      />

      {authModalElement}
    </div>
  );
}
