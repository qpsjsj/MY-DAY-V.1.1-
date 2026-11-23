import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Send,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { AiPlanProposal, AppTab, PlannerState } from '../types/planner';
import { requiresUserConfirmation } from '../utils/aiPlannerExecutor';

export interface AiApplyFeedbackResult {
  appliedCount: number;
  savedOk: boolean;
  touchedDates: string[];
  appliedSummaries: string[];
  warnings: string[];
  errors: string[];
}

type AiErrorCategory =
  | 'rate_limit_transient'
  | 'quota_daily_or_plan'
  | 'billing_required'
  | 'auth_or_key_config'
  | 'model_not_found'
  | 'bad_request'
  | 'upstream_unavailable'
  | 'validation_error';

interface AiErrorInfo {
  category?: AiErrorCategory;
  httpStatus?: number;
  geminiStatus?: string;
  quotaDimension?: 'RPM' | 'TPM' | 'RPD' | 'TPD' | 'ZERO_QUOTA' | 'UNKNOWN';
  quotaMetric?: string;
  quotaId?: string;
  retryAfterSeconds?: number;
  resetAtIso?: string;
  resetAtKst?: string;
  cooldownActive?: boolean;
  durationMs?: number;
  attempts?: number;
  model?: string;
  projectHint?: string | null;
}

interface AiPlannerBarProps {
  todayKst: string;
  selectedDate: string;
  state: PlannerState;
  onApplyProposal: (proposal: AiPlanProposal) => AiApplyFeedbackResult;
  onUndoLastAiChange: () => void;
  canUndo: boolean;
  onOpenNewSchedule?: () => void;
  onNavigateTab?: (tab: AppTab) => void;
}

const EXAMPLE_PROMPTS = [
  '달력을 세이지 초록색 테마로 바꿔 줘',
  '강조 색상을 오션 블루로 바꿔 줘',
  '내일 오후 3시에 1시간 독서 일정을 추가해 줘',
  '오늘 할 일에 장보기 추가해 줘',
  '대시보드에 D-day 위젯을 표시해 줘',
  '매주 월·수요일 저녁 7시에 운동 일정을 등록해 줘',
];

