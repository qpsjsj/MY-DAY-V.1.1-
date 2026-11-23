import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Plus, Sparkles, Trash2 } from 'lucide-react';
import {
  ChecklistItem,
  DDayItem,
  RoutineItem,
  ScheduleEvent,
  TodoItem,
  UserProfile,
} from '../../types/planner';
import {
  detectScheduleConflicts,
  diffDaysYmd,
  getSchedulesForDate,
  timeToMinutes,
} from '../../utils/dateKst';

interface RoutineWidgetProps {
  todayKst: string;
  routines: RoutineItem[];
  onAddRoutine: (item: RoutineItem) => void;
  onToggleRoutineToday: (id: string, dateYmd: string) => void;
  onDeleteRoutine: (id: string) => void;
}

export const RoutineWidget: React.FC<RoutineWidgetProps> = ({
  todayKst,
  routines,
  onAddRoutine,
  onToggleRoutineToday,
  onDeleteRoutine,
}) => {
  const [title, setTitle] = useState('');
  const [timeOfDay, setTimeOfDay] = useState<RoutineItem['timeOfDay']>('운동');
  const [durationMinutes, setDurationMinutes] = useState(20);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const clampedDuration = Math.min(600, Math.max(5, Number(durationMinutes) || 20));
    onAddRoutine({
      id: `rtn-${Date.now()}`,
      title: title.trim(),
      timeOfDay,
      durationMinutes: clampedDuration,
      completedDates: [],
    });
    setTitle('');
  };

  return (
    <div className="planner-surface rounded-2xl p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold">운동 및 개인 루틴</h3>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          시간대별 루틴과 운동 습관을 체크하세요.
        </p>
      </div>

      <form onSubmit={handleAdd} className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="루틴 또는 운동 이름"
            className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-sm"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            className="px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 cursor-pointer shrink-0 inline-flex items-center gap-1"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-contrast)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>추가</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <select
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(e.target.value as RoutineItem['timeOfDay'])}
            aria-label="루틴 시간대"
            className="px-2.5 py-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
          >
            {(['아침', '오후', '저녁', '운동'] as const).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={5}
            max={600}
            step={5}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            aria-label="소요 시간(분)"
            className="w-16 px-2 py-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] tabular-nums"
          />
          <span className="text-[var(--text-muted)]">분</span>
        </div>
      </form>

      <div className="space-y-1.5 max-h-[230px] overflow-y-auto pr-1">
        {routines.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] py-5 text-center">
            등록된 루틴이 없습니다.
          </p>
        ) : (
          routines.map((r) => {
            const done = r.completedDates.includes(todayKst);
            return (
              <div
                key={r.id}
                className="group p-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] flex items-center justify-between gap-2"
              >
                <button
                  type="button"
                  onClick={() => onToggleRoutineToday(r.id, todayKst)}
                  className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      done
                        ? 'border-transparent'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-surface)]'
                    }`}
                    style={
                      done
                        ? {
                            backgroundColor: 'var(--accent-primary)',
                            color: 'var(--accent-contrast)',
                          }
                        : undefined
                    }
                  >
                    {done && <Check className="w-3 h-3" />}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-sm truncate ${done ? 'line-through text-[var(--text-muted)]' : 'font-medium'}`}>
                      {r.title}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                      {r.timeOfDay} · {r.durationMinutes}분
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteRoutine(r.id)}
                  aria-label="루틴 삭제"
                  className="p-1 text-[var(--text-muted)] hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

interface ChecklistWidgetProps {
  checklists: ChecklistItem[];
  onAddChecklist: (item: ChecklistItem) => void;
  onToggleChecklist: (id: string) => void;
  onDeleteChecklist: (id: string) => void;
}

