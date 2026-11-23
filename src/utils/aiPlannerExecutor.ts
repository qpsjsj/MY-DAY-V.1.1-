import {
  AccentId,
  AiPlanProposal,
  BuiltinWidgetId,
  CalendarViewMode,
  CustomWidget,
  CustomWidgetKind,
  DDayItem,
  ExpenseItem,
  FontChoice,
  ImportanceLevel,
  LayoutStyle,
  PlannerState,
  RepeatRule,
  ScheduleEvent,
  ThemeId,
} from '../types/planner';
import {
  addDaysYmd,
  detectScheduleConflicts,
  getSchedulesForDate,
  isValidHhmm,
  isValidYmd,
  timeToMinutes,
} from './dateKst';

const VALID_THEMES: ReadonlySet<ThemeId> = new Set([
  'cream',
  'white',
  'sage',
  'lavender',
  'pastel',
  'monotone',
  'dark',
]);

const VALID_ACCENTS: ReadonlySet<AccentId> = new Set([
  'sage',
  'lavender',
  'charcoal',
  'ocean',
  'coral',
  'forest',
]);

const VALID_FONTS: ReadonlySet<FontChoice> = new Set([
  'sans',
  'rounded',
  'serif',
  'mono',
]);

const VALID_VIEWS: ReadonlySet<CalendarViewMode> = new Set([
  'month',
  'week',
  'day',
]);

const VALID_LAYOUTS: ReadonlySet<LayoutStyle> = new Set([
  'simple',
  'diary',
  'timetable',
]);

const VALID_BUILTIN_WIDGETS: ReadonlySet<BuiltinWidgetId> = new Set([
  'todos',
  'dday',
  'habits',
  'focus',
  'expenses',
  'notes',
  'routines',
  'checklists',
  'ai_recommend',
]);

const VALID_IMPORTANCE: ReadonlySet<ImportanceLevel> = new Set([
  'high',
  'medium',
  'low',
]);

const VALID_REPEAT: ReadonlySet<RepeatRule> = new Set([
  'none',
  'daily',
  'weekly',
  'monthly',
]);

const VALID_CUSTOM_KINDS: ReadonlySet<CustomWidgetKind> = new Set([
  'checklist',
  'counter',
  'note_list',
  'exam_study',
]);

// Strict calendar & time validators imported from ./dateKst

function validateScheduleTimeRange(
  startRaw: unknown,
  endRaw: unknown
): { ok: true; startTime: string; endTime: string } | { ok: false; error: string } {
  const startStr = typeof startRaw === 'string' ? startRaw.trim() : '';
  const endStr = typeof endRaw === 'string' ? endRaw.trim() : '';

  if (!startStr && !endStr) {
    return { ok: true, startTime: '', endTime: '' };
  }
  if (!startStr && endStr) {
    return { ok: false, error: '종료 시간만 있고 시작 시간이 없어 일정을 등록할 수 없습니다.' };
  }
  if (!isValidHhmm(startStr)) {
    return { ok: false, error: `올바르지 않은 시작 시간("${startStr}")입니다.` };
  }

  if (!endStr) {
    const startMin = timeToMinutes(startStr);
    if (startMin >= 23 * 60 + 59) {
      return { ok: false, error: '23:59 시작 일정은 종료 시간을 함께 지정해 주세요.' };
    }
    const endMin = Math.min(23 * 60 + 59, startMin + 60);
    const h = String(Math.floor(endMin / 60)).padStart(2, '0');
    const m = String(endMin % 60).padStart(2, '0');
    return { ok: true, startTime: startStr, endTime: `${h}:${m}` };
  }

  if (!isValidHhmm(endStr)) {
    return { ok: false, error: `올바르지 않은 종료 시간("${endStr}")입니다.` };
  }
  if (timeToMinutes(endStr) <= timeToMinutes(startStr)) {
    return { ok: false, error: '종료 시간은 시작 시간보다 늦어야 합니다.' };
  }
  return { ok: true, startTime: startStr, endTime: endStr };
}

