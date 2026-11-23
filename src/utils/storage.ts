import {
  AccentId,
  AppStage,
  CalendarViewMode,
  DesignSettings,
  FontChoice,
  LayoutStyle,
  PlannerRecord,
  PlannerState,
  PlannerWorkspace,
  ThemeId,
  WidgetPlacement,
} from '../types/planner';
import { getKstTodayString, isValidHhmm, isValidYmd } from './dateKst';
import { createInitialPlannerState } from './sampleData';

const STORAGE_KEY = 'myday_life_planner_state_v1';

const VALID_STAGES = new Set<AppStage>(['welcome', 'onboarding', 'app']);
const VALID_THEMES = new Set<ThemeId>([
  'cream',
  'white',
  'sage',
  'lavender',
  'pastel',
  'monotone',
  'dark',
]);
const VALID_ACCENTS = new Set<AccentId>([
  'sage',
  'lavender',
  'charcoal',
  'ocean',
  'coral',
  'forest',
]);
const VALID_FONTS = new Set<FontChoice>(['sans', 'rounded', 'serif', 'mono']);
const VALID_VIEWS = new Set<CalendarViewMode>(['month', 'week', 'day']);
const VALID_LAYOUTS = new Set<LayoutStyle>(['simple', 'diary', 'timetable']);

function sanitizeWidgets(
  rawWidgets: unknown,
  fallbackWidgets: WidgetPlacement[],
  customIds: Set<string>
): WidgetPlacement[] {
  if (!Array.isArray(rawWidgets) || rawWidgets.length === 0) {
    return fallbackWidgets;
  }
  const seen = new Set<string>();
  const cleaned: WidgetPlacement[] = [];
  for (const item of rawWidgets) {
    if (!item || typeof item !== 'object') continue;
    const w = item as Partial<WidgetPlacement>;
    if (typeof w.id !== 'string' || !w.id || seen.has(w.id)) continue;
    const type: 'builtin' | 'custom' =
      w.type === 'custom' && customIds.has(w.id) ? 'custom' : 'builtin';
    if (w.type === 'custom' && !customIds.has(w.id)) continue;
    seen.add(w.id);
    cleaned.push({
      id: w.id,
      type,
      visible: typeof w.visible === 'boolean' ? w.visible : true,
      size: w.size === 'wide' ? 'wide' : 'compact',
    });
  }
  // Ensure any builtin widgets from fallback not yet present are appended safely
  for (const fb of fallbackWidgets) {
    if (!seen.has(fb.id)) {
      cleaned.push({ ...fb, visible: false });
      seen.add(fb.id);
    }
  }
  return cleaned.length > 0 ? cleaned : fallbackWidgets;
}

const LEGACY_SAMPLE_SCHEDULE_IDS = new Set(['sch-1', 'sch-2', 'sch-3', 'sch-4']);
const LEGACY_SAMPLE_TODO_IDS = new Set(['todo-1', 'todo-2', 'todo-3', 'todo-4']);
const LEGACY_SAMPLE_HABIT_IDS = new Set(['hab-1', 'hab-2', 'hab-3']);
const LEGACY_SAMPLE_DDAY_IDS = new Set(['dd-1', 'dd-2', 'dd-3']);
const LEGACY_SAMPLE_FOCUS_IDS = new Set(['foc-1', 'foc-2']);
const LEGACY_SAMPLE_EXPENSE_IDS = new Set(['exp-1', 'exp-2', 'exp-3', 'exp-4']);
const LEGACY_SAMPLE_NOTE_IDS = new Set(['note-1', 'note-2']);
const LEGACY_SAMPLE_ROUTINE_IDS = new Set(['rtn-1', 'rtn-2', 'rtn-3']);
const LEGACY_SAMPLE_CHECKLIST_IDS = new Set(['chk-1', 'chk-2', 'chk-3']);
const LEGACY_SAMPLE_WEEKLY_GOAL = '핵심 프로젝트 마감 및 주 3회 운동 습관 유지하기';

