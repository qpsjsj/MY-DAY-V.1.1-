import React, { useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { NoteItem } from '../../types/planner';
import { formatKoreanMonthDay, isValidYmd } from '../../utils/dateKst';

interface NoteWidgetProps {
  selectedDate: string;
  notes: NoteItem[];
  onSaveNote: (note: NoteItem) => void;
  onDeleteNote: (id: string) => void;
}

export const NoteWidget: React.FC<NoteWidgetProps> = ({
  selectedDate,
  notes,
  onSaveNote,
  onDeleteNote,
}) => {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [linkDate, setLinkDate] = useState(selectedDate);
  const [isComposing, setIsComposing] = useState(false);
  const [formError, setFormError] = useState('');

  const filtered = notes
    .filter((n) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  const startNew = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setLinkDate(selectedDate);
    setFormError('');
    setIsComposing(true);
  };

  const startEdit = (note: NoteItem) => {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setLinkDate(note.date);
    setFormError('');
    setIsComposing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !content.trim()) {
      setFormError('메모 제목 또는 내용을 입력해 주세요.');
      return;
    }
    setFormError('');
    onSaveNote({
      id: editingId || `note-${Date.now()}`,
      title: title.trim() || '제목 없는 메모',
      content: content.trim(),
      date: isValidYmd(linkDate) ? linkDate : selectedDate,
      updatedAt: new Date().toISOString(),
    });
    setIsComposing(false);
    setEditingId(null);
    setTitle('');
    setContent('');
  };

  return (
    <div className="planner-surface rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold">메모</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            날짜와 연결된 빠른 기록과 검색
          </p>
        </div>

        <button
          type="button"
          onClick={startNew}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--accent-contrast)',
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>새 메모</span>
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)]">
        <Search className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="메모 제목이나 내용 검색..."
          className="w-full bg-transparent text-xs focus:outline-none"
        />
      </div>

      {isComposing && (
        <form
          onSubmit={handleSave}
          className="p-3.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--accent-primary)] space-y-2.5"
        >
          {formError && (
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">
              {formError}
            </p>
          )}
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (formError) setFormError('');
            }}
            placeholder="메모 제목"
            aria-label="메모 제목"
            className="w-full px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-sm font-semibold"
          />
          <textarea
            rows={3}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (formError) setFormError('');
            }}
            placeholder="아이디어, 회의 요약, 기억할 내용을 적어보세요."
            aria-label="메모 내용"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-xs leading-relaxed resize-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              type="date"
              value={linkDate}
              onChange={(e) => setLinkDate(e.target.value)}
              aria-label="연결 날짜"
              className="px-2.5 py-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-xs tabular-nums"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsComposing(false)}
                className="px-3 py-1.5 rounded-lg text-xs border border-[var(--border-hairline)] cursor-pointer"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
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
      )}

      <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] py-6 text-center">
            {search ? '검색 결과가 없습니다.' : '작성된 메모가 없습니다.'}
          </p>
        ) : (
          filtered.map((note) => (
            <div
              key={note.id}
              className="group p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] space-y-1"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{note.title}</p>
                  <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                    연결 날짜: {formatKoreanMonthDay(note.date)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(note)}
                    aria-label="메모 수정"
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteNote(note.id)}
                    aria-label="메모 삭제"
                    className="p-1 text-[var(--text-muted)] hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {note.content && (
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-line line-clamp-3">
                  {note.content}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
