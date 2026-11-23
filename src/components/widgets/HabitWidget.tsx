import React, { useState } from 'react';
import { Check, Flame, Pencil, Plus, Trash2 } from 'lucide-react';
import { HabitItem } from '../../types/planner';
import { addDaysYmd } from '../../utils/dateKst';

interface HabitWidgetProps {
  todayKst: string;
  habits: HabitItem[];
  onAddHabit: (habit: HabitItem) => void;
  onUpdateHabit: (habit: HabitItem) => void;
  onToggleHabitDate: (id: string, dateYmd: string) => void;
  onDeleteHabit: (id: string) => void;
}

function calcConsecutiveStreak(completedDates: string[], todayKst: string): number {
  const set = new Set(completedDates);
  let cursor = set.has(todayKst) ? todayKst : addDaysYmd(todayKst, -1);
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDaysYmd(cursor, -1);
  }
  return streak;
}

function calcWeeklyRate(completedDates: string[], todayKst: string, targetPerWeek: number): number {
  const set = new Set(completedDates);
  let count = 0;
  for (let i = 0; i < 7; i++) {
    if (set.has(addDaysYmd(todayKst, -i))) count += 1;
  }
  const denom = Math.max(1, targetPerWeek);
  return Math.min(100, Math.round((count / denom) * 100));
}

export const HabitWidget: React.FC<HabitWidgetProps> = ({
  todayKst,
  habits,
  onAddHabit,
  onUpdateHabit,
  onToggleHabitDate,
  onDeleteHabit,
}) => {
  const [title, setTitle] = useState('');
  const [targetPerWeek, setTargetPerWeek] = useState(7);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTarget, setEditTarget] = useState(7);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAddHabit({
      id: `hab-${Date.now()}`,
      title: trimmed,
      completedDates: [],
      targetPerWeek: Math.min(7, Math.max(1, targetPerWeek)),
    });
    setTitle('');
  };

  const startEdit = (habit: HabitItem) => {
    setEditingId(habit.id);
    setEditTitle(habit.title);
    setEditTarget(habit.targetPerWeek);
  };

  const handleSaveEdit = (e: React.FormEvent, habit: HabitItem) => {
    e.preventDefault();
    const trimmed = editTitle.trim();
    if (!trimmed) return;
    onUpdateHabit({
      ...habit,
      title: trimmed,
      targetPerWeek: Math.min(7, Math.max(1, Number(editTarget) || 7)),
    });
    setEditingId(null);
  };

  return (
    <div className="planner-surface rounded-2xl p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold">습관 트래커</h3>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          오늘 실천한 습관을 체크하고 연속 일수와 주간 실천율을 확인하세요.
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="매일 실천할 습관 (예: 영단어 20개)"
          className="flex-1 min-w-[160px] px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
        />
        <select
          value={targetPerWeek}
          onChange={(e) => setTargetPerWeek(Number(e.target.value))}
          aria-label="주간 목표 횟수"
          className="px-2.5 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-xs tabular-nums"
        >
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n} value={n}>
              주 {n}회
            </option>
          ))}
        </select>
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
          <span>등록</span>
        </button>
      </form>

      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
        {habits.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] py-6 text-center">
            등록된 습관이 없습니다.
          </p>
        ) : (
          habits.map((habit) => {
            const doneToday = habit.completedDates.includes(todayKst);
            const streak = calcConsecutiveStreak(habit.completedDates, todayKst);
            const weeklyRate = calcWeeklyRate(
              habit.completedDates,
              todayKst,
              habit.targetPerWeek
            );

            if (editingId === habit.id) {
              return (
                <form
                  key={habit.id}
                  onSubmit={(e) => handleSaveEdit(e, habit)}
                  className="p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--accent-primary)] space-y-2"
                >
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="습관 이름"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--text-muted)]">주간 목표</span>
                      <select
                        value={editTarget}
                        onChange={(e) => setEditTarget(Number(e.target.value))}
                        className="px-2 py-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] tabular-nums"
                      >
                        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                          <option key={n} value={n}>
                            주 {n}회
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 rounded-lg border border-[var(--border-hairline)] cursor-pointer"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        disabled={!editTitle.trim()}
                        className="px-2.5 py-1 rounded-lg font-semibold disabled:opacity-40 cursor-pointer"
                        style={{
                          backgroundColor: 'var(--accent-primary)',
                          color: 'var(--accent-contrast)',
                        }}
                      >
                        저장
                      </button>
                    </div>
                  </div>
                </form>
              );
            }

            return (
              <div
                key={habit.id}
                className="group p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] flex items-center justify-between gap-3"
              >
                <button
                  type="button"
                  onClick={() => onToggleHabitDate(habit.id, todayKst)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                >
                  <span
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      doneToday
                        ? 'border-transparent'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-surface)]'
                    }`}
                    style={
                      doneToday
                        ? {
                            backgroundColor: 'var(--accent-primary)',
                            color: 'var(--accent-contrast)',
                          }
                        : undefined
                    }
                  >
                    {doneToday && <Check className="w-3.5 h-3.5" />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{habit.title}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--text-muted)] mt-0.5 tabular-nums">
                      <span className="inline-flex items-center gap-0.5">
                        <Flame className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        연속 {streak}일
                      </span>
                      <span>·</span>
                      <span>주 {habit.targetPerWeek}회 목표</span>
                      <span>·</span>
                      <span>실천율 {weeklyRate}%</span>
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(habit)}
                    aria-label="습관 수정"
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] opacity-75 group-hover:opacity-100 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteHabit(habit.id)}
                    aria-label="습관 삭제"
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-600 opacity-75 group-hover:opacity-100 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