export function sanitizePlannerState(
  parsed: Partial<PlannerState>,
  fallback: PlannerState = createInitialPlannerState()
): PlannerState {
  const today = getKstTodayString();
  const isLegacyV1 = typeof parsed.version !== 'number' || parsed.version < 2;
  const rawDesign: Partial<DesignSettings> =
    parsed.design && typeof parsed.design === 'object' ? parsed.design : {};

  const design: DesignSettings = {
    theme: VALID_THEMES.has(rawDesign.theme as ThemeId)
      ? (rawDesign.theme as ThemeId)
      : fallback.design.theme,
    accent: VALID_ACCENTS.has(rawDesign.accent as AccentId)
      ? (rawDesign.accent as AccentId)
      : fallback.design.accent,
    font: VALID_FONTS.has(rawDesign.font as FontChoice)
      ? (rawDesign.font as FontChoice)
      : fallback.design.font,
    defaultView: VALID_VIEWS.has(rawDesign.defaultView as CalendarViewMode)
      ? (rawDesign.defaultView as CalendarViewMode)
      : fallback.design.defaultView,
    layout: VALID_LAYOUTS.has(rawDesign.layout as LayoutStyle)
      ? (rawDesign.layout as LayoutStyle)
      : fallback.design.layout,
    weekStart: rawDesign.weekStart === 'sunday' ? 'sunday' : 'monday',
    timeFormat: rawDesign.timeFormat === '12h' ? '12h' : '24h',
  };

  const customWidgets = Array.isArray(parsed.customWidgets)
    ? parsed.customWidgets.filter(
        (cw) => cw && typeof cw === 'object' && typeof cw.id === 'string' && typeof cw.title === 'string'
      )
    : fallback.customWidgets;
  const customIdSet = new Set(customWidgets.map((c) => c.id));

  const schedules = Array.isArray(parsed.schedules)
    ? parsed.schedules
        .filter((ev) => ev && typeof ev === 'object' && typeof ev.id === 'string' && typeof ev.title === 'string')
        .filter((ev) => !(isLegacyV1 && LEGACY_SAMPLE_SCHEDULE_IDS.has(ev.id)))
        .map((ev) => {
          const hasStart = typeof ev.startTime === 'string' && ev.startTime.trim().length > 0;
          const hasEnd = typeof ev.endTime === 'string' && ev.endTime.trim().length > 0;
          const cleanStart = !hasStart
            ? ''
            : isValidHhmm(ev.startTime)
            ? ev.startTime.trim()
            : '09:00';
          const cleanEnd = !hasStart
            ? ''
            : hasEnd && isValidHhmm(ev.endTime)
            ? ev.endTime.trim()
            : cleanStart
            ? '10:00'
            : '';
          return {
            ...ev,
            date: isValidYmd(ev.date) ? ev.date : today,
            startTime: cleanStart,
            endTime: cleanEnd,
            memo: typeof ev.memo === 'string' ? ev.memo : '',
            category: typeof ev.category === 'string' && ev.category.trim() ? ev.category : '기타',
            importance:
              ev.importance === 'high' || ev.importance === 'low' ? ev.importance : ('medium' as const),
            repeat:
              ev.repeat === 'daily' || ev.repeat === 'weekly' || ev.repeat === 'monthly'
                ? ev.repeat
                : ('none' as const),
          };
        })
    : fallback.schedules;

  const filterLegacy = <T extends { id?: string }>(
    list: unknown,
    legacyIds: Set<string>,
    fb: T[]
  ): T[] => {
    if (!Array.isArray(list)) return fb;
    return list.filter(
      (item): item is T =>
        Boolean(item && typeof item === 'object') &&
        !(isLegacyV1 && typeof (item as { id?: unknown }).id === 'string' && legacyIds.has((item as { id: string }).id))
    );
  };

  const todos = filterLegacy(parsed.todos, LEGACY_SAMPLE_TODO_IDS, fallback.todos);
  const habits = filterLegacy(parsed.habits, LEGACY_SAMPLE_HABIT_IDS, fallback.habits);
  const ddays = filterLegacy(parsed.ddays, LEGACY_SAMPLE_DDAY_IDS, fallback.ddays);
  const focusEntries = filterLegacy(parsed.focusEntries, LEGACY_SAMPLE_FOCUS_IDS, fallback.focusEntries);
  const expenses = filterLegacy(parsed.expenses, LEGACY_SAMPLE_EXPENSE_IDS, fallback.expenses);
  const notes = filterLegacy(parsed.notes, LEGACY_SAMPLE_NOTE_IDS, fallback.notes);
  const routines = filterLegacy(parsed.routines, LEGACY_SAMPLE_ROUTINE_IDS, fallback.routines);
  const checklists = filterLegacy(parsed.checklists, LEGACY_SAMPLE_CHECKLIST_IDS, fallback.checklists);

  const rawWeeklyGoal =
    typeof parsed.profile?.weeklyGoal === 'string'
      ? parsed.profile.weeklyGoal
      : fallback.profile.weeklyGoal;
  const weeklyGoal =
    isLegacyV1 && rawWeeklyGoal === LEGACY_SAMPLE_WEEKLY_GOAL ? '' : rawWeeklyGoal;

  const rawMonthlyBudget =
    typeof parsed.monthlyBudget === 'number' &&
    Number.isFinite(parsed.monthlyBudget) &&
    parsed.monthlyBudget >= 0
      ? parsed.monthlyBudget
      : fallback.monthlyBudget;
  const monthlyBudget =
    isLegacyV1 && rawMonthlyBudget === 800000 && expenses.length === 0 ? 0 : rawMonthlyBudget;

  return {
    ...fallback,
    ...parsed,
    version: 2,
    stage: VALID_STAGES.has(parsed.stage as AppStage)
      ? (parsed.stage as AppStage)
      : fallback.stage,
    profile: {
      ...fallback.profile,
      ...(parsed.profile && typeof parsed.profile === 'object' ? parsed.profile : {}),
      weeklyGoal,
      purposes: Array.isArray(parsed.profile?.purposes)
        ? parsed.profile.purposes
        : fallback.profile.purposes,
      busyHours: Array.isArray(parsed.profile?.busyHours)
        ? parsed.profile.busyHours
        : fallback.profile.busyHours,
    },
    design,
    notifications: {
      ...fallback.notifications,
      ...(parsed.notifications && typeof parsed.notifications === 'object'
        ? parsed.notifications
        : {}),
      summaryTime: isValidHhmm(parsed.notifications?.summaryTime)
        ? parsed.notifications!.summaryTime
        : fallback.notifications.summaryTime,
    },
    categoryColors: {
      ...fallback.categoryColors,
      ...(parsed.categoryColors && typeof parsed.categoryColors === 'object'
        ? parsed.categoryColors
        : {}),
    },
    monthlyBudget,
    widgets: sanitizeWidgets(parsed.widgets, fallback.widgets, customIdSet),
    customWidgets,
    schedules,
    todos,
    habits,
    ddays,
    focusEntries,
    expenses,
    notes,
    routines,
    checklists,
  };
}

