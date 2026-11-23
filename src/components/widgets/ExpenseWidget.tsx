import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ExpenseItem } from '../../types/planner';
import { formatKoreanMonthDay, isValidYmd } from '../../utils/dateKst';

interface ExpenseWidgetProps {
  todayKst: string;
  selectedDate: string;
  expenses: ExpenseItem[];
  monthlyBudget: number;
  onUpdateMonthlyBudget: (budget: number) => void;
  onAddExpense: (item: ExpenseItem) => void;
  onUpdateExpense: (item: ExpenseItem) => void;
  onDeleteExpense: (id: string) => void;
}

const EXPENSE_CATEGORIES: ExpenseItem['category'][] = [
  '식비',
  '교통',
  '쇼핑',
  '생활',
  '학습',
  '기타',
];

export const ExpenseWidget: React.FC<ExpenseWidgetProps> = ({
  todayKst,
  selectedDate,
  expenses,
  monthlyBudget,
  onUpdateMonthlyBudget,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
}) => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseItem['category']>('식비');
  const [date, setDate] = useState(selectedDate);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState(String(monthlyBudget));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState<ExpenseItem['category']>('식비');
  const [editDate, setEditDate] = useState(selectedDate);

  useEffect(() => {
    setDate(selectedDate);
  }, [selectedDate]);

  const currentMonthPrefix = todayKst.slice(0, 7); // YYYY-MM
  const monthlyExpenseTotal = expenses
    .filter((e) => e.type === 'expense' && e.date.startsWith(currentMonthPrefix))
    .reduce((acc, cur) => acc + cur.amount, 0);

  const hasBudget = monthlyBudget > 0;
  const budgetPct = hasBudget
    ? Math.min(100, Math.round((monthlyExpenseTotal / monthlyBudget) * 100))
    : 0;
  const remaining = monthlyBudget - monthlyExpenseTotal;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = Number(amount.replace(/,/g, ''));
    const trimmed = title.trim();
    if (!trimmed || Number.isNaN(numeric) || numeric <= 0) return;

    onAddExpense({
      id: `exp-${Date.now()}`,
      title: trimmed,
      amount: Math.round(numeric),
      date: isValidYmd(date) ? date : selectedDate,
      category,
      type: 'expense',
    });
    setTitle('');
    setAmount('');
  };

  const startEdit = (item: ExpenseItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditAmount(String(item.amount));
    setEditCategory(item.category);
    setEditDate(item.date);
  };

  const handleSaveEdit = (e: React.FormEvent, item: ExpenseItem) => {
    e.preventDefault();
    const trimmed = editTitle.trim();
    const numeric = Number(editAmount.replace(/,/g, ''));
    if (!trimmed || Number.isNaN(numeric) || numeric <= 0 || !isValidYmd(editDate)) return;

    onUpdateExpense({
      ...item,
      title: trimmed,
      amount: Math.round(numeric),
      category: editCategory,
      date: editDate,
    });
    setEditingId(null);
  };

  return (
    <div className="planner-surface rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-bold">지출 기록</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 tabular-nums">
            이번 달 합계 {monthlyExpenseTotal.toLocaleString('ko-KR')}원
          </p>
        </div>

        {!editingBudget ? (
          <button
            type="button"
            onClick={() => {
              setBudgetDraft(String(monthlyBudget));
              setEditingBudget(true);
            }}
            className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer tabular-nums"
          >
            <span>
              {hasBudget ? `예산 ${monthlyBudget.toLocaleString('ko-KR')}원` : '월 예산 설정'}
            </span>
            <Pencil className="w-3 h-3" />
          </button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = Number(budgetDraft);
              if (Number.isFinite(parsed) && parsed >= 0) {
                onUpdateMonthlyBudget(Math.round(parsed));
              }
              setEditingBudget(false);
            }}
            className="flex items-center gap-1"
          >
            <input
              type="number"
              min={0}
              step={10000}
              value={budgetDraft}
              onChange={(e) => setBudgetDraft(e.target.value)}
              aria-label="월 예산 금액"
              className="w-24 px-2 py-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-xs tabular-nums"
            />
            <button
              type="submit"
              className="px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-contrast)',
              }}
            >
              저장
            </button>
          </form>
        )}
      </div>

      {/* Budget Progress */}
      <div className="space-y-1.5">
        <div className="h-2 w-full rounded-full bg-[var(--bg-subtle)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${budgetPct}%`,
              backgroundColor:
                hasBudget && remaining < 0 ? '#DC2626' : 'var(--accent-primary)',
            }}
          />
        </div>
        {hasBudget ? (
          <div className="flex justify-between text-[11px] text-[var(--text-muted)] tabular-nums">
            <span>예산 대비 {budgetPct}% 사용</span>
            <span className={remaining < 0 ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
              {remaining >= 0
                ? `남은 예산 ${remaining.toLocaleString('ko-KR')}원`
                : `예산 초과 ${Math.abs(remaining).toLocaleString('ko-KR')}원`}
            </span>
          </div>
        ) : (
          <p className="text-[11px] text-[var(--text-muted)]">
            월 예산을 입력하면 예산 대비 지출 비율을 확인할 수 있습니다.
          </p>
        )}
      </div>

      <form onSubmit={handleAdd} className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="지출 내역"
            className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-sm"
          />
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="금액"
            className="w-24 px-2.5 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-sm tabular-nums"
          />
          <button
            type="submit"
            disabled={!title.trim() || !amount}
            className="px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 cursor-pointer shrink-0 inline-flex items-center gap-1"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-contrast)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>기록</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseItem['category'])}
            className="px-2.5 py-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] tabular-nums"
          />
        </div>
      </form>

      <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
        {expenses.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] py-5 text-center">
            기록된 지출이 없습니다.
          </p>
        ) : (
          [...expenses]
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .map((item) => {
              if (editingId === item.id) {
                return (
                  <form
                    key={item.id}
                    onSubmit={(e) => handleSaveEdit(e, item)}
                    className="p-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--accent-primary)] space-y-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="지출 내역"
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-xs font-medium"
                      />
                      <input
                        type="number"
                        min={1}
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        placeholder="금액"
                        className="w-24 px-2 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-xs tabular-nums"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select
                          value={editCategory}
                          onChange={(e) =>
                            setEditCategory(e.target.value as ExpenseItem['category'])
                          }
                          className="px-2 py-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
                        >
                          {EXPENSE_CATEGORIES.map((c) => (
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
                          disabled={
                            !editTitle.trim() ||
                            !editAmount ||
                            Number(editAmount) <= 0 ||
                            !editDate
                          }
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
                  className="group p-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                      {item.category} · {formatKoreanMonthDay(item.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-sm font-semibold tabular-nums mr-1">
                      {item.amount.toLocaleString('ko-KR')}원
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      aria-label="지출 수정"
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] opacity-75 group-hover:opacity-100 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteExpense(item.id)}
                      aria-label="지출 삭제"
                      className="p-1 rounded text-[var(--text-muted)] hover:text-red-600 opacity-75 group-hover:opacity-100 cursor-pointer"
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

