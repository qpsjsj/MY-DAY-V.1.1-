import React, { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { DDayItem } from '../../types/planner';
import { diffDaysYmd, formatDDayBadge, isValidYmd } from '../../utils/dateKst';

interface DDayWidgetProps {
  todayKst: string;
  ddays: DDayItem[];
  onAddDDay: (item: DDayItem) => void;
  onUpdateDDay: (item: DDayItem) => void;
  onDeleteDDay: (id: string) => void;
}

const CATEGORIES: DDayItem['category'][] = ['시험', '자격증', '생일', '기념일', '기타'];

export const DDayWidget: React.FC<DDayWidgetProps> = ({
  todayKst,
  ddays,
  onAddDDay,
  onUpdateDDay,
  onDeleteDDay,
}) => {
  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState(todayKst);
  const [category, setCategory] = useState<DDayItem['category']>('시험');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState(todayKst);
  const [editCategory, setEditCategory] = useState<DDayItem['category']>('시험');

  const sorted = [...ddays].sort(
    (a, b) => diffDaysYmd(a.targetDate, todayKst) - diffDaysYmd(b.targetDate, todayKst)
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !isValidYmd(targetDate)) return;
    onAddDDay({
      id: `dd-${Date.now()}`,
      title: trimmed,
      targetDate,
      category,
    });
    setTitle('');
  };

  const startEdit = (item: DDayItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDate(item.targetDate);
    setEditCategory(item.category);
  };

  const handleSaveEdit = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    const trimmed = editTitle.trim();
    if (!trimmed || !isValidYmd(editDate)) return;
    onUpdateDDay({
      id,
      title: trimmed,
      targetDate: editDate,
      category: editCategory,
    });
    setEditingId(null);
  };

  return (
    <div className="planner-surface rounded-2xl p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold">시험 및 기념일 D-day</h3>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          남은 날짜가 자동으로 계산됩니다.
        </p>
      </div>

      <form onSubmit={handleAdd} className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="기념일 또는 시험 이름"
            className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
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

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DDayItem['category'])}
            className="px-2.5 py-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] tabular-nums"
          />
        </div>
      </form>

      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
        {sorted.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] py-6 text-center">
            등록된 D-day가 없습니다.
          </p>
        ) : (
          sorted.map((item) => {
            const isEditing = editingId === item.id;
            const badge = formatDDayBadge(item.targetDate, todayKst);
            const diff = diffDaysYmd(item.targetDate, todayKst);

            if (isEditing) {
              return (
                <form
                  key={item.id}
                  onSubmit={(e) => handleSaveEdit(e, item.id)}
                  className="p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--accent-primary)] space-y-2"
                >
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="기념일 또는 시험 이름"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <select
                        value={editCategory}
                        onChange={(e) =>
                          setEditCategory(e.target.value as DDayItem['category'])
                        }
                        className="px-2 py-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="px-2 py-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] tabular-nums"
                      />
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
                        disabled={!editTitle.trim() || !editDate}
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
                key={item.id}
                className="group p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{item.title}</p>
                  <p className="text-[11px] text-[var(--text-muted)] tabular-nums mt-0.5">
                    {item.category} · {item.targetDate}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-sm font-bold tabular-nums mr-1 ${
                      diff >= 0 && diff <= 3
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-[var(--accent-primary)]'
                    }`}
                  >
                    {badge}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    aria-label="D-day 수정"
                    className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] opacity-75 group-hover:opacity-100 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteDDay(item.id)}
                    aria-label="D-day 삭제"
                    className="p-1 rounded-lg text-[var(--text-muted)] hover:text-red-600 opacity-75 group-hover:opacity-100 cursor-pointer"
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