export function hasPlannerUserData(data: PlannerState): boolean {
  return (
    data.schedules.length > 0 ||
    data.todos.length > 0 ||
    data.notes.length > 0 ||
    data.habits.length > 0 ||
    data.ddays.length > 0 ||
    data.focusEntries.length > 0 ||
    data.expenses.length > 0 ||
    data.routines.length > 0 ||
    data.checklists.length > 0 ||
    data.customWidgets.length > 0 ||
    Boolean(data.profile.weeklyGoal?.trim())
  );
}

export function createUniquePlannerId(existingPlanners: PlannerRecord[]): string {
  const existingIds = new Set(existingPlanners.map((p) => p.plannerId));
  let candidate = `planner-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  while (existingIds.has(candidate)) {
    candidate = `planner-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
  return candidate;
}

function getNextBlankPlannerName(existingPlanners: PlannerRecord[], baseName = '빈 플래너'): string {
  const usedNames = new Set(existingPlanners.map((p) => p.name.trim()));
  if (!usedNames.has(baseName)) {
    return baseName === '빈 플래너' && existingPlanners.length > 0
      ? `${baseName} ${existingPlanners.length + 1}`
      : baseName;
  }
  let idx = 2;
  let candidate = `${baseName} ${idx}`;
  while (usedNames.has(candidate)) {
    idx += 1;
    candidate = `${baseName} ${idx}`;
  }
  return candidate;
}