function sanitizeText(value: unknown, fallback: string, maxLen = 120): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLen) : fallback;
}

/**
 * Deterministic policy guard: forces confirmation before destructive operations
 * (schedule/todo deletion) or multi-item changes (2+ schedules, bulk todo move, todo split, new widget).
 */
export function requiresUserConfirmation(proposal: AiPlanProposal): boolean {
  if (proposal.requiresConfirmation) return true;
  if (!Array.isArray(proposal.operations)) return false;

  let scheduleMutationCount = 0;
  for (const op of proposal.operations) {
    if (op.op === 'delete_schedule' || op.op === 'delete_todo') {
      return true;
    }
    if (
      op.op === 'move_unfinished_todos' ||
      op.op === 'split_todo' ||
      op.op === 'create_custom_widget'
    ) {
      return true;
    }
    if (op.op === 'add_schedule' || op.op === 'update_schedule') {
      scheduleMutationCount += 1;
    }
  }
  return scheduleMutationCount >= 2;
}

export interface AiExecutionResult {
  nextState: PlannerState;
  appliedCount: number;
  syncedDefaultView?: CalendarViewMode;
  touchedDates: string[];
  appliedSummaries: string[];
  warnings: string[];
  errors: string[];
}

/**
 * Executes structured AI operations strictly through verified, type-checked state mutations.
 */