export const AiPlannerBar: React.FC<AiPlannerBarProps> = ({
  todayKst,
  selectedDate,
  state,
  onApplyProposal,
  onUndoLastAiChange,
  canUndo,
  onOpenNewSchedule,
  onNavigateTab,
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorInfo, setErrorInfo] = useState<AiErrorInfo | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [lastFailedQuery, setLastFailedQuery] = useState('');
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [rpdResetCountdown, setRpdResetCountdown] = useState(0);
  const [pendingProposal, setPendingProposal] = useState<AiPlanProposal | null>(null);
  const [lastAppliedMessage, setLastAppliedMessage] = useState('');
  const [appliedWarnings, setAppliedWarnings] = useState<string[]>([]);

  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (retryCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setRetryCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryCountdown]);

  useEffect(() => {
    if (rpdResetCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setRpdResetCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [rpdResetCountdown]);

  const applyWithFeedback = (proposal: AiPlanProposal, prefix = '') => {
    const result = onApplyProposal(proposal);
    setAppliedWarnings(result.warnings);

    if (!result.savedOk || result.appliedCount === 0) {
      setLastAppliedMessage('');
      setErrorInfo(null);
      setErrorMsg(
        result.errors.join(' ') ||
          result.warnings.join(' ') ||
          '요청한 일정·작업의 유효성을 확인하지 못해 반영되지 않았습니다.'
      );
      return false;
    }

    const summaryText =
      result.appliedSummaries.length > 0
        ? result.appliedSummaries.join(' ')
        : proposal.explanation;
    setErrorInfo(null);
    setRpdResetCountdown(0);
    setErrorMsg(result.errors.length > 0 ? result.errors.join(' ') : '');
    setLastAppliedMessage(prefix ? `${prefix}${summaryText}` : summaryText);
    return true;
  };

  const handleSubmitPrompt = async (customPrompt?: string) => {
    const query = (customPrompt ?? prompt).trim();
    if (!query || inFlightRef.current || loading) return;

    if (
      errorInfo?.category === 'quota_daily_or_plan' &&
      errorInfo.quotaDimension !== 'ZERO_QUOTA' &&
      rpdResetCountdown > 0
    ) {
      const mins = Math.floor(rpdResetCountdown / 60);
      const secs = rpdResetCountdown % 60;
      setErrorMsg(
        `일일 한도(RPD) 초과 상태입니다. 불필요한 API 재호출을 방지하기 위해 초기화 시점(${
          errorInfo.resetAtKst ?? `약 ${mins}분 ${secs}초 후`
        })까지 AI 호출이 일시 대기 중입니다. 아래의 기본 플래너 기능은 즉시 사용하실 수 있습니다.`
      );
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    setErrorMsg('');
    setErrorInfo(null);
    setShowErrorDetails(false);
    setLastFailedQuery('');
    setPendingProposal(null);
    setLastAppliedMessage('');
    setAppliedWarnings([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Compact context keeps only essential fields to minimize TPM token consumption
      const compactContext = {
        todayKst,
        selectedDate,
        profile: {
          lifestyle: state.profile.lifestyle,
          busyHours: state.profile.busyHours,
        },
        design: {
          theme: state.design.theme,
          accent: state.design.accent,
          font: state.design.font,
          defaultView: state.design.defaultView,
          layout: state.design.layout,
        },
        widgets: state.widgets.map((w) => ({ id: w.id, visible: w.visible })),
        schedules: state.schedules.slice(-20).map((s) => ({
          id: s.id,
          title: s.title,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          category: s.category,
        })),
        todos: state.todos.slice(-20).map((t) => ({
          id: t.id,
          title: t.title,
          completed: t.completed,
          dueDate: t.dueDate,
          importance: t.importance,
        })),
        ddays: state.ddays.slice(0, 8).map((d) => ({
          id: d.id,
          title: d.title,
          targetDate: d.targetDate,
        })),
      };

      const res = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query, context: compactContext }),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => ({}))) as {
        proposal?: AiPlanProposal;
        error?: string;
        errorInfo?: AiErrorInfo;
      };
      if (!res.ok || !data.proposal) {
        const info = data.errorInfo ?? {
          httpStatus: res.status,
          category: res.status >= 500 ? 'upstream_unavailable' : 'bad_request',
        };
        setErrorInfo(info);
        setRetryCountdown(
          info.category === 'rate_limit_transient' &&
            typeof info.retryAfterSeconds === 'number' &&
            info.retryAfterSeconds > 0
            ? Math.min(120, info.retryAfterSeconds)
            : 0
        );
        setRpdResetCountdown(
          info.category === 'quota_daily_or_plan' &&
            typeof info.retryAfterSeconds === 'number' &&
            info.retryAfterSeconds > 0
            ? info.retryAfterSeconds
            : 0
        );
        setLastFailedQuery(query);
        setErrorMsg(
          data.error ||
            `AI 요청을 처리할 수 없습니다(HTTP ${res.status}). 기본 달력과 위젯 기능은 정상적으로 사용하실 수 있습니다.`
        );
        return;
      }

      const proposal = data.proposal;
      const operations = Array.isArray(proposal.operations) ? proposal.operations : [];

      if (proposal.intent === 'unsupported') {
        setPendingProposal({ ...proposal, operations: [] });
        return;
      }

      if (proposal.intent === 'schedule_analysis' && operations.length === 0) {
        setPendingProposal({ ...proposal, operations: [] });
        return;
      }

      if (operations.length === 0) {
        setErrorInfo({ category: 'validation_error', httpStatus: 422 });
        setErrorMsg(
          'AI 응답에서 실제로 등록하거나 변경할 작업 데이터를 확인하지 못했습니다. 날짜와 일정을 구체적으로 입력해 주세요.'
        );
        return;
      }

      if (!requiresUserConfirmation(proposal)) {
        const applied = applyWithFeedback(proposal);
        if (applied) {
          setPrompt('');
        }
      } else {
        setPendingProposal(proposal);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setErrorInfo({ category: 'upstream_unavailable' });
      setLastFailedQuery(query);
      setErrorMsg(
        '서버와 통신하는 중 문제가 발생했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요. 기본 달력·할 일 기능은 계속 이용하실 수 있습니다.'
      );
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  const canOfferRetryButton =
    Boolean(lastFailedQuery) &&
    (errorInfo?.category === 'rate_limit_transient' ||
      errorInfo?.category === 'upstream_unavailable' ||
      errorInfo?.category === undefined);

  const needsAdminOrQuotaDashboardHint =
    errorInfo?.category === 'quota_daily_or_plan' ||
    errorInfo?.category === 'billing_required' ||
    errorInfo?.category === 'auth_or_key_config' ||
    errorInfo?.category === 'model_not_found';

  const formatCountdown = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}시간 ${m}분 ${s}초`;
    if (m > 0) return `${m}분 ${s}초`;
    return `${s}초`;
  };

  return (
    <section className="planner-surface rounded-2xl p-4 sm:p-5 space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmitPrompt();
        }}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
      >
        <div className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] focus-within:border-[var(--accent-primary)]">
          <Sparkles className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="어떤 기능이 필요하세요? 원하는 대로 말해 보세요."
            className="w-full bg-transparent text-sm focus:outline-none placeholder:text-[var(--text-muted)]"
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          aria-busy={loading}
          className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--accent-contrast)',
          }}
        >
          <Send className="w-3.5 h-3.5" />
          <span>{loading ? '분석 중...' : 'AI에게 요청'}</span>
        </button>
      </form>

      {/* Quick Request Examples */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <span className="text-[11px] text-[var(--text-muted)] whitespace-nowrap shrink-0 mr-1">
          예시 요청:
        </span>
        {EXAMPLE_PROMPTS.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={loading}
            onClick={() => {
              if (inFlightRef.current || loading) return;
              setPrompt(ex);
              handleSubmitPrompt(ex);
            }}
            className="px-2.5 py-1 rounded-lg text-[11px] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Error State */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 space-y-2.5 text-sm text-red-700 dark:text-red-300">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="leading-relaxed font-medium">{errorMsg}</p>
              {errorInfo?.category === 'quota_daily_or_plan' && (
                <div className="text-xs opacity-90 space-y-1 pt-0.5">
                  {(errorInfo.resetAtKst || rpdResetCountdown > 0) && (
                    <p className="tabular-nums">
                      다음 초기화 예정:{' '}
                      <strong>{errorInfo.resetAtKst ?? '일일 할당량 리셋 시점'}</strong>
                      {rpdResetCountdown > 0 && ` (남은 시간 약 ${formatCountdown(rpdResetCountdown)})`}
                    </p>
                  )}
                  <p>
                    사용량 확인: Google AI Studio / Google Cloud 할당량 대시보드에서 일일 한도 및 요금제를 확인할 수 있습니다.
                  </p>
                </div>
              )}
              {needsAdminOrQuotaDashboardHint && errorInfo?.category !== 'quota_daily_or_plan' && (
                <p className="text-xs opacity-90">
                  안내: 관리자는 배포 환경의 GEMINI_API_KEY, 연결된 Google Cloud 프로젝트, 결제 및 모델 권한 설정을 확인해 주세요.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setErrorInfo(null);
                setShowErrorDetails(false);
                setRpdResetCountdown(0);
              }}
              aria-label="안내 닫기"
              className="p-1 rounded hover:bg-black/5 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {errorInfo?.category === 'quota_daily_or_plan' && (
            <div className="rounded-lg bg-[var(--bg-surface)]/80 border border-[var(--border-hairline)] p-3 text-xs text-[var(--text-primary)] space-y-2">
              <div className="space-y-1">
                <p className="font-semibold">
                  지금 바로 가능한 기본 기능 (AI 한도 미사용) · 현재 불가한 AI 기능
                </p>
                <p className="text-[var(--text-secondary)]">
                  • <strong>가능</strong>: 일정 직접 등록·수정·삭제, 할 일·루틴·체크리스트 관리, 테마·위젯 설정, 로컬 일정 충돌 분석
                </p>
                <p className="text-[var(--text-secondary)]">
                  • <strong>현재 불가</strong>: 자유 자연어 AI 플래너 생성, AI 맞춤 일정 추천, 자연어 일괄 수정 (한도 초기화 후 이용 가능)
                </p>
              </div>
              {(onOpenNewSchedule || onNavigateTab) && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {onOpenNewSchedule && (
                    <button
                      type="button"
                      onClick={onOpenNewSchedule}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-subtle)] font-medium cursor-pointer"
                    >
                      <CalendarPlus className="w-3 h-3 text-[var(--accent-primary)]" />
                      <span>새 일정 직접 추가</span>
                    </button>
                  )}
                  {onNavigateTab && (
                    <>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('calendar')}
                        className="px-2.5 py-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-subtle)] font-medium cursor-pointer"
                      >
                        달력에서 일정 수정
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('settings')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-subtle)] font-medium cursor-pointer"
                      >
                        <Settings className="w-3 h-3" />
                        <span>테마·위젯 설정</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {canOfferRetryButton && (
              <button
                type="button"
                disabled={loading || retryCountdown > 0}
                onClick={() => handleSubmitPrompt(lastFailedQuery)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-red-500/30 bg-white/70 dark:bg-black/20 hover:bg-white dark:hover:bg-black/30 disabled:opacity-50 cursor-pointer tabular-nums"
              >
                <RotateCcw className="w-3 h-3" />
                <span>
                  {retryCountdown > 0
                    ? `다시 시도 (${retryCountdown}초 후 가능)`
                    : '다시 시도'}
                </span>
              </button>
            )}
            {errorInfo && (
              <button
                type="button"
                onClick={() => setShowErrorDetails((prev) => !prev)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs opacity-80 hover:opacity-100 cursor-pointer"
              >
                <span>오류 상세</span>
                {showErrorDetails ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            )}
          </div>

          {showErrorDetails && errorInfo && (
            <div className="text-xs rounded-lg bg-black/5 dark:bg-black/25 px-3 py-2 space-y-0.5 tabular-nums">
              <p>
                상태 코드: {errorInfo.httpStatus ?? '미확인'}
                {errorInfo.geminiStatus ? ` (${errorInfo.geminiStatus})` : ''}
                {errorInfo.quotaDimension ? ` · 초과 항목: ${errorInfo.quotaDimension}` : ''}
                {errorInfo.cooldownActive ? ' · 중복 호출 차단 적용됨' : ''}
              </p>
              {(errorInfo.quotaId || errorInfo.quotaMetric) && (
                <p className="truncate">
                  제한 상세: {errorInfo.quotaId ? `${errorInfo.quotaId}` : ''}
                  {errorInfo.quotaId && errorInfo.quotaMetric ? ' · ' : ''}
                  {errorInfo.quotaMetric ?? ''}
                </p>
              )}
              <p>
                원인 분류: {errorInfo.category ?? 'unknown'}
                {errorInfo.model ? ` · 모델: ${errorInfo.model}` : ''}
                {typeof errorInfo.durationMs === 'number'
                  ? ` · 처리 시간: ${errorInfo.durationMs}ms`
                  : ''}
                {typeof errorInfo.attempts === 'number'
                  ? ` · 시도 횟수: ${errorInfo.attempts}`
                  : ''}
              </p>
              {errorInfo.projectHint && (
                <p>응답 프로젝트 식별자: {errorInfo.projectHint}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Immediate Applied Confirmation + Undo */}
      {lastAppliedMessage && (
        <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] space-y-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
              <span>{lastAppliedMessage}</span>
            </div>
            <div className="flex items-center gap-2">
              {canUndo && (
                <button
                  type="button"
                  onClick={() => {
                    onUndoLastAiChange();
                    setLastAppliedMessage('');
                    setAppliedWarnings([]);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-[var(--border-hairline)] bg-[var(--bg-surface)] cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>되돌리기</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setLastAppliedMessage('');
                  setAppliedWarnings([]);
                }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>

          {appliedWarnings.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300 pt-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{appliedWarnings.join(' ')}</span>
            </div>
          )}
        </div>
      )}

      {/* Proposal Confirmation Card */}
      {pendingProposal && (
        <div className="p-4 rounded-xl bg-[var(--bg-canvas)] border border-[var(--accent-primary)] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--accent-primary)]">
                {pendingProposal.intentLabel}
              </span>
              {pendingProposal.operations.length > 0 &&
                pendingProposal.intent !== 'unsupported' && (
                  <span className="text-[11px] text-[var(--text-muted)]">
                    · 실행 전 확인 필요 ({pendingProposal.operations.length}건)
                  </span>
                )}
            </div>
            <button
              type="button"
              onClick={() => setPendingProposal(null)}
              aria-label="제안 닫기"
              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-sm font-medium leading-relaxed">{pendingProposal.explanation}</p>

          {pendingProposal.previewSummary.length > 0 && (
            <ul className="space-y-1 text-xs text-[var(--text-secondary)] list-disc list-inside">
              {pendingProposal.previewSummary.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}

          {pendingProposal.operations.length > 0 && pendingProposal.intent !== 'unsupported' && (
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const applied = applyWithFeedback(pendingProposal, '적용 완료: ');
                  setPendingProposal(null);
                  if (applied) setPrompt('');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-contrast)',
                }}
              >
                <Check className="w-3.5 h-3.5" />
                <span>확인하고 적용하기</span>
              </button>
              <button
                type="button"
                onClick={() => setPendingProposal(null)}
                className="px-4 py-2 rounded-xl text-xs border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                취소
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