export function createBlankPlannerRecord(
  existingPlanners: PlannerRecord[],
  options?: {
    name?: string;
    patchData?: (fresh: PlannerState) => PlannerState;
  }
): PlannerRecord {
  const nowIso = new Date().toISOString();
  const fresh = createInitialPlannerState();
  fresh.stage = 'app';
  const data = options?.patchData ? options.patchData(fresh) : fresh;
  const baseName = options?.name?.trim() || '빈 플래너';
  return {
    plannerId: createUniquePlannerId(existingPlanners),
    name: getNextBlankPlannerName(existingPlanners, baseName),
    createdAt: nowIso,
    updatedAt: nowIso,
    data,
  };
}

export function createInitialWorkspace(): PlannerWorkspace {
  const nowIso = new Date().toISOString();
  const initialData = createInitialPlannerState();
  initialData.stage = 'welcome';
  return {
    version: 3,
    stage: 'welcome',
    hasOpenedApp: false,
    activePlannerId: 'planner-initial',
    planners: [
      {
        plannerId: 'planner-initial',
        name: '나의 플래너',
        createdAt: nowIso,
        updatedAt: nowIso,
        data: initialData,
      },
    ],
  };
}

export function getActivePlannerRecord(workspace: PlannerWorkspace): PlannerRecord {
  return (
    workspace.planners.find((p) => p.plannerId === workspace.activePlannerId) ??
    workspace.planners[0]
  );
}

