import React, { useEffect, useState } from 'react';
import { Check, Minus, Plus, Trash2, X } from 'lucide-react';
import { CustomWidget, CustomWidgetKind } from '../../types/planner';

interface CustomWidgetCardProps {
  widget: CustomWidget;
  onUpdateWidget: (updated: CustomWidget) => void;
  onDeleteWidget: (id: string) => void;
}

export const CustomWidgetCard: React.FC<CustomWidgetCardProps> = ({
  widget,
  onUpdateWidget,
  onDeleteWidget,
}) => {
  const [newLabel, setNewLabel] = useState('');
  const [newDetail, setNewDetail] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    onUpdateWidget({
      ...widget,
      items: [
        ...widget.items,
        {
          id: `cw-item-${Date.now()}`,
          label: trimmed,
          detail: newDetail.trim() || undefined,
          checked: false,
          value: 0,
          target: widget.kind === 'counter' ? 5 : undefined,
        },
      ],
    });
    setNewLabel('');
    setNewDetail('');
  };

  const toggleItem = (itemId: string) => {
    onUpdateWidget({
      ...widget,
      items: widget.items.map((it) =>
        it.id === itemId ? { ...it, checked: !it.checked } : it
      ),
    });
  };

  const adjustCounter = (itemId: string, delta: number) => {
    onUpdateWidget({
      ...widget,
      items: widget.items.map((it) =>
        it.id === itemId
          ? { ...it, value: Math.max(0, (it.value ?? 0) + delta) }
          : it
      ),
    });
  };

  const removeItem = (itemId: string) => {
    onUpdateWidget({
      ...widget,
      items: widget.items.filter((it) => it.id !== itemId),
    });
  };

  return (
    <div className="planner-surface rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold truncate">{widget.title}</h3>
          {widget.description && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {widget.description}
            </p>
          )}
        </div>

        {confirmDelete ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onDeleteWidget(widget.id)}
              className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-semibold cursor-pointer"
            >
              삭제
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-1 rounded-lg text-xs text-[var(--text-muted)] cursor-pointer"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label="사용자 정의 위젯 삭제"
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-600 cursor-pointer shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <form onSubmit={handleAddItem} className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder={
            widget.kind === 'exam_study'
              ? '과목 또는 시험 범위'
              : widget.kind === 'counter'
              ? '카운터 항목 (예: 물 1컵)'
              : '새 항목 입력'
          }
          className="flex-1 min-w-[130px] px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-sm"
        />
        {(widget.kind === 'exam_study' || widget.kind === 'note_list') && (
          <input
            type="text"
            value={newDetail}
            onChange={(e) => setNewDetail(e.target.value)}
            placeholder="세부 계획 또는 메모"
            className="flex-1 min-w-[120px] px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-xs"
          />
        )}
        <button
          type="submit"
          disabled={!newLabel.trim()}
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

      <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
        {widget.items.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] py-5 text-center">
            항목을 추가해 위젯을 채워보세요.
          </p>
        ) : (
          widget.items.map((item) => (
            <div
              key={item.id}
              className="group p-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] flex items-center justify-between gap-2"
            >
              {widget.kind === 'counter' ? (
                <>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                      현재 {item.value ?? 0}
                      {item.target ? ` / 목표 ${item.target}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => adjustCounter(item.id, -1)}
                      aria-label={`${item.label} 감소`}
                      className="p-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustCounter(item.id, 1)}
                      aria-label={`${item.label} 증가`}
                      className="p-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      aria-label={`${item.label} 삭제`}
                      className="p-1 text-[var(--text-muted)] hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    className="flex items-start gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <span
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
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
                    <div className="min-w-0">
                      <p className={`text-sm ${item.checked ? 'line-through text-[var(--text-muted)]' : 'font-medium'}`}>
                        {item.label}
                      </p>
                      {(item.detail || item.date) && (
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 tabular-nums">
                          {[item.detail, item.date].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label={`${item.label} 삭제`}
                    className="p-1 text-[var(--text-muted)] hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

interface NewCustomWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (widget: CustomWidget) => void;
}

export const NewCustomWidgetModal: React.FC<NewCustomWidgetModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<CustomWidgetKind>('checklist');

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({
      id: `cw-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      kind,
      items: [],
    });
    setTitle('');
    setDescription('');
    setKind('checklist');
    onClose();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-widget-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl planner-surface p-6 space-y-4 shadow-lg">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
          <h3 id="custom-widget-modal-title" className="text-base font-bold">
            사용자 정의 위젯 만들기
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="custom-widget-title"
              className="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
            >
              위젯 이름
            </label>
            <input
              id="custom-widget-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 기말고사 과목별 계획, 물 마시기 기록"
              className="w-full px-3.5 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-sm"
              required
            />
          </div>

          <div>
            <label
              htmlFor="custom-widget-desc"
              className="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
            >
              설명
            </label>
            <input
              id="custom-widget-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="위젯의 목적을 간단히 적어주세요"
              className="w-full px-3.5 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              위젯 유형
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'checklist', label: '체크리스트형' },
                  { id: 'counter', label: '횟수 카운터형' },
                  { id: 'exam_study', label: '시험·계획 관리형' },
                  { id: 'note_list', label: '기록 리스트형' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setKind(opt.id)}
                  className={`p-2.5 rounded-xl border text-xs font-medium cursor-pointer ${
                    kind === opt.id
                      ? 'border-[var(--accent-primary)] bg-[var(--bg-subtle)] font-semibold'
                      : 'border-[var(--border-hairline)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs border border-[var(--border-hairline)] cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-contrast)',
              }}
            >
              위젯 추가
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
