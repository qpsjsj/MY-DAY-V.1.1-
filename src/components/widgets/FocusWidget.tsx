import React, { useEffect, useState } from 'react';
import { Pause, Play, Plus, Trash2 } from 'lucide-react';
import { FocusEntry } from '../../types/planner';

interface FocusWidgetProps {
  todayKst: string;
  entries: FocusEntry[];
  onAddEntry: (entry: FocusEntry) => void;
  onAddMinutes: (id: string, minutes: number) => void;
  onDeleteEntry: (id: string) => void;
}

export const FocusWidget: React.FC<FocusWidgetProps> = ({
  todayKst,
  entries,
  onAddEntry,
  onAddMinutes,
  onDeleteEntry,
}) => {
  const [subject, setSubject] = useState('');
  const [targetMinutes, setTargetMinutes] = useState(60);
  const [activeTimerId, setActiveTimerId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!activeTimerId) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeTimerId]);

  const handleToggleTimer = (id: string) => {
    if (activeTimerId === id) {
      const gainedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
      if (elapsedSeconds >= 5) {
        onAddMinutes(id, gainedMinutes);
      }
      setActiveTimerId(null);
      setElapsedSeconds(0);
    } else {
      if (activeTimerId && elapsedSeconds >= 5) {
        onAddMinutes(activeTimerId, Math.max(1, Math.round(elapsedSeconds / 60)));
      }
      setActiveTimerId(id);
      setElapsedSeconds(0);
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = subject.trim();
    if (!trimmed) return;
    const clampedTarget = Math.min(1440, Math.max(5, Number(targetMinutes) || 60));
    onAddEntry({
      id: `foc-${Date.now()}`,
      subject: trimmed,
      targetMinutes: clampedTarget,
      actualMinutes: 0,
      date: todayKst,
    });
    setSubject('');
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="planner-surface rounded-2xl p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold">공부 및 업무 시간 관리</h3>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          과목·업무별 목표 시간과 실제 집중 시간을 기록합니다.
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="과목 또는 업무명"
          className="flex-1 min-w-[140px] px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-sm"
        />
        <input
          type="number"
          min={10}
          step={10}
          value={targetMinutes}
          onChange={(e) => setTargetMinutes(Number(e.target.value))}
          className="w-20 px-2.5 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-sm tabular-nums"
          aria-label="목표 분"
        />
        <span className="text-xs text-[var(--text-muted)]">분</span>
        <button
          type="submit"
          disabled={!subject.trim()}
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

      <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
        {entries.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] py-6 text-center">
            등록된 집중 계획이 없습니다.
          </p>
        ) : (
          entries.map((entry) => {
            const pct = Math.min(
              100,
              Math.round((entry.actualMinutes / Math.max(1, entry.targetMinutes)) * 100)
            );
            const isRunning = activeTimerId === entry.id;

            return (
              <div
                key={entry.id}
                className="group p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{entry.subject}</p>
                    <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                      실제 {entry.actualMinutes}분 / 목표 {entry.targetMinutes}분 ({pct}%)
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleTimer(entry.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-hairline)] bg-[var(--bg-surface)] cursor-pointer tabular-nums"
                    >
                      {isRunning ? (
                        <>
                          <Pause className="w-3 h-3 text-amber-600" />
                          <span>{formatTimer(elapsedSeconds)}</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 text-[var(--accent-primary)]" />
                          <span>집중</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onAddMinutes(entry.id, 15)}
                      className="px-2 py-1.5 rounded-lg text-[11px] bg-[var(--bg-subtle)] hover:opacity-80 cursor-pointer tabular-nums"
                    >
                      +15분
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (activeTimerId === entry.id) {
                          setActiveTimerId(null);
                          setElapsedSeconds(0);
                        }
                        onDeleteEntry(entry.id);
                      }}
                      aria-label="집중 항목 삭제"
                      className="p-1 text-[var(--text-muted)] hover:text-red-600 opacity-70 group-hover:opacity-100 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="h-1.5 w-full rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: 'var(--accent-primary)',
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