export function sanitizePlannerWorkspace(raw: unknown): PlannerWorkspace {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return createInitialWorkspace();
  }
  const obj = raw as Record<string, unknown>;

  // Multi-planner v3 format
  if (Array.isArray(obj.planners)) {
    const seenIds = new Set<string>();
    const planners: PlannerRecord[] = [];
    const nowIso = new Date().toISOString();

    for (const item of obj.planners) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Partial<PlannerRecord>;
      let pid =
        typeof rec.plannerId === 'string' && rec.plannerId.trim()
          ? rec.plannerId.trim()
          : `planner-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      while (seenIds.has(pid)) {
        pid = `${pid}-${Math.random().toString(36).slice(2, 5)}`;
      }
      seenIds.add(pid);

      const sanitizedData = sanitizePlannerState(
        rec.data && typeof rec.data === 'object' ? rec.data : {},
        createInitialPlannerState()
      );
      sanitizedData.stage = 'app';

      planners.push({
        plannerId: pid,
        name:
          typeof rec.name === 'string' && rec.name.trim()
            ? rec.name.trim().slice(0, 40)
            : `플래너 ${planners.length + 1}`,
        createdAt: typeof rec.createdAt === 'string' ? rec.createdAt : nowIso,
        updatedAt: typeof rec.updatedAt === 'string' ? rec.updatedAt : nowIso,
        data: sanitizedData,
      });
    }

    if (planners.length === 0) {
      return createInitialWorkspace();
    }

    const activeId =
      typeof obj.activePlannerId === 'string' &&
      planners.some((p) => p.plannerId === obj.activePlannerId)
        ? obj.activePlannerId
        : planners[0].plannerId;

    const stage = VALID_STAGES.has(obj.stage as AppStage)
      ? (obj.stage as AppStage)
      : 'app';

    const anyHasData = planners.some((p) => hasPlannerUserData(p.data));
    return {
      version: 3,
      stage,
      hasOpenedApp:
        typeof obj.hasOpenedApp === 'boolean'
          ? obj.hasOpenedApp
          : stage === 'app' || anyHasData || planners.length > 1,
      activePlannerId: activeId,
      planners,
    };
  }

  // Legacy single-planner (v1/v2) migration -> preserve into first PlannerRecord
  const legacyState = sanitizePlannerState(obj as Partial<PlannerState>, createInitialPlannerState());
  const nowIso = new Date().toISOString();
  const stage = legacyState.stage;
  const legacyData: PlannerState = { ...legacyState, stage: 'app' };
  return {
    version: 3,
    stage,
    hasOpenedApp: stage === 'app' || hasPlannerUserData(legacyData),
    activePlannerId: 'planner-initial',
    planners: [
      {
        plannerId: 'planner-initial',
        name: '나의 플래너',
        createdAt: nowIso,
        updatedAt: nowIso,
        data: legacyData,
      },
    ],
  };
}

export function loadPlannerWorkspace(): PlannerWorkspace {
  const fallback = createInitialWorkspace();
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    return sanitizePlannerWorkspace(parsed);
  } catch {
    return fallback;
  }
}

export function savePlannerWorkspace(workspace: PlannerWorkspace): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const serialized = JSON.stringify(workspace);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    const verified = window.localStorage.getItem(STORAGE_KEY);
    return typeof verified === 'string' && verified.length > 0;
  } catch {
    return false;
  }
}

export function createBlankPlannerInWorkspace(
  workspace: PlannerWorkspace,
  options?: {
    name?: string;
    reuseUnusedInitial?: boolean;
    patchData?: (fresh: PlannerState) => PlannerState;
  }
): { nextWorkspace: PlannerWorkspace; newPlanner: PlannerRecord } {
  const canReuseInitial =
    Boolean(options?.reuseUnusedInitial) &&
    !workspace.hasOpenedApp &&
    workspace.planners.length === 1 &&
    !hasPlannerUserData(workspace.planners[0].data);

  if (canReuseInitial) {
    const fresh = createInitialPlannerState();
    fresh.stage = 'app';
    const patched = options?.patchData ? options.patchData(fresh) : fresh;
    const updatedInitial: PlannerRecord = {
      ...workspace.planners[0],
      name: options?.name?.trim() || workspace.planners[0].name,
      updatedAt: new Date().toISOString(),
      data: patched,
    };
    return {
      newPlanner: updatedInitial,
      nextWorkspace: {
        ...workspace,
        stage: 'app',
        hasOpenedApp: true,
        activePlannerId: updatedInitial.plannerId,
        planners: [updatedInitial],
      },
    };
  }

  const newRecord = createBlankPlannerRecord(workspace.planners, {
    name: options?.name,
    patchData: options?.patchData,
  });

  return {
    newPlanner: newRecord,
    nextWorkspace: {
      ...workspace,
      stage: 'app',
      hasOpenedApp: true,
      activePlannerId: newRecord.plannerId,
      planners: [...workspace.planners, newRecord],
    },
  };
}

export function switchActivePlannerInWorkspace(
  workspace: PlannerWorkspace,
  plannerId: string
): PlannerWorkspace {
  if (!workspace.planners.some((p) => p.plannerId === plannerId)) {
    return workspace;
  }
  return {
    ...workspace,
    stage: 'app',
    hasOpenedApp: true,
    activePlannerId: plannerId,
  };
}

export function renamePlannerInWorkspace(
  workspace: PlannerWorkspace,
  plannerId: string,
  newName: string
): PlannerWorkspace {
  const trimmed = newName.trim().slice(0, 40);
  if (!trimmed) return workspace;
  return {
    ...workspace,
    planners: workspace.planners.map((p) =>
      p.plannerId === plannerId
        ? { ...p, name: trimmed, updatedAt: new Date().toISOString() }
        : p
    ),
  };
}

export function deletePlannerInWorkspace(
  workspace: PlannerWorkspace,
  plannerId: string
): { ok: true; nextWorkspace: PlannerWorkspace } | { ok: false; error: string; nextWorkspace: PlannerWorkspace } {
  if (workspace.planners.length <= 1) {
    return {
      ok: false,
      error: '최소 1개의 플래너는 유지되어야 합니다. 새 빈 플래너를 먼저 만든 뒤 삭제할 수 있습니다.',
      nextWorkspace: workspace,
    };
  }
  const exists = workspace.planners.some((p) => p.plannerId === plannerId);
  if (!exists) {
    return { ok: false, error: '삭제할 플래너를 찾지 못했습니다.', nextWorkspace: workspace };
  }
  const remaining = workspace.planners.filter((p) => p.plannerId !== plannerId);
  const nextActiveId =
    workspace.activePlannerId === plannerId ? remaining[0].plannerId : workspace.activePlannerId;

  return {
    ok: true,
    nextWorkspace: {
      ...workspace,
      activePlannerId: nextActiveId,
      planners: remaining,
    },
  };
}

export function updateActivePlannerDataInWorkspace(
  workspace: PlannerWorkspace,
  updater: (prev: PlannerState) => PlannerState
): PlannerWorkspace {
  const nowIso = new Date().toISOString();
  return {
    ...workspace,
    planners: workspace.planners.map((p) =>
      p.plannerId === workspace.activePlannerId
        ? { ...p, updatedAt: nowIso, data: updater(p.data) }
        : p
    ),
  };
}

export function loadPlannerState(): PlannerState {
  const ws = loadPlannerWorkspace();
  return getActivePlannerRecord(ws).data;
}

export function validateImportedBackup(
  rawJson: string
):
  | { ok: true; kind: 'workspace'; workspace: PlannerWorkspace }
  | { ok: true; kind: 'single'; state: PlannerState }
  | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: '올바른 MY DAY 백업 JSON 형식이 아닙니다.' };
    }
    if (Array.isArray(parsed.planners)) {
      const ws = sanitizePlannerWorkspace(parsed);
      ws.stage = 'app';
      ws.hasOpenedApp = true;
      return { ok: true, kind: 'workspace', workspace: ws };
    }
    const single = parsed as Partial<PlannerState>;
    const hasCoreShape =
      Array.isArray(single.schedules) ||
      Array.isArray(single.todos) ||
      Boolean(single.design) ||
      Boolean(single.profile);
    if (!hasCoreShape) {
      return {
        ok: false,
        error: 'MY DAY 플래너 데이터(일정·할 일·설정)가 포함되어 있지 않습니다.',
      };
    }
    const restored = sanitizePlannerState(single);
    restored.stage = 'app';
    return { ok: true, kind: 'single', state: restored };
  } catch {
    return { ok: false, error: 'JSON 파일을 읽을 수 없습니다. 파일이 손상되지 않았는지 확인해 주세요.' };
  }
}

export function validateImportedPlannerState(
  rawJson: string
): { ok: true; state: PlannerState } | { ok: false; error: string } {
  const res = validateImportedBackup(rawJson);
  if (!res.ok) return res;
  if (res.kind === 'workspace') {
    return { ok: true, state: getActivePlannerRecord(res.workspace).data };
  }
  return { ok: true, state: res.state };
}

export function savePlannerState(state: PlannerState): boolean {
  if (typeof window === 'undefined') return false;
  const currentWs = loadPlannerWorkspace();
  const nextWs = updateActivePlannerDataInWorkspace(currentWs, () => state);
  return savePlannerWorkspace(nextWs);
}

export function clearPlannerStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

const USER_CACHE_PREFIX = 'myday_workspace_uid_v1_';
const PENDING_SYNC_PREFIX = 'myday_pending_sync_v1_';
const MIGRATED_UID_PREFIX = 'myday_migrated_guest_v1_';

export function sanitizeFirestoreDocId(rawId: string, fallback = 'planner-initial'): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned.length > 0 ? cleaned : fallback;
}

export function loadUserCachedWorkspace(uid: string): PlannerWorkspace | null {
  if (typeof window === 'undefined' || !uid) return null;
  try {
    const raw = window.localStorage.getItem(`${USER_CACHE_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return sanitizePlannerWorkspace(parsed);
  } catch {
    return null;
  }
}

