import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import {
  CategoryColorMap,
  ImportanceLevel,
  RepeatRule,
  ScheduleEvent,
} from '../types/planner';
import { getSchedulesForDate, isValidHhmm, isValidYmd, timeToMinutes } from '../utils/dateKst';

interface ScheduleModalProps {
  isOpen: boolean;
  initialDate: string;
  initialStartTime?: string;
  initialEndTime?: string;
  editingEvent: ScheduleEvent | null;
  allSchedules: ScheduleEvent[];
  categoryColors: CategoryColorMap;
  onSave: (event: ScheduleEvent, updatedCategoryColor?: { name: string; color: string }) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const COLOR_PRESETS = ['#4F7760', '#3B6E8C', '#6E5FA8', '#B5634D', '#8A6D3B', '#4B5563'];

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  initialDate,
  initialStartTime,
  initialEndTime,
  editingEvent,
  allSchedules,
  categoryColors,
  onSave,
  onDelete,
  onClose,
}) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [noTime, setNoTime] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [memo, setMemo] = useState('');
  const [category, setCategory] = useState('업무');
  const [customCategoryColor, setCustomCategoryColor] = useState('#4F7760');
  const [importance, setImportance] = useState<ImportanceLevel>('medium');
  const [repeat, setRepeat] = useState<RepeatRule>('none');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setConfirmDelete(false);
    if (editingEvent) {
      const untimed = !isValidHhmm(editingEvent.startTime);
      setTitle(editingEvent.title);
      setDate(editingEvent.date);
      setNoTime(untimed);
      setStartTime(untimed ? '10:00' : editingEvent.startTime);
      setEndTime(untimed ? '11:00' : editingEvent.endTime || '11:00');
      setMemo(editingEvent.memo);
      setCategory(editingEvent.category);
      setCustomCategoryColor(categoryColors[editingEvent.category] || '#4F7760');
      setImportance(editingEvent.importance);
      setRepeat(editingEvent.repeat);
      setWeekdays(editingEvent.weekdays || []);
    } else {
      setTitle('');
      setDate(initialDate);
      setNoTime(false);
      setStartTime(initialStartTime || '10:00');
      setEndTime(initialEndTime || '11:00');
      setMemo('');
      const firstCat = Object.keys(categoryColors)[0] || '업무';
      setCategory(firstCat);
      setCustomCategoryColor(categoryColors[firstCat] || '#4F7760');
      setImportance('medium');
      setRepeat('none');
      setWeekdays([]);
    }
  }, [isOpen, editingEvent, initialDate, initialStartTime, initialEndTime, categoryColors]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const conflictingEvents = useMemo(() => {
    if (noTime || !date || !isValidHhmm(startTime) || !isValidHhmm(endTime)) return [];
    const sMin = timeToMinutes(startTime);
    const eMin = timeToMinutes(endTime);
    if (eMin <= sMin) return [];
    const dayEvents = getSchedulesForDate(allSchedules, date).filter(
      (ev) => ev.id !== editingEvent?.id && isValidHhmm(ev.startTime)
    );
    return dayEvents.filter((ev) => {
      const evStart = timeToMinutes(ev.startTime);
      const evEnd = isValidHhmm(ev.endTime)
        ? Math.max(evStart + 15, timeToMinutes(ev.endTime))
        : evStart + 60;
      return sMin < evEnd && evStart < eMin;
    });
  }, [allSchedules, date, noTime, startTime, endTime, editingEvent]);

  if (!isOpen) return null;

  const toggleWeekday = (dow: number) => {
    setWeekdays((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort()
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('일정 제목을 입력해 주세요.');
      return;
    }
    if (!isValidYmd(date)) {
      setError('유효한 날짜(YYYY-MM-DD)를 선택해 주세요.');
      return;
    }
    if (!noTime) {
      if (!isValidHhmm(startTime) || !isValidHhmm(endTime)) {
        setError('시작 시간과 종료 시간을 올바르게 입력해 주세요.');
        return;
      }
      if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
        setError('종료 시간은 시작 시간보다 늦어야 합니다.');
        return;
      }
    }

    const cleanCategory = category.trim() || '기타';
    const nextEvent: ScheduleEvent = {
      id: editingEvent ? editingEvent.id : `sch-${Date.now()}`,
      title: trimmed,
      date,
      startTime: noTime ? '' : startTime,
      endTime: noTime ? '' : endTime,
      memo: memo.trim(),
      category: cleanCategory,
      importance,
      repeat,
      weekdays: repeat === 'weekly' && weekdays.length > 0 ? weekdays : undefined,
    };

    onSave(nextEvent, { name: cleanCategory, color: customCategoryColor });
    onClose();
  };

  const categoryKeys = Array.from(new Set([...Object.keys(categoryColors), category])).filter(
    Boolean
  );

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl planner-surface p-6 max-h-[92vh] overflow-y-auto shadow-lg">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-hairline)]">
          <h3 id="schedule-modal-title" className="text-lg font-bold">
            {editingEvent ? '일정 수정' : '새 일정 추가'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {conflictingEvents.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">시간이 겹치는 일정이 있습니다</p>
                <p className="text-xs mt-0.5">
                  {conflictingEvents
                    .map((c) => `${c.title} (${c.startTime}~${c.endTime})`)
                    .join(', ')}
                </p>
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="schedule-title"
              className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
            >
              제목
            </label>
            <input
              id="schedule-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 팀 프로젝트 회의, 필라테스 수업"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="schedule-date"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                날짜
              </label>
              <input
                id="schedule-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-sm tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor="schedule-start"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                시작 시간
              </label>
              <input
                id="schedule-start"
                type="time"
                value={startTime}
                disabled={noTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-sm tabular-nums disabled:opacity-45"
              />
            </div>
            <div>
              <label
                htmlFor="schedule-end"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                종료 시간
              </label>
              <input
                id="schedule-end"
                type="time"
                value={endTime}
                disabled={noTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-sm tabular-nums disabled:opacity-45"
              />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={noTime}
              onChange={(e) => setNoTime(e.target.checked)}
              className="rounded border-[var(--border-hairline)] accent-[var(--accent-primary)]"
            />
            <span>시간 지정 안 함 (시간 미정)</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="schedule-category"
                className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                카테고리
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {categoryKeys.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategory(cat);
                      setCustomCategoryColor(categoryColors[cat] || '#4F7760');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs border cursor-pointer transition-colors ${
                      category === cat
                        ? 'font-semibold border-[var(--text-primary)] bg-[var(--bg-subtle)]'
                        : 'border-[var(--border-hairline)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="schedule-category"
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="카테고리 직접 입력"
                  className="flex-1 min-w-[120px] px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-xs"
                />
                <div className="flex items-center gap-1 shrink-0">
                  {COLOR_PRESETS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setCustomCategoryColor(hex)}
                      aria-label={`색상 ${hex}`}
                      aria-pressed={customCategoryColor === hex}
                      className={`w-5 h-5 rounded-full cursor-pointer ${
                        customCategoryColor === hex ? 'ring-2 ring-offset-1 ring-[var(--text-primary)]' : ''
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                중요도
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[var(--bg-subtle)]">
                {(
                  [
                    { id: 'high', label: '높음' },
                    { id: 'medium', label: '보통' },
                    { id: 'low', label: '낮음' },
                  ] as const
                ).map((lvl) => (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setImportance(lvl.id)}
                    className={`py-1.5 rounded-lg text-xs cursor-pointer ${
                      importance === lvl.id
                        ? 'bg-[var(--bg-surface)] font-semibold shadow-xs'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              반복 설정
            </label>
            <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-[var(--bg-subtle)]">
              {(
                [
                  { id: 'none', label: '안 함' },
                  { id: 'daily', label: '매일' },
                  { id: 'weekly', label: '매주' },
                  { id: 'monthly', label: '매월' },
                ] as const
              ).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRepeat(r.id)}
                  className={`py-1.5 rounded-lg text-xs cursor-pointer ${
                    repeat === r.id
                      ? 'bg-[var(--bg-surface)] font-semibold shadow-xs'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {repeat === 'weekly' && (
              <div className="mt-2.5 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-[var(--text-muted)] mr-1">반복 요일:</span>
                  {WEEKDAY_NAMES.map((label, idx) => {
                    const active = weekdays.includes(idx);
                    return (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleWeekday(idx)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium border cursor-pointer ${
                          active
                            ? 'border-transparent font-semibold'
                            : 'border-[var(--border-hairline)] text-[var(--text-secondary)]'
                        }`}
                        style={
                          active
                            ? {
                                backgroundColor: 'var(--accent-primary)',
                                color: 'var(--accent-contrast)',
                              }
                            : undefined
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  요일을 선택하지 않으면 시작 날짜의 요일로 매주 반복됩니다.
                </p>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="schedule-memo"
              className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
            >
              메모
            </label>
            <textarea
              id="schedule-memo"
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="준비물이나 장소, 간단한 메모를 적어두세요."
              className="w-full px-3.5 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-sm resize-none"
            />
          </div>

          <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between gap-3">
            {editingEvent ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                    정말 삭제할까요?
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(editingEvent.id);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    삭제 확인
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>일정 삭제</span>
                </button>
              )
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm border border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-sm font-semibold cursor-pointer"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-contrast)',
                }}
              >
                {editingEvent ? '수정 저장' : '일정 등록'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
