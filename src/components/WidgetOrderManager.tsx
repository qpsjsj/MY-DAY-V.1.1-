import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import {
  BuiltinWidgetId,
  CustomWidget,
  WidgetPlacement,
} from '../types/planner';
import { BUILTIN_WIDGET_META } from '../utils/sampleData';

interface WidgetOrderManagerProps {
  title: string;
  description: string;
  widgets: WidgetPlacement[];
  customWidgets: CustomWidget[];
  compactGrid?: boolean;
  allowDeleteCustom?: boolean;
  onToggleVisible: (id: string) => void;
  onMoveOrder: (index: number, direction: -1 | 1) => void;
  onToggleSize: (id: string) => void;
  onOpenNewCustomWidget?: () => void;
  onDeleteCustomWidget?: (id: string) => void;
}

export const WidgetOrderManager: React.FC<WidgetOrderManagerProps> = ({
  title,
  description,
  widgets,
  customWidgets,
  compactGrid = false,
  allowDeleteCustom = false,
  onToggleVisible,
  onMoveOrder,
  onToggleSize,
  onOpenNewCustomWidget,
  onDeleteCustomWidget,
}) => {
  const [confirmDeleteCustomId, setConfirmDeleteCustomId] = useState<string | null>(
    null
  );

  return (
    <div className="planner-surface rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--border-hairline)]">
        <div>
          <p className="text-sm font-bold">{title}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>
        </div>
        {onOpenNewCustomWidget && (
          <button
            type="button"
            onClick={onOpenNewCustomWidget}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-contrast)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>새 위젯</span>
          </button>
        )}
      </div>

      <div
        className={
          compactGrid ? 'grid grid-cols-1 md:grid-cols-2 gap-2' : 'space-y-2'
        }
      >
        {widgets.map((w, idx) => {
          const isCustom = w.type === 'custom';
          const customObj = isCustom
            ? customWidgets.find((c) => c.id === w.id)
            : undefined;
          const label = isCustom
            ? customObj?.title || '사용자 위젯'
            : BUILTIN_WIDGET_META[w.id as BuiltinWidgetId]?.label || w.id;

          return (
            <div
              key={w.id}
              className={`p-2.5 rounded-xl border border-[var(--border-hairline)] flex items-center justify-between gap-2 transition-opacity ${
                w.visible
                  ? 'bg-[var(--bg-canvas)]'
                  : 'bg-[var(--bg-subtle)]/50 opacity-75'
              }`}
            >
              <div className="min-w-0 flex items-center gap-2">
                <span className="text-[11px] text-[var(--text-muted)] tabular-nums w-4 text-center shrink-0">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold truncate">{label}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {isCustom ? '사용자 정의' : '기본 위젯'} ·{' '}
                    {w.size === 'wide' ? '넓게' : '기본 크기'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleSize(w.id)}
                  aria-label={`${label} 너비 전환 (${w.size === 'wide' ? '2칸' : '1칸'})`}
                  className="px-2 py-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {w.size === 'wide' ? '2칸' : '1칸'}
                </button>

                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => onMoveOrder(idx, -1)}
                  aria-label={`${label} 위로 이동`}
                  className="p-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] disabled:opacity-30 cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  disabled={idx === widgets.length - 1}
                  onClick={() => onMoveOrder(idx, 1)}
                  aria-label={`${label} 아래로 이동`}
                  className="p-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] disabled:opacity-30 cursor-pointer"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onToggleVisible(w.id)}
                  aria-label={`${label} ${w.visible ? '숨기기' : '표시하기'}`}
                  aria-pressed={w.visible}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium cursor-pointer border border-[var(--border-hairline)]"
                  style={
                    w.visible
                      ? {
                          backgroundColor: 'var(--accent-soft)',
                          color: 'var(--accent-primary)',
                          borderColor: 'transparent',
                        }
                      : undefined
                  }
                >
                  {w.visible ? (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">표시</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">숨김</span>
                    </>
                  )}
                </button>

                {allowDeleteCustom &&
                  isCustom &&
                  onDeleteCustomWidget &&
                  (confirmDeleteCustomId === w.id ? (
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteCustomWidget(w.id);
                        setConfirmDeleteCustomId(null);
                      }}
                      className="px-2 py-1 rounded-lg bg-red-600 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      확인
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteCustomId(w.id)}
                      aria-label={`${label} 삭제`}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