export function saveUserCachedWorkspace(uid: string, workspace: PlannerWorkspace): boolean {
  if (typeof window === 'undefined' || !uid) return false;
  try {
    window.localStorage.setItem(`${USER_CACHE_PREFIX}${uid}`, JSON.stringify(workspace));
    return true;
  } catch {
    return false;
  }
}

export function loadPendingSyncFlag(uid: string): boolean {
  if (typeof window === 'undefined' || !uid) return false;
  try {
    return window.localStorage.getItem(`${PENDING_SYNC_PREFIX}${uid}`) === '1';
  } catch {
    return false;
  }
}

export function setPendingSyncFlag(uid: string, dirty: boolean): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    if (dirty) {
      window.localStorage.setItem(`${PENDING_SYNC_PREFIX}${uid}`, '1');
    } else {
      window.localStorage.removeItem(`${PENDING_SYNC_PREFIX}${uid}`);
    }
  } catch {
    // Ignore
  }
}

export function hasMigratedGuestToUid(uid: string): boolean {
  if (typeof window === 'undefined' || !uid) return false;
  try {
    return window.localStorage.getItem(`${MIGRATED_UID_PREFIX}${uid}`) === '1';
  } catch {
    return false;
  }
}

export function markGuestMigratedToUid(uid: string): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    window.localStorage.setItem(`${MIGRATED_UID_PREFIX}${uid}`, '1');
  } catch {
    // Ignore
  }
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