export function executeVerifiedAiProposal(
  prev: PlannerState,
  proposal: AiPlanProposal,
  context: { todayKst: string; selectedDate: string }
): AiExecutionResult {
  const next: PlannerState = {
    ...prev,
    design: { ...prev.design },
    widgets: [...prev.widgets],
    customWidgets: [...prev.customWidgets],
    schedules: [...prev.schedules],
    todos: [...prev.todos],
    ddays: [...prev.ddays],
    expenses: [...prev.expenses],
    habits: [...prev.habits],
    notes: [...prev.notes],
  };

  let appliedCount = 0;
  let syncedDefaultView: CalendarViewMode | undefined;
  const touchedScheduleDates = new Set<string>();
  const appliedSummaries: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const opItem of proposal.operations || []) {
    const p = (opItem.payload && typeof opItem.payload === 'object'
      ? opItem.payload
      : {}) as Record<string, unknown>;

    switch (opItem.op) {
      case 'add_schedule': {
        const title = sanitizeText(p.title, '', 100);
        if (!title) {
          errors.push('일정 제목이 비어 있어 일정을 등록하지 않았습니다.');
          break;
        }
        if (!isValidYmd(p.date)) {
          errors.push(
            `유효하지 않은 일정 날짜("${String(p.date ?? '미지정')}")여서 일정을 등록하지 않았습니다.`
          );
          break;
        }
        const date = p.date.trim();
        const timeResult = validateScheduleTimeRange(p.startTime, p.endTime);
        if (!timeResult.ok) {
          errors.push(timeResult.error);
          break;
        }
        const { startTime, endTime } = timeResult;

        const isDuplicate = next.schedules.some(
          (ev) =>
            ev.title.trim().toLowerCase() === title.toLowerCase() &&
            ev.date === date &&
            ev.startTime === startTime &&
            ev.endTime === endTime
        );
        if (isDuplicate) {
          warnings.push(`이미 같은 일정(${date} '${title}')이 등록되어 있어 중복 추가하지 않았습니다.`);
          break;
        }

        const importance = VALID_IMPORTANCE.has(p.importance as ImportanceLevel)
          ? (p.importance as ImportanceLevel)
          : 'medium';
        const repeat = VALID_REPEAT.has(p.repeat as RepeatRule)
          ? (p.repeat as RepeatRule)
          : 'none';
        const weekdays =
          repeat === 'weekly' && Array.isArray(p.weekdays)
            ? p.weekdays.filter(
                (n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 6
              )
            : undefined;

        const newEv: ScheduleEvent = {
          id: `sch-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title,
          date,
          startTime,
          endTime,
          memo: sanitizeText(p.memo, '', 300),
          category: sanitizeText(p.category, '기타', 30),
          importance,
          repeat,
          weekdays: weekdays && weekdays.length > 0 ? weekdays : undefined,
        };
        next.schedules.push(newEv);
        touchedScheduleDates.add(date);
        appliedCount += 1;
        appliedSummaries.push(
          `${date} ${startTime ? `${startTime}~${endTime}` : '(시간 미정)'} '${title}' 일정이 등록되었습니다.`
        );
        break;
      }

      case 'update_schedule': {
        const id = typeof p.id === 'string' ? p.id.trim() : '';
        const matchTitle = sanitizeText(p.targetTitle ?? p.title, '', 100).toLowerCase();

        let targetIdx = id ? next.schedules.findIndex((ev) => ev.id === id) : -1;
        if (targetIdx === -1 && matchTitle) {
          targetIdx = next.schedules.findIndex(
            (ev) => ev.title.trim().toLowerCase() === matchTitle
          );
        }
        if (targetIdx === -1) {
          errors.push('수정할 일정을 찾지 못했습니다.');
          break;
        }

        const existing = next.schedules[targetIdx];
        if (p.date !== undefined && String(p.date).trim() !== '' && !isValidYmd(p.date)) {
          errors.push(`유효하지 않은 날짜("${String(p.date)}")여서 일정을 수정하지 않았습니다.`);
          break;
        }
        const nextDate = isValidYmd(p.date) ? p.date.trim() : existing.date;
        const rawStart = p.startTime !== undefined ? p.startTime : existing.startTime;
        const rawEnd = p.endTime !== undefined ? p.endTime : existing.endTime;
        const timeResult = validateScheduleTimeRange(rawStart, rawEnd);
        if (!timeResult.ok) {
          errors.push(timeResult.error);
          break;
        }
        const { startTime, endTime } = timeResult;
        const nextTitle = sanitizeText(p.title, existing.title, 100);

        const nextRepeat = VALID_REPEAT.has(p.repeat as RepeatRule)
          ? (p.repeat as RepeatRule)
          : existing.repeat;
        const nextWeekdays =
          nextRepeat === 'weekly' && Array.isArray(p.weekdays)
            ? p.weekdays.filter(
                (n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 6
              )
            : nextRepeat === 'weekly'
            ? existing.weekdays
            : undefined;

        next.schedules[targetIdx] = {
          ...existing,
          title: nextTitle,
          date: nextDate,
          startTime,
          endTime,
          memo: p.memo !== undefined ? sanitizeText(p.memo, existing.memo, 300) : existing.memo,
          category: p.category
            ? sanitizeText(p.category, existing.category, 30)
            : existing.category,
          importance: VALID_IMPORTANCE.has(p.importance as ImportanceLevel)
            ? (p.importance as ImportanceLevel)
            : existing.importance,
          repeat: nextRepeat,
          weekdays: nextWeekdays && nextWeekdays.length > 0 ? nextWeekdays : undefined,
        };
        touchedScheduleDates.add(nextDate);
        appliedCount += 1;
        appliedSummaries.push(
          `${nextDate} ${startTime ? `${startTime}~${endTime}` : '(시간 미정)'} '${nextTitle}' 일정이 수정되었습니다.`
        );
        break;
      }

      case 'delete_schedule': {
        const id = typeof p.id === 'string' ? p.id.trim() : '';
        const matchTitle = sanitizeText(p.targetTitle ?? p.title, '', 100).toLowerCase();
        const before = next.schedules.length;
        next.schedules = next.schedules.filter((ev) => {
          if (id && ev.id === id) return false;
          if (!id && matchTitle && ev.title.trim().toLowerCase() === matchTitle) return false;
          return true;
        });
        if (next.schedules.length < before) {
          appliedCount += 1;
          appliedSummaries.push('요청한 일정이 삭제되었습니다.');
        } else {
          errors.push('삭제할 일정을 찾지 못했습니다.');
        }
        break;
      }

      case 'add_todo': {
        const title = sanitizeText(p.title, '', 120);
        if (!title) {
          errors.push('할 일 제목이 비어 있어 추가하지 않았습니다.');
          break;
        }
        const hasExplicitDate = typeof p.date === 'string' && p.date.trim().length > 0;
        if (hasExplicitDate && !isValidYmd(p.date)) {
          errors.push(`유효하지 않은 날짜("${String(p.date)}")여서 할 일을 추가하지 않았습니다.`);
          break;
        }
        const dueDate = isValidYmd(p.date) ? p.date.trim() : context.selectedDate;
        const importance = VALID_IMPORTANCE.has(p.importance as ImportanceLevel)
          ? (p.importance as ImportanceLevel)
          : 'medium';
        next.todos.unshift({
          id: `todo-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title,
          completed: false,
          importance,
          dueDate,
          category: sanitizeText(p.category, '할 일', 30),
        });
        appliedCount += 1;
        break;
      }

      case 'split_todo': {
        const id = typeof p.id === 'string' ? p.id.trim() : '';
        const sourceTitle = sanitizeText(p.sourceTitle ?? p.title, '', 120).toLowerCase();
        const rawSubtasks = Array.isArray(p.subtasks)
          ? p.subtasks
          : Array.isArray(p.items)
          ? p.items
          : [];

        const validSubtasks = rawSubtasks
          .map((sub, idx) => {
            if (typeof sub === 'string') {
              const title = sanitizeText(sub, '', 120);
              if (!title) return null;
              return {
                id: `todo-sub-${Date.now()}-${idx}`,
                title,
                completed: false,
                importance: 'medium' as ImportanceLevel,
                dueDate: context.selectedDate,
                category: '할 일',
              };
            }
            if (sub && typeof sub === 'object') {
              const obj = sub as Record<string, unknown>;
              const title = sanitizeText(obj.title ?? obj.label, '', 120);
              if (!title) return null;
              return {
                id: `todo-sub-${Date.now()}-${idx}`,
                title,
                completed: false,
                importance: VALID_IMPORTANCE.has(obj.importance as ImportanceLevel)
                  ? (obj.importance as ImportanceLevel)
                  : ('medium' as ImportanceLevel),
                dueDate: isValidYmd(obj.date) ? obj.date.trim() : context.selectedDate,
                category: sanitizeText(obj.category, '할 일', 30),
              };
            }
            return null;
          })
          .filter((t): t is NonNullable<typeof t> => t !== null);

        if (validSubtasks.length === 0) break;

        let targetTodoIdx = id ? next.todos.findIndex((t) => t.id === id) : -1;
        if (targetTodoIdx === -1 && sourceTitle) {
          targetTodoIdx = next.todos.findIndex(
            (t) => t.title.trim().toLowerCase().includes(sourceTitle)
          );
        }

        if (targetTodoIdx !== -1) {
          const parentTodo = next.todos[targetTodoIdx];
          const subtasksWithParentDefaults = validSubtasks.map((st) => ({
            ...st,
            dueDate: st.dueDate || parentTodo.dueDate,
            category: parentTodo.category || st.category,
          }));
          next.todos.splice(targetTodoIdx, 1, ...subtasksWithParentDefaults);
        } else {
          next.todos = [...validSubtasks, ...next.todos];
        }
        appliedCount += 1;
        break;
      }

      case 'delete_todo': {
        const id = typeof p.id === 'string' ? p.id.trim() : '';
        const matchTitle = sanitizeText(p.title, '', 120).toLowerCase();
        const before = next.todos.length;
        next.todos = next.todos.filter((t) => {
          if (id && t.id === id) return false;
          if (!id && matchTitle && t.title.trim().toLowerCase() === matchTitle) return false;
          return true;
        });
        if (next.todos.length < before) appliedCount += 1;
        break;
      }

      case 'move_unfinished_todos': {
        const target = isValidYmd(p.targetDate)
          ? p.targetDate.trim()
          : addDaysYmd(context.todayKst, 1);
        next.todos = next.todos.map((t) =>
          !t.completed ? { ...t, dueDate: target } : t
        );
        appliedCount += 1;
        break;
      }

      case 'toggle_todo': {
        const id = typeof p.id === 'string' ? p.id.trim() : '';
        const matchTitle = sanitizeText(p.title, '', 120).toLowerCase();
        next.todos = next.todos.map((t) => {
          if (id && t.id === id) {
            appliedCount += 1;
            return { ...t, completed: !t.completed };
          }
          if (!id && matchTitle && t.title.trim().toLowerCase() === matchTitle) {
            appliedCount += 1;
            return { ...t, completed: !t.completed };
          }
          return t;
        });
        break;
      }

      case 'update_design': {
        let changed = false;
        if (VALID_THEMES.has(p.theme as ThemeId)) {
          next.design.theme = p.theme as ThemeId;
          changed = true;
        }
        if (VALID_ACCENTS.has(p.accent as AccentId)) {
          next.design.accent = p.accent as AccentId;
          changed = true;
        }
        if (VALID_FONTS.has(p.font as FontChoice)) {
          next.design.font = p.font as FontChoice;
          changed = true;
        }
        if (VALID_VIEWS.has(p.defaultView as CalendarViewMode)) {
          next.design.defaultView = p.defaultView as CalendarViewMode;
          syncedDefaultView = p.defaultView as CalendarViewMode;
          changed = true;
        }
        if (VALID_LAYOUTS.has(p.layout as LayoutStyle)) {
          next.design.layout = p.layout as LayoutStyle;
          changed = true;
        }
        if (changed) appliedCount += 1;
        break;
      }

      case 'toggle_widget': {
        const widgetId = typeof p.widgetId === 'string' ? p.widgetId.trim() : '';
        const isKnownBuiltin = VALID_BUILTIN_WIDGETS.has(widgetId as BuiltinWidgetId);
        const isKnownCustom = next.customWidgets.some((c) => c.id === widgetId);
        if (!isKnownBuiltin && !isKnownCustom) break;

        const desiredVisible = typeof p.visible === 'boolean' ? p.visible : true;
        const exists = next.widgets.some((w) => w.id === widgetId);
        if (exists) {
          next.widgets = next.widgets.map((w) =>
            w.id === widgetId ? { ...w, visible: desiredVisible } : w
          );
        } else {
          next.widgets.push({
            id: widgetId,
            type: isKnownCustom ? 'custom' : 'builtin',
            visible: desiredVisible,
            size: widgetId === 'ai_recommend' ? 'wide' : 'compact',
          });
        }
        appliedCount += 1;
        break;
      }

      case 'create_custom_widget': {
        const widgetTitle = sanitizeText(p.widgetTitle ?? p.title, '', 60);
        if (!widgetTitle) break;
        const cwId = `cw-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const rawItems = Array.isArray(p.items) ? p.items : [];
        const mappedItems = rawItems
          .map((it, idx) => {
            const obj = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>;
            const label = sanitizeText(obj.label ?? obj.title, '', 100);
            if (!label) return null;
            return {
              id: `cw-it-${Date.now()}-${idx}`,
              label,
              detail: obj.detail ? sanitizeText(obj.detail, '', 160) : undefined,
              date: isValidYmd(obj.date) ? obj.date.trim() : undefined,
              target:
                typeof obj.target === 'number' && obj.target > 0
                  ? Math.round(obj.target)
                  : undefined,
              value: 0,
              checked: false,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);

        const cw: CustomWidget = {
          id: cwId,
          title: widgetTitle,
          description: sanitizeText(p.widgetDescription, '', 160),
          kind: VALID_CUSTOM_KINDS.has(p.widgetKind as CustomWidgetKind)
            ? (p.widgetKind as CustomWidgetKind)
            : 'checklist',
          items: mappedItems,
        };
        next.customWidgets.push(cw);
        next.widgets.unshift({
          id: cwId,
          type: 'custom',
          visible: true,
          size: 'compact',
        });
        appliedCount += 1;
        break;
      }

      case 'add_dday': {
        const title = sanitizeText(p.title, '', 80);
        if (!title) break;
        const rawDate = p.date ?? p.targetDate;
        const hasExplicitDate = typeof rawDate === 'string' && rawDate.trim().length > 0;
        const validDate = isValidYmd(rawDate)
          ? rawDate.trim()
          : addDaysYmd(context.todayKst, 7);
        if (hasExplicitDate && !isValidYmd(rawDate)) {
          warnings.push(`유효하지 않은 D-day 날짜("${String(rawDate)}") 대신 ${validDate}로 설정했습니다.`);
        }
        const validCats: DDayItem['category'][] = ['시험', '자격증', '생일', '기념일', '기타'];
        const category = validCats.includes(p.category as DDayItem['category'])
          ? (p.category as DDayItem['category'])
          : '기타';
        next.ddays.push({
          id: `dd-ai-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          title,
          targetDate: validDate,
          category,
        });
        appliedCount += 1;
        break;
      }

      case 'add_expense': {
        const title = sanitizeText(p.title, '', 80);
        const amt = Number(p.amount);
        if (!title || Number.isNaN(amt) || amt <= 0) break;
        const validCats: ExpenseItem['category'][] = ['식비', '교통', '쇼핑', '생활', '학습', '기타'];
        const category = validCats.includes(p.category as ExpenseItem['category'])
          ? (p.category as ExpenseItem['category'])
          : '기타';
        next.expenses.unshift({
          id: `exp-ai-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          title,
          amount: Math.round(amt),
          date: isValidYmd(p.date) ? p.date.trim() : context.todayKst,
          category,
          type: 'expense',
        });
        appliedCount += 1;
        break;
      }

      case 'add_habit': {
        const title = sanitizeText(p.title, '', 80);
        if (!title) break;
        const target =
          typeof p.targetPerWeek === 'number' && p.targetPerWeek >= 1 && p.targetPerWeek <= 7
            ? Math.round(p.targetPerWeek)
            : 7;
        next.habits.push({
          id: `hab-ai-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          title,
          completedDates: [],
          targetPerWeek: target,
        });
        appliedCount += 1;
        break;
      }

      case 'add_note': {
        const title = sanitizeText(p.title, '메모', 80);
        const content = sanitizeText(p.content ?? p.memo, '', 1000);
        if (!title && !content) break;
        next.notes.unshift({
          id: `note-ai-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          title,
          content,
          date: isValidYmd(p.date) ? p.date.trim() : context.selectedDate,
          updatedAt: new Date().toISOString(),
        });
        appliedCount += 1;
        break;
      }
    }
  }

  // Check for newly created schedule time conflicts on touched dates
  if (next.notifications.conflictAlert && touchedScheduleDates.size > 0) {
    for (const ymd of touchedScheduleDates) {
      const conflicts = detectScheduleConflicts(getSchedulesForDate(next.schedules, ymd));
      if (conflicts.length > 0) {
        warnings.push(
          `${ymd} 일정 중 시간이 겹치는 항목이 있습니다 (${conflicts
            .map((c) => `${c.a.title} · ${c.b.title}`)
            .join(', ')}).`
        );
      }
    }
  }

  return {
    nextState: next,
    appliedCount,
    syncedDefaultView,
    touchedDates: Array.from(touchedScheduleDates),
    appliedSummaries,
    warnings,
    errors,
  };
}