export const ChecklistWidget: React.FC<ChecklistWidgetProps> = ({
  checklists,
  onAddChecklist,
  onToggleChecklist,
  onDeleteChecklist,
}) => {
  const [title, setTitle] = useState('');
  const [group, setGroup] = useState<ChecklistItem['group']>('장보기');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddChecklist({
      id: `chk-${Date.now()}`,
      title: title.trim(),
      group,
      checked: false,
    });
    setTitle('');
  };

  return (
    <div className="planner-surface rounded-2xl p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold">준비물 및 장보기 목록</h3>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          빠뜨리기 쉬운 준비물과 구매 품목을 관리하세요.
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2">
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value as ChecklistItem['group'])}
          className="px-2.5 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-xs"
        >
          {(['준비물', '장보기', '여행', '기타'] as const).map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="품목 입력"
          className="flex-1 min-w-[120px] px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-sm"
        />
        <button
          type="submit"
          disabled={!title.trim()}
          className="px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 cursor-pointer inline-flex items-center gap-1"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--accent-contrast)',
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>추가</span>
        </button>
      </form>

      <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
        {checklists.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] py-5 text-center">
            목록이 비어 있습니다.
          </p>
        ) : (
          checklists.map((item) => (
            <div
              key={item.id}
              className="group p-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] flex items-center justify-between gap-2"
            >
              <button
                type="button"
                onClick={() => onToggleChecklist(item.id)}
                className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    item.checked
                      ? 'border-transparent'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-surface)]'
                  }`}
                  style={
                    item.checked
                      ? {
                          backgroundColor: 'var(--accent-primary)',
                          color: 'var(--accent-contrast)',
                        }
                      : undefined
                  }
                >
                  {item.checked && <Check className="w-3 h-3" />}
                </span>
                <span className={`text-sm truncate ${item.checked ? 'line-through text-[var(--text-muted)]' : ''}`}>
                  {item.title}
                </span>
                <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                  · {item.group}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDeleteChecklist(item.id)}
                aria-label="항목 삭제"
                className="p-1 text-[var(--text-muted)] hover:text-red-600 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

interface AiRecommendWidgetProps {
  todayKst: string;
  selectedDate: string;
  profile: UserProfile;
  schedules: ScheduleEvent[];
  todos: TodoItem[];
  ddays: DDayItem[];
  onScheduleSuggestedFocus: (event: ScheduleEvent) => void;
}

export const AiRecommendWidget: React.FC<AiRecommendWidgetProps> = ({
  todayKst,
  selectedDate,
  profile,
  schedules,
  todos,
  ddays,
  onScheduleSuggestedFocus,
}) => {
  const analysis = useMemo(() => {
    const dayEvents = getSchedulesForDate(schedules, selectedDate);
    const conflicts = detectScheduleConflicts(dayEvents);

    // Check tight transitions (< 15 min gap)
    const tightTransitions: Array<{ prev: ScheduleEvent; next: ScheduleEvent }> = [];
    for (let i = 0; i < dayEvents.length - 1; i++) {
      const gap =
        timeToMinutes(dayEvents[i + 1].startTime) - timeToMinutes(dayEvents[i].endTime);
      if (gap >= 0 && gap < 15) {
        tightTransitions.push({ prev: dayEvents[i], next: dayEvents[i + 1] });
      }
    }

    // Total scheduled minutes on selected date
    const totalMinutes = dayEvents.reduce((sum, ev) => {
      return sum + Math.max(0, timeToMinutes(ev.endTime) - timeToMinutes(ev.startTime));
    }, 0);

    // Urgent unfinished todos
    const urgentTodos = todos
      .filter((t) => !t.completed)
      .sort((a, b) => {
        const w = { high: 0, medium: 1, low: 2 };
        if (w[a.importance] !== w[b.importance]) return w[a.importance] - w[b.importance];
        return diffDaysYmd(a.dueDate, todayKst) - diffDaysYmd(b.dueDate, todayKst);
      })
      .slice(0, 2);

    // Upcoming D-day within 14 days
    const soonDdays = ddays.filter((d) => {
      const diff = diffDaysYmd(d.targetDate, todayKst);
      return diff >= 0 && diff <= 14;
    });

    // Find a free 1-hour slot avoiding busyHours & existing schedules
    const candidateHours = [10, 11, 13, 15, 16, 17, 19, 20, 21];
    let freeSlot: { start: string; end: string } | null = null;
    for (const h of candidateHours) {
      const startMin = h * 60;
      const endMin = startMin + 60;
      const startStr = `${String(h).padStart(2, '0')}:00`;
      const endStr = `${String(h + 1).padStart(2, '0')}:00`;

      const overlapsBusy = profile.busyHours.some((range) => {
        const [bs, be] = range.split('-').map(timeToMinutes);
        return startMin < be && bs < endMin;
      });
      const overlapsEvent = dayEvents.some((ev) => {
        const es = timeToMinutes(ev.startTime);
        const ee = timeToMinutes(ev.endTime);
        return startMin < ee && es < endMin;
      });
      if (!overlapsBusy && !overlapsEvent) {
        freeSlot = { start: startStr, end: endStr };
        break;
      }
    }

    return {
      dayEventsCount: dayEvents.length,
      conflicts,
      tightTransitions,
      totalHours: (totalMinutes / 60).toFixed(1),
      urgentTodos,
      soonDdays,
      freeSlot,
    };
  }, [schedules, selectedDate, todos, ddays, todayKst, profile.busyHours]);

  const topUrgent = analysis.urgentTodos[0];

  return (
    <div className="planner-surface rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
          <h3 className="text-base font-bold">맞춤형 일정 분석 및 추천</h3>
        </div>
        <span className="text-xs text-[var(--text-muted)] tabular-nums">
          선택일 일정 {analysis.dayEventsCount}건 · 총 {analysis.totalHours}시간 배정
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        {/* Conflict & Workload Insights */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] space-y-2">
          <p className="text-xs font-semibold text-[var(--text-secondary)]">
            시간 충돌 및 준비 여유 진단
          </p>
          {analysis.conflicts.length > 0 ? (
            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                겹치는 일정 {analysis.conflicts.length}건이 있습니다. 일정을 클릭해 시간을 조정해 보세요.
              </span>
            </div>
          ) : analysis.tightTransitions.length > 0 ? (
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              연속된 일정 사이 간격이 15분 미만입니다 (
              {analysis.tightTransitions[0].prev.title} →{' '}
              {analysis.tightTransitions[0].next.title}). 이동·준비 시간을 고려해 보세요.
            </p>
          ) : Number(analysis.totalHours) >= 6 ? (
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              하루 배정 시간이 {analysis.totalHours}시간으로 많은 편입니다. 중요도가 낮은 일은 다른 날로 분산하는 것을 권장합니다.
            </p>
          ) : (
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              일정 간 시간 충돌이 없으며, 준비 및 휴식 여유가 적절히 확보되어 있습니다.
            </p>
          )}
        </div>

        {/* Priority & Free Slot Recommendation */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] space-y-2">
          <p className="text-xs font-semibold text-[var(--text-secondary)]">
            마감·바쁜 시간대 기반 추천
          </p>
          {topUrgent && analysis.freeSlot ? (
            <div className="space-y-2">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                바쁜 시간대({profile.busyHours.join(', ') || '미지정'})를 피해{' '}
                <strong className="text-[var(--text-primary)] tabular-nums">
                  {analysis.freeSlot.start}~{analysis.freeSlot.end}
                </strong>
                에 우선순위 할 일 <strong>‘{topUrgent.title}’</strong> 집중 시간을 배치해 보세요.
              </p>
              <button
                type="button"
                onClick={() =>
                  onScheduleSuggestedFocus({
                    id: `sch-rec-${Date.now()}`,
                    title: topUrgent.title,
                    date: selectedDate,
                    startTime: analysis.freeSlot!.start,
                    endTime: analysis.freeSlot!.end,
                    memo: 'AI 추천 여유 시간대 배치',
                    category: topUrgent.category === '학업' ? '학업' : '업무',
                    importance: topUrgent.importance,
                    repeat: 'none',
                  })
                }
                className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-contrast)',
                }}
              >
                추천 시간대에 일정 추가하기
              </button>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {analysis.soonDdays.length > 0
                ? `다가오는 D-day(${analysis.soonDdays[0].title})에 맞춰 하루 30분 이상 복습·준비 시간을 확보해 보세요.`
                : '현재 급한 미완료 항목 없이 일정이 균형 있게 구성되어 있습니다.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