export function preparePlannerStateForFirestore(rawState: PlannerState): PlannerState {
  const clean = sanitizePlannerState(rawState);

  const boundedCategoryColors: Record<string, string> = {};
  let colorCount = 0;
  for (const [k, v] of Object.entries(clean.categoryColors || {})) {
    if (colorCount >= 50) break;
    if (typeof v === 'string') {
      boundedCategoryColors[k.slice(0, 40)] = v.slice(0, 32);
      colorCount += 1;
    }
  }

  const normalized: PlannerState = {
    version: 2,
    stage: VALID_STAGES.has(clean.stage) ? clean.stage : 'app',
    profile: {
      ageGroup: clean.profile.ageGroup,
      gender: clean.profile.gender ?? '선택 안 함',
      lifestyle: clean.profile.lifestyle,
      purposes: Array.isArray(clean.profile.purposes)
        ? clean.profile.purposes.filter((p): p is string => typeof p === 'string').slice(0, 20)
        : [],
      busyHours: Array.isArray(clean.profile.busyHours)
        ? clean.profile.busyHours.filter((b): b is string => typeof b === 'string').slice(0, 24)
        : [],
      weeklyGoal:
        typeof clean.profile.weeklyGoal === 'string'
          ? clean.profile.weeklyGoal.slice(0, 300)
          : '',
    },
    design: {
      theme: clean.design.theme,
      accent: clean.design.accent,
      font: clean.design.font,
      defaultView: clean.design.defaultView,
      layout: clean.design.layout,
      weekStart: clean.design.weekStart,
      timeFormat: clean.design.timeFormat,
    },
    notifications: {
      conflictAlert: Boolean(clean.notifications.conflictAlert),
      deadlineAlert: Boolean(clean.notifications.deadlineAlert),
      dailySummary: Boolean(clean.notifications.dailySummary),
      summaryTime: String(clean.notifications.summaryTime || '08:00').slice(0, 10),
    },
    categoryColors: boundedCategoryColors,
    monthlyBudget:
      typeof clean.monthlyBudget === 'number' &&
      Number.isFinite(clean.monthlyBudget) &&
      clean.monthlyBudget >= 0
        ? clean.monthlyBudget
        : 0,
    widgets: clean.widgets.slice(0, 50),
    customWidgets: clean.customWidgets.slice(0, 30),
    schedules: clean.schedules.slice(0, 1000),
    todos: clean.todos.slice(0, 1000),
    habits: clean.habits.slice(0, 100),
    ddays: clean.ddays.slice(0, 100),
    focusEntries: clean.focusEntries.slice(0, 500),
    expenses: clean.expenses.slice(0, 1000),
    notes: clean.notes.slice(0, 500),
    routines: clean.routines.slice(0, 100),
    checklists: clean.checklists.slice(0, 500),
  };

  return stripUndefinedDeep(normalized);
}
