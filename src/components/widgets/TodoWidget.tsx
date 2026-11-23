import React, { useEffect, useState } from 'react';
import { ArrowRightCircle, Check, Plus, Trash2 } from 'lucide-react';
import { ImportanceLevel, TodoItem } from '../../types/planner';
import { addDaysYmd, formatKoreanMonthDay, isValidYmd } from '../../utils/dateKst';

interface TodoWidgetProps {
  todayKst: string;
  selectedDate: string;
  todos: TodoItem[];
  onAddTodo: (todo: TodoItem) => void;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onMoveUnfinishedToDate: (fromDate: string | 'all_past', targetDate: string) => void;
}

export const TodoWidget: React.FC<TodoWidgetProps> = ({
  todayKst,
  selectedDate,
  todos,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  onMoveUnfinishedToDate,
}) => {
  const [title, setTitle] = useState('');
  const [importance, setImportance] = useState<ImportanceLevel>('medium');
  const [dueDate, setDueDate] = useState(selectedDate);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [moveTargetDate, setMoveTargetDate] = useState(addDaysYmd(todayKst, 1));
  const [showMoveOptions, setShowMoveOptions] = useState(false);
  const [moveMessage, setMoveMessage] = useState('');

  useEffect(() => {
    setDueDate(selectedDate);
  }, [selectedDate]);

  const filteredTodos = todos
    .filter((t) => {
      if (filter === 'pending') return !t.completed;
      if (filter === 'completed') return t.completed;
      return true;
    })
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const weight = { high: 0, medium: 1, low: 2 };
      return weight[a.importance] - weight[b.importance];
    });

  const pendingCount = todos.filter((t) => !t.completed).length;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAddTodo({
      id: `todo-${Date.now()}`,
      title: trimmed,
      completed: false,
      importance,
      dueDate: isValidYmd(dueDate) ? dueDate : selectedDate,
      category: '할 일',
    });
    setTitle('');
  };

  return (
    <div className="planner-surface rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold">할 일 목록</h3>
          <p className="text-xs text-[var(--text-muted)] tabular-nums mt-0.5">
            남은 항목 {pendingCount}개 · 전체 {todos.length}개
          </p>
        </div>

        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--bg-subtle)]">
          {(
            [
              { id: 'all', label: '전체' },
              { id: 'pending', label: '미완료' },
              { id: 'completed', label: '완료' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 rounded-md text-xs cursor-pointer transition-colors ${
                filter === f.id
                  ? 'bg-[var(--bg-surface)] font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Add Form */}
      <form onSubmit={handleAdd} className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="할 일을 입력하세요"
            className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            aria-label="할 일 추가"
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
            value={importance}
            onChange={(e) => setImportance(e.target.value as ImportanceLevel)}
            className="px-2.5 py-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-xs"
            aria-label="중요도"
          >
            <option value="high">중요도: 높음</option>
            <option value="medium">중요도: 보통</option>
            <option value="low">중요도: 낮음</option>
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-xs tabular-nums"
            aria-label="마감일"
          />
        </div>
      </form>

      {/* Todo List */}
      <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
        {filteredTodos.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] py-6 text-center">
            표시할 할 일이 없습니다.
          </p>
        ) : (
          filteredTodos.map((todo) => (
            <div
              key={todo.id}
              className="group flex items-start justify-between gap-2.5 p-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)]"
            >
              <button
                type="button"
                onClick={() => onToggleTodo(todo.id)}
                className="flex items-start gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
              >
                <span
                  className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
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
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm leading-snug ${
                      todo.completed
                        ? 'line-through text-[var(--text-muted)]'
                        : 'font-medium'
                    }`}
                  >
                    {todo.title}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mt-0.5 tabular-nums">
                    <span>
                      {todo.importance === 'high'
                        ? '중요'
                        : todo.importance === 'medium'
                        ? '보통'
                        : '여유'}
                    </span>
                    <span>·</span>
                    <span>{formatKoreanMonthDay(todo.dueDate)}</span>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onDeleteTodo(todo.id)}
                aria-label="할 일 삭제"
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-600 opacity-70 group-hover:opacity-100 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Move unfinished todos manually */}
      {pendingCount > 0 && (
        <div className="pt-2 border-t border-[var(--border-hairline)]">
          {!showMoveOptions ? (
            <button
              type="button"
              onClick={() => setShowMoveOptions(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
            >
              <ArrowRightCircle className="w-3.5 h-3.5" />
              <span>미완료 할 일 다른 날짜로 옮기기</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input
                type="date"
                value={moveTargetDate}
                onChange={(e) => setMoveTargetDate(e.target.value)}
                aria-label="이동할 날짜"
                className="px-2 py-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] tabular-nums"
              />
              <button
                type="button"
                disabled={!isValidYmd(moveTargetDate)}
                onClick={() => {
                  if (!isValidYmd(moveTargetDate)) return;
                  onMoveUnfinishedToDate('all_past', moveTargetDate);
                  setShowMoveOptions(false);
                  setMoveMessage(`${formatKoreanMonthDay(moveTargetDate)}로 이동했습니다.`);
                  window.setTimeout(() => setMoveMessage(''), 3000);
                }}
                className="px-3 py-1.5 rounded-lg font-semibold disabled:opacity-40 cursor-pointer"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-contrast)',
                }}
              >
                선택 날짜로 이동
              </button>
              <button
                type="button"
                onClick={() => setShowMoveOptions(false)}
                className="px-2 py-1 text-[var(--text-muted)] cursor-pointer"
              >
                취소
              </button>
            </div>
          )}
          {moveMessage && (
            <p className="mt-1.5 text-[11px] text-[var(--accent-primary)] font-medium">
              {moveMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
