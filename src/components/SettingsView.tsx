import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Download,
  FolderPlus,
  Pencil,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { CloudSaveStatus, SaveStatusIndicator } from './AccountControls';
import {
  AccentId,
  CalendarViewMode,
  DesignSettings,
  FontChoice,
  LayoutStyle,
  NotificationSettings,
  PlannerRecord,
  PlannerState,
  PlannerWorkspace,
  ThemeId,
  UserProfile,
} from '../types/planner';
import {
  ACCENT_OPTIONS,
  THEME_OPTIONS,
} from '../utils/sampleData';
import { isValidHhmm } from '../utils/dateKst';
import { validateImportedBackup } from '../utils/storage';
import { WidgetOrderManager } from './WidgetOrderManager';

interface SettingsViewProps {
  workspace: PlannerWorkspace;
  state: PlannerState;
  onUpdateDesign: (patch: Partial<DesignSettings>) => void;
  onUpdateProfile: (patch: Partial<UserProfile>) => void;
  onUpdateNotifications: (patch: Partial<NotificationSettings>) => void;
  onToggleWidgetVisible: (id: string) => void;
  onMoveWidgetOrder: (index: number, direction: -1 | 1) => void;
  onToggleWidgetSize: (id: string) => void;
  onOpenNewCustomWidget: () => void;
  onDeleteCustomWidget: (id: string) => void;
  onCreateBlankPlanner: (name?: string) => void;
  onSwitchPlanner: (plannerId: string) => void;
  onRenamePlanner: (plannerId: string, name: string) => void;
  onDeletePlanner: (plannerId: string) => { ok: boolean; error?: string };
  onImportBackup: (
    result:
      | { kind: 'workspace'; workspace: PlannerWorkspace }
      | { kind: 'single'; state: PlannerState }
  ) => void;
  onRestartOnboarding: () => void;
  user?: User | null;
  saveStatus?: CloudSaveStatus;
  lastSavedAt?: string | null;
  saveErrorMsg?: string | null;
  guestDraftAvailable?: boolean;
  onManualSave?: () => void;
  onRetrySave?: () => void;
  onOpenAuth?: (mode: 'login' | 'signup', reason?: string) => void;
  onImportGuestDraft?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  workspace,
  state,
  onUpdateDesign,
  onUpdateProfile,
  onUpdateNotifications,
  onToggleWidgetVisible,
  onMoveWidgetOrder,
  onToggleWidgetSize,
  onOpenNewCustomWidget,
  onDeleteCustomWidget,
  onCreateBlankPlanner,
  onSwitchPlanner,
  onRenamePlanner,
  onDeletePlanner,
  onImportBackup,
  onRestartOnboarding,
  user = null,
  saveStatus = 'guest',
  lastSavedAt = null,
  saveErrorMsg = null,
  guestDraftAvailable = false,
  onManualSave,
  onRetrySave,
  onOpenAuth,
  onImportGuestDraft,
}) => {
  const activePlanner: PlannerRecord | undefined = workspace.planners.find(
    (p) => p.plannerId === workspace.activePlannerId
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingPlannerId, setEditingPlannerId] = useState<string | null>(null);
  const [editingPlannerName, setEditingPlannerName] = useState('');
  const [plannerError, setPlannerError] = useState('');
  const [plannerSuccess, setPlannerSuccess] = useState('');
  const [plannerNameDraft, setPlannerNameDraft] = useState(activePlanner?.name || '');
  const [backupMessage, setBackupMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPlannerNameDraft(activePlanner?.name || '');
    setConfirmDeleteId(null);
    setEditingPlannerId(null);
    setPlannerError('');
  }, [workspace.activePlannerId, activePlanner?.name]);

  const submitPlannerRename = (plannerId: string, rawName: string) => {
    const trimmed = rawName.trim();
    if (!trimmed) {
      setPlannerSuccess('');
      setPlannerError('플래너 이름을 한 글자 이상 입력해 주세요.');
      return;
    }
    onRenamePlanner(plannerId, trimmed);
    setPlannerError('');
    setEditingPlannerId(null);
    setPlannerSuccess(`'${trimmed}'(으)로 플래너 이름을 저장했습니다.`);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(workspace, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `myday-planner-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupMessage({
      type: 'success',
      text: '백업 파일(myday-planner-backup.json)을 내려받았습니다.',
    });
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setBackupMessage({
        type: 'error',
        text: '파일 크기가 너무 큽니다. 2MB 이하의 백업 JSON 파일을 선택해 주세요.',
      });
      return;
    }
    try {
      const text = await file.text();
      const result = validateImportedBackup(text);
      if (!result.ok) {
        setBackupMessage({ type: 'error', text: result.error });
        return;
      }
      if (result.kind === 'workspace') {
        onImportBackup({ kind: 'workspace', workspace: result.workspace });
        setBackupMessage({
          type: 'success',
          text: `전체 플래너(${result.workspace.planners.length}개) 백업을 복원했습니다.`,
        });
      } else {
        onImportBackup({ kind: 'single', state: result.state });
        setBackupMessage({
          type: 'success',
          text: '백업 플래너를 새 플래너로 추가해 복원했습니다.',
        });
      }
    } catch {
      setBackupMessage({
        type: 'error',
        text: '백업 파일을 읽는 중 오류가 발생했습니다.',
      });
    }
  };

  const activeTheme =
    THEME_OPTIONS.find((t) => t.id === state.design.theme) ?? THEME_OPTIONS[0];
  const activeAccent =
    ACCENT_OPTIONS.find((a) => a.id === state.design.accent) ?? ACCENT_OPTIONS[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">플래너 커스터마이징</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            변경 사항은 즉시 화면에 반영되며 브라우저에 자동 저장됩니다.
          </p>
        </div>

        {/* Immediate Live Preview Pill Summary */}
        <div className="planner-surface rounded-xl px-4 py-2.5 flex items-center gap-3 text-xs">
          <span
            className="w-3.5 h-3.5 rounded-full shrink-0"
            style={{ backgroundColor: activeAccent.primary }}
          />
          <span className="font-semibold">
            {activeTheme.label} · {activeAccent.label}
          </span>
          <span className="text-[var(--text-muted)]">·</span>
          <span className="text-[var(--text-secondary)]">
            {state.design.layout === 'simple'
              ? '심플형'
              : state.design.layout === 'diary'
              ? '다이어리형'
              : '시간표형'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Design & Calendar Settings */}
        <div className="lg:col-span-7 space-y-6">
          <section className="planner-surface rounded-2xl p-5 sm:p-6 space-y-5">
            <h3 className="text-base font-bold">테마 · 색상 · 글꼴</h3>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
                테마 배경
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {THEME_OPTIONS.map((t) => {
                  const selected = state.design.theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onUpdateDesign({ theme: t.id as ThemeId })}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        selected
                          ? 'ring-2 ring-[var(--accent-primary)] border-transparent bg-[var(--bg-canvas)]'
                          : 'border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-4 h-4 rounded border border-black/15 shrink-0"
                          style={{ backgroundColor: t.swatchBg }}
                        />
                        <span className="text-xs font-semibold truncate">{t.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
                강조 색상
              </label>
              <div className="flex flex-wrap gap-2">
                {ACCENT_OPTIONS.map((a) => {
                  const selected = state.design.accent === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onUpdateDesign({ accent: a.id as AccentId })}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${
                        selected
                          ? 'border-[var(--text-primary)] font-semibold bg-[var(--bg-subtle)]'
                          : 'border-[var(--border-hairline)]'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: a.primary }}
                      />
                      <span>{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
                글꼴
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'sans', label: '깔끔한 고딕' },
                    { id: 'rounded', label: '부드러운 둥근체' },
                    { id: 'serif', label: '차분한 명조체' },
                    { id: 'mono', label: '정갈한 모노체' },
                  ] as Array<{ id: FontChoice; label: string }>
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onUpdateDesign({ font: f.id })}
                    className={`py-2 px-3 rounded-xl border text-xs cursor-pointer ${
                      state.design.font === f.id
                        ? 'border-[var(--accent-primary)] bg-[var(--bg-subtle)] font-semibold'
                        : 'border-[var(--border-hairline)]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="planner-surface rounded-2xl p-5 sm:p-6 space-y-5">
            <h3 className="text-base font-bold">달력 레이아웃 및 표시 방식</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
                  달력 레이아웃
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[var(--bg-subtle)]">
                  {(
                    [
                      { id: 'simple', label: '심플형' },
                      { id: 'diary', label: '다이어리형' },
                      { id: 'timetable', label: '시간표형' },
                    ] as Array<{ id: LayoutStyle; label: string }>
                  ).map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => onUpdateDesign({ layout: l.id })}
                      className={`py-1.5 rounded-lg text-xs cursor-pointer ${
                        state.design.layout === l.id
                          ? 'bg-[var(--bg-surface)] font-semibold shadow-xs'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
                  기본 달력 보기
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[var(--bg-subtle)]">
                  {(
                    [
                      { id: 'month', label: '월간' },
                      { id: 'week', label: '주간' },
                      { id: 'day', label: '일간' },
                    ] as Array<{ id: CalendarViewMode; label: string }>
                  ).map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onUpdateDesign({ defaultView: v.id })}
                      className={`py-1.5 rounded-lg text-xs cursor-pointer ${
                        state.design.defaultView === v.id
                          ? 'bg-[var(--bg-surface)] font-semibold shadow-xs'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
                  주간 시작 요일
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--bg-subtle)]">
                  <button
                    type="button"
                    onClick={() => onUpdateDesign({ weekStart: 'monday' })}
                    className={`py-1.5 rounded-lg text-xs cursor-pointer ${
                      state.design.weekStart === 'monday'
                        ? 'bg-[var(--bg-surface)] font-semibold shadow-xs'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    월요일 시작
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateDesign({ weekStart: 'sunday' })}
                    className={`py-1.5 rounded-lg text-xs cursor-pointer ${
                      state.design.weekStart === 'sunday'
                        ? 'bg-[var(--bg-surface)] font-semibold shadow-xs'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    일요일 시작
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
                  시간 표시 방식
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--bg-subtle)]">
                  <button
                    type="button"
                    onClick={() => onUpdateDesign({ timeFormat: '24h' })}
                    className={`py-1.5 rounded-lg text-xs cursor-pointer ${
                      state.design.timeFormat === '24h'
                        ? 'bg-[var(--bg-surface)] font-semibold shadow-xs'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    24시간제
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateDesign({ timeFormat: '12h' })}
                    className={`py-1.5 rounded-lg text-xs cursor-pointer ${
                      state.design.timeFormat === '12h'
                        ? 'bg-[var(--bg-surface)] font-semibold shadow-xs'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    12시간제
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Notifications & Profile */}
          <section className="planner-surface rounded-2xl p-5 sm:p-6 space-y-5">
            <h3 className="text-base font-bold">알림 및 사용자 프로필</h3>

            <div className="space-y-3">
              <label className="flex items-center justify-between gap-3 text-sm cursor-pointer">
                <span>일정 시간 충돌 경고 표시</span>
                <input
                  type="checkbox"
                  checked={state.notifications.conflictAlert}
                  onChange={(e) =>
                    onUpdateNotifications({ conflictAlert: e.target.checked })
                  }
                  className="w-4 h-4 accent-[var(--accent-primary)]"
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm cursor-pointer">
                <span>마감 임박 할 일 · D-day 알림 표시</span>
                <input
                  type="checkbox"
                  checked={state.notifications.deadlineAlert}
                  onChange={(e) =>
                    onUpdateNotifications({ deadlineAlert: e.target.checked })
                  }
                  className="w-4 h-4 accent-[var(--accent-primary)]"
                />
              </label>
              <div className="flex items-center justify-between gap-3 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.notifications.dailySummary}
                    onChange={(e) =>
                      onUpdateNotifications({ dailySummary: e.target.checked })
                    }
                    className="w-4 h-4 accent-[var(--accent-primary)]"
                  />
                  <span>하루 요약 기준 시간</span>
                </label>
                <input
                  type="time"
                  value={state.notifications.summaryTime}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (isValidHhmm(val)) {
                      onUpdateNotifications({ summaryTime: val });
                    }
                  }}
                  aria-label="하루 요약 기준 시간"
                  className="px-2.5 py-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-xs tabular-nums"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--border-hairline)] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  생활 유형
                </label>
                <select
                  value={state.profile.lifestyle}
                  onChange={(e) =>
                    onUpdateProfile({
                      lifestyle: e.target.value as UserProfile['lifestyle'],
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                >
                  {['학생', '대학생', '직장인', '프리랜서', '취업 준비생', '기타'].map(
                    (l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  연령대
                </label>
                <select
                  value={state.profile.ageGroup}
                  onChange={(e) =>
                    onUpdateProfile({
                      ageGroup: e.target.value as UserProfile['ageGroup'],
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                >
                  {['10대 이하', '10대', '20대', '30대', '40대', '50대 이상'].map(
                    (a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </section>
        </div>

        {/* Widget Management & Data Controls */}
        <div className="lg:col-span-5 space-y-6">
          <WidgetOrderManager
            title="대시보드 위젯 표시 및 순서"
            description="순서를 바꾸거나 필요한 위젯만 표시할 수 있습니다."
            widgets={state.widgets}
            customWidgets={state.customWidgets}
            allowDeleteCustom
            onToggleVisible={onToggleWidgetVisible}
            onMoveOrder={onMoveWidgetOrder}
            onToggleSize={onToggleWidgetSize}
            onOpenNewCustomWidget={onOpenNewCustomWidget}
            onDeleteCustomWidget={onDeleteCustomWidget}
          />

          <section className="planner-surface rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold">플래너 목록 및 데이터 분리 관리</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  각 플래너는 고유 ID로 일정·할 일·메모·테마가 독립 저장됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onCreateBlankPlanner()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-contrast)',
                }}
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>빈 플래너 만들기</span>
              </button>
            </div>

            {activePlanner && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={plannerNameDraft}
                  onChange={(e) => {
                    setPlannerNameDraft(e.target.value);
                    if (plannerError) setPlannerError('');
                    if (plannerSuccess) setPlannerSuccess('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitPlannerRename(activePlanner.plannerId, plannerNameDraft);
                    }
                  }}
                  aria-label="현재 플래너 이름"
                  placeholder="현재 플래너 이름 입력"
                  maxLength={40}
                  className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-xs"
                />
                <button
                  type="button"
                  onClick={() => submitPlannerRename(activePlanner.plannerId, plannerNameDraft)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-subtle)] cursor-pointer shrink-0"
                >
                  이름 저장
                </button>
              </div>
            )}

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {workspace.planners.map((p) => {
                const isActive = p.plannerId === workspace.activePlannerId;
                const isConfirmingDelete = confirmDeleteId === p.plannerId;
                const isEditingRow = editingPlannerId === p.plannerId;
                return (
                  <div
                    key={p.plannerId}
                    className={`rounded-xl border p-3 space-y-2 ${
                      isActive
                        ? 'border-[var(--accent-primary)] bg-[var(--bg-canvas)]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-surface)]'
                    }`}
                  >
                    {isEditingRow ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingPlannerName}
                          onChange={(e) => setEditingPlannerName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              submitPlannerRename(p.plannerId, editingPlannerName);
                            } else if (e.key === 'Escape') {
                              setEditingPlannerId(null);
                              setPlannerError('');
                            }
                          }}
                          aria-label={`${p.name} 새 이름`}
                          maxLength={40}
                          autoFocus
                          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-[var(--accent-primary)] bg-[var(--bg-surface)] text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => submitPlannerRename(p.plannerId, editingPlannerName)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0"
                          style={{
                            backgroundColor: 'var(--accent-primary)',
                            color: 'var(--accent-contrast)',
                          }}
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPlannerId(null);
                            setPlannerError('');
                          }}
                          aria-label="이름 변경 취소"
                          className="p-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] cursor-pointer shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onSwitchPlanner(p.plannerId)}
                          className="flex-1 min-w-0 text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5">
                            {isActive && (
                              <Check className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                            )}
                            <span className="text-xs font-semibold truncate">{p.name}</span>
                          </div>
                          <p className="text-[11px] text-[var(--text-muted)] mt-0.5 tabular-nums">
                            일정 {p.data.schedules.length}건 · 할 일 {p.data.todos.length}건 · 메모{' '}
                            {p.data.notes.length}건
                          </p>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setPlannerError('');
                              setPlannerSuccess('');
                              setConfirmDeleteId(null);
                              setEditingPlannerId(p.plannerId);
                              setEditingPlannerName(p.name);
                            }}
                            aria-label={`${p.name} 이름 변경`}
                            title="플래너 이름 변경"
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setPlannerError('');
                              setPlannerSuccess('');
                              setEditingPlannerId(null);
                              setConfirmDeleteId(p.plannerId);
                            }}
                            aria-label={`${p.name} 삭제`}
                            disabled={workspace.planners.length <= 1}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-600 disabled:opacity-35 cursor-pointer"
                            title={
                              workspace.planners.length <= 1
                                ? '최소 1개의 플래너가 필요합니다'
                                : '이 플래너 삭제'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {isConfirmingDelete && (
                      <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 space-y-2">
                        <p className="text-[11px] text-red-700 dark:text-red-300 font-medium">
                          '{p.name}' 플래너와 해당 일정·메모만 삭제됩니다. 다른 플래너는 보존됩니다.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const res = onDeletePlanner(p.plannerId);
                              if (!res.ok && res.error) {
                                setPlannerError(res.error);
                              }
                              setConfirmDeleteId(null);
                            }}
                            className="px-2.5 py-1 rounded bg-red-600 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            삭제 확인
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1 rounded text-[11px] border border-[var(--border-hairline)] bg-[var(--bg-surface)] cursor-pointer"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {plannerSuccess && (
              <p className="text-xs font-medium text-[var(--accent-primary)]">{plannerSuccess}</p>
            )}
            {plannerError && (
              <p className="text-xs text-red-600 dark:text-red-400">{plannerError}</p>
            )}
          </section>

          <section className="planner-surface rounded-2xl p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-bold">데이터 저장 · 복원 및 맞춤 마법사</h3>
            <p className="text-xs text-[var(--text-muted)]">
              {user
                ? '모든 플래너 변경 내용은 계정 클라우드(Firestore)에 자동 저장되며, JSON 파일로 백업하거나 복원할 수 있습니다.'
                : '현재 게스트 모드에서는 이 브라우저에만 임시 저장됩니다. 로그인하면 모든 기기에서 동기화할 수 있습니다.'}
            </p>

            {onManualSave && onRetrySave && (
              <div className="p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] space-y-2">
                <SaveStatusIndicator
                  status={saveStatus}
                  lastSavedAt={lastSavedAt}
                  errorMsg={saveErrorMsg}
                  onManualSave={onManualSave}
                  onRetrySave={onRetrySave}
                />
                {!user && onOpenAuth && (
                  <p className="text-[11px] text-[var(--text-muted)]">
                    계정에 저장하려면{' '}
                    <button
                      type="button"
                      onClick={() => onOpenAuth('login')}
                      className="text-[var(--accent-primary)] font-semibold hover:underline cursor-pointer"
                    >
                      로그인 또는 회원가입
                    </button>
                    을 진행해 주세요.
                  </p>
                )}
              </div>
            )}

            {user && guestDraftAvailable && onImportGuestDraft && (
              <div className="p-3 rounded-xl border border-[var(--accent-primary)]/40 bg-[var(--bg-canvas)] space-y-2">
                <p className="text-xs font-semibold">
                  로그인 전 이 기기에서 작성한 플래너 데이터가 있습니다.
                </p>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  기존 클라우드 플래너를 덮어쓰지 않고 새 플래너로 안전하게 계정에 추가할 수 있습니다.
                </p>
                <button
                  type="button"
                  onClick={onImportGuestDraft}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--accent-contrast)',
                  }}
                >
                  이 기기 플래너 계정에 추가하기
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
              aria-label="백업 JSON 파일 선택"
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>백업 JSON 내보내기</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>백업 JSON 복원</span>
              </button>

              <button
                type="button"
                onClick={onRestartOnboarding}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>새 맞춤 플래너 마법사 열기</span>
              </button>
            </div>

            {backupMessage && (
              <p
                className={`text-xs font-medium ${
                  backupMessage.type === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-[var(--accent-primary)]'
                }`}
              >
                {backupMessage.text}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
