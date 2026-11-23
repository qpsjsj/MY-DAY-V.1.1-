import React, { useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  AccentId,
  BuiltinWidgetId,
  CalendarViewMode,
  DesignSettings,
  FontChoice,
  LayoutStyle,
  ThemeId,
  UserProfile,
} from '../types/planner';
import {
  ACCENT_OPTIONS,
  BUILTIN_WIDGET_META,
  THEME_OPTIONS,
} from '../utils/sampleData';
import { SiteFooter } from './SiteFooter';

interface OnboardingFlowProps {
  initialProfile: UserProfile;
  initialDesign: DesignSettings;
  initialSelectedWidgets: BuiltinWidgetId[];
  onComplete: (
    profile: UserProfile,
    design: DesignSettings,
    selectedWidgets: BuiltinWidgetId[]
  ) => void;
  onSkip: () => void;
}

const AGE_GROUPS: UserProfile['ageGroup'][] = [
  '10대 이하',
  '10대',
  '20대',
  '30대',
  '40대',
  '50대 이상',
];

const GENDERS: NonNullable<UserProfile['gender']>[] = [
  '선택 안 함',
  '여성',
  '남성',
  '기타',
];

const LIFESTYLES: UserProfile['lifestyle'][] = [
  '학생',
  '대학생',
  '직장인',
  '프리랜서',
  '취업 준비생',
  '기타',
];

const PURPOSES = ['학업', '업무', '자기계발', '생활 관리', '취미', '기타'];

const BUSY_SLOTS = [
  { id: '09:00-12:00', label: '오전 (09:00~12:00)' },
  { id: '13:00-18:00', label: '오후 (13:00~18:00)' },
  { id: '19:00-22:00', label: '저녁 (19:00~22:00)' },
];

const ALL_WIDGET_KEYS: BuiltinWidgetId[] = [
  'calendar',
  'todos',
  'dday',
  'habits',
  'focus',
  'expenses',
  'notes',
  'routines',
  'checklists',
  'ai_recommend',
];

const FONT_OPTIONS: Array<{ id: FontChoice; label: string; sample: string }> = [
  { id: 'sans', label: '깔끔한 고딕', sample: '오늘의 일정과 목표' },
  { id: 'rounded', label: '부드러운 둥근체', sample: '오늘의 일정과 목표' },
  { id: 'serif', label: '차분한 명조체', sample: '오늘의 일정과 목표' },
  { id: 'mono', label: '정갈한 모노체', sample: '09:30 일정 관리' },
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  initialProfile,
  initialDesign,
  initialSelectedWidgets,
  onComplete,
  onSkip,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [design, setDesign] = useState<DesignSettings>(initialDesign);
  const [selectedWidgets, setSelectedWidgets] = useState<BuiltinWidgetId[]>(
    initialSelectedWidgets
  );

  const togglePurpose = (p: string) => {
    setProfile((prev) => ({
      ...prev,
      purposes: prev.purposes.includes(p)
        ? prev.purposes.filter((item) => item !== p)
        : [...prev.purposes, p],
    }));
  };

  const toggleBusySlot = (slot: string) => {
    setProfile((prev) => ({
      ...prev,
      busyHours: prev.busyHours.includes(slot)
        ? prev.busyHours.filter((item) => item !== slot)
        : [...prev.busyHours, slot],
    }));
  };

  const toggleWidget = (id: BuiltinWidgetId) => {
    setSelectedWidgets((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const previewTheme = THEME_OPTIONS.find((t) => t.id === design.theme) ?? THEME_OPTIONS[0];
  const previewAccent = ACCENT_OPTIONS.find((a) => a.id === design.accent) ?? ACCENT_OPTIONS[0];
  const previewFontClass =
    design.font === 'serif'
      ? 'font-planner-serif'
      : design.font === 'rounded'
      ? 'font-planner-rounded'
      : design.font === 'mono'
      ? 'font-planner-mono'
      : 'font-planner-sans';

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="w-full max-w-[1160px] mx-auto px-6 py-5 flex items-center justify-between gap-6 border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold tracking-tight whitespace-nowrap">MY DAY</span>
          <span className="text-xs text-[var(--text-muted)] tabular-nums whitespace-nowrap">
            단계 {step} / 4
          </span>
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap cursor-pointer"
        >
          건너뛰고 바로 시작
        </button>
      </header>

      {/* Progress Bar */}
      <div className="w-full max-w-[1160px] mx-auto px-6 pt-4">
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => setStep(num as 1 | 2 | 3 | 4)}
              className="text-left group cursor-pointer"
            >
              <div
                className="h-1.5 rounded-full transition-colors"
                style={{
                  backgroundColor:
                    num <= step ? 'var(--accent-primary)' : 'var(--border-hairline)',
                }}
              />
              <span
                className={`block mt-1.5 text-[11px] sm:text-xs truncate ${
                  num === step
                    ? 'font-semibold text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                {num === 1 && '01. 사용자'}
                {num === 2 && '02. 디자인'}
                {num === 3 && '03. 기능'}
                {num === 4 && '04. 완료'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 w-full max-w-[1160px] mx-auto px-6 py-8">
        {step === 1 && (
          <section className="max-w-3xl space-y-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">생활 패턴을 알려주세요</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1.5">
                선택한 정보를 바탕으로 일정과 위젯 구성을 제안해 드립니다. 성별은 선택 사항이며 디자인에 영향을 주지 않습니다.
              </p>
            </div>

            <div className="space-y-6">
              {/* 연령대 */}
              <div>
                <label className="block text-sm font-semibold mb-2.5">연령대</label>
                <div className="flex flex-wrap gap-2">
                  {AGE_GROUPS.map((age) => {
                    const active = profile.ageGroup === age;
                    return (
                      <button
                        key={age}
                        type="button"
                        onClick={() => setProfile((p) => ({ ...p, ageGroup: age }))}
                        className={`px-4 py-2 rounded-lg text-sm border transition-colors cursor-pointer ${
                          active
                            ? 'font-semibold border-transparent'
                            : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                        {age}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 성별 (선택) */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  성별 <span className="text-xs font-normal text-[var(--text-muted)]">(선택 사항 · 응답하지 않아도 진행 가능)</span>
                </label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {GENDERS.map((g) => {
                    const active = (profile.gender ?? '선택 안 함') === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setProfile((p) => ({ ...p, gender: g }))}
                        className={`px-4 py-2 rounded-lg text-sm border transition-colors cursor-pointer ${
                          active
                            ? 'font-semibold border-transparent'
                            : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 생활 유형 */}
              <div>
                <label className="block text-sm font-semibold mb-2.5">생활 유형</label>
                <div className="flex flex-wrap gap-2">
                  {LIFESTYLES.map((life) => {
                    const active = profile.lifestyle === life;
                    return (
                      <button
                        key={life}
                        type="button"
                        onClick={() => setProfile((p) => ({ ...p, lifestyle: life }))}
                        className={`px-4 py-2 rounded-lg text-sm border transition-colors cursor-pointer ${
                          active
                            ? 'font-semibold border-transparent'
                            : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                        {life}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 사용 목적 */}
              <div>
                <label className="block text-sm font-semibold mb-2.5">
                  플래너 사용 목적 <span className="text-xs font-normal text-[var(--text-muted)]">(복수 선택 가능)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {PURPOSES.map((purpose) => {
                    const active = profile.purposes.includes(purpose);
                    return (
                      <button
                        key={purpose}
                        type="button"
                        onClick={() => togglePurpose(purpose)}
                        className={`px-4 py-2 rounded-lg text-sm border transition-colors cursor-pointer ${
                          active
                            ? 'font-semibold border-transparent'
                            : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                        {purpose}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 바쁜 시간대 */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  주로 바쁜 시간대 <span className="text-xs font-normal text-[var(--text-muted)]">(AI 일정 추천 시 여유 시간 확보에 활용)</span>
                </label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {BUSY_SLOTS.map((slot) => {
                    const active = profile.busyHours.includes(slot.id);
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => toggleBusySlot(slot.id)}
                        className={`px-4 py-2 rounded-lg text-sm border transition-colors cursor-pointer ${
                          active
                            ? 'font-semibold border-transparent'
                            : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-7">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">취향에 맞는 디자인을 골라보세요</h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1.5">
                  설정을 누를 때마다 오른쪽 미리보기에 즉시 반영됩니다.
                </p>
              </div>

              {/* 배경색 / 테마 */}
              <div>
                <label className="block text-sm font-semibold mb-2.5">배경색 · 테마</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {THEME_OPTIONS.map((t) => {
                    const active = design.theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setDesign((d) => ({ ...d, theme: t.id as ThemeId }))}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          active
                            ? 'ring-2 ring-[var(--accent-primary)] border-transparent bg-[var(--bg-surface)]'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-6 h-6 rounded-md border border-black/10 shrink-0"
                            style={{ backgroundColor: t.swatchBg }}
                          />
                          <span className="text-sm font-semibold">{t.label}</span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-1.5 truncate">
                          {t.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 기본 색상 (강조색) */}
              <div>
                <label className="block text-sm font-semibold mb-2.5">기본 강조 색상</label>
                <div className="flex flex-wrap gap-2.5">
                  {ACCENT_OPTIONS.map((a) => {
                    const active = design.accent === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setDesign((d) => ({ ...d, accent: a.id as AccentId }))}
                        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm cursor-pointer transition-all ${
                          active
                            ? 'border-[var(--text-primary)] font-semibold bg-[var(--bg-surface)]'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0"
                          style={{ backgroundColor: a.primary }}
                        />
                        <span>{a.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 글꼴 */}
              <div>
                <label className="block text-sm font-semibold mb-2.5">글꼴</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {FONT_OPTIONS.map((f) => {
                    const active = design.font === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setDesign((d) => ({ ...d, font: f.id }))}
                        className={`p-3 rounded-xl border text-left cursor-pointer ${
                          active
                            ? 'ring-2 ring-[var(--accent-primary)] border-transparent bg-[var(--bg-surface)]'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-surface)]'
                        }`}
                      >
                        <p className="text-xs text-[var(--text-muted)]">{f.label}</p>
                        <p
                          className={`text-sm font-semibold mt-1 ${
                            f.id === 'serif'
                              ? 'font-planner-serif'
                              : f.id === 'rounded'
                              ? 'font-planner-rounded'
                              : f.id === 'mono'
                              ? 'font-planner-mono'
                              : 'font-planner-sans'
                          }`}
                        >
                          {f.sample}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 기본 보기 & 레이아웃 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">기본 달력 보기</label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[var(--bg-subtle)]">
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
                        onClick={() => setDesign((d) => ({ ...d, defaultView: v.id }))}
                        className={`py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                          design.defaultView === v.id
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
                  <label className="block text-sm font-semibold mb-2">레이아웃</label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[var(--bg-subtle)]">
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
                        onClick={() => setDesign((d) => ({ ...d, layout: l.id }))}
                        className={`py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                          design.layout === l.id
                            ? 'bg-[var(--bg-surface)] font-semibold shadow-xs'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Preview */}
            <div className="lg:col-span-5 lg:sticky lg:top-8">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  실시간 미리보기
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {previewTheme.label} · {previewAccent.label}
                </span>
              </div>

              <div
                className={`rounded-2xl p-5 border transition-colors ${previewFontClass}`}
                style={{
                  backgroundColor: previewTheme.swatchBg,
                  borderColor: previewTheme.isDark ? '#2D323B' : '#DFDCD4',
                  color: previewTheme.isDark ? '#F1F3F5' : '#1F2421',
                }}
              >
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-current/10">
                  <div>
                    <p className="text-xs opacity-65">MY DAY</p>
                    <p className="text-base font-bold">2026년 11월 · {design.defaultView === 'month' ? '월간' : design.defaultView === 'week' ? '주간' : '일간'}</p>
                  </div>
                  <span
                    className="px-3 py-1 rounded-lg text-xs font-semibold"
                    style={{
                      backgroundColor: previewAccent.primary,
                      color: previewAccent.contrast,
                    }}
                  >
                    + 일정 추가
                  </span>
                </div>

                {/* Layout preview switch */}
                <div
                  className="rounded-xl p-4 border mb-3"
                  style={{
                    backgroundColor: previewTheme.swatchSurface,
                    borderColor: previewTheme.isDark ? '#2D323B' : '#E5E2DA',
                  }}
                >
                  {design.layout === 'simple' && (
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center text-xs opacity-70">
                        <span>오늘의 일정</span>
                        <span>심플형</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 border-b border-current/10 text-sm">
                        <span>주간 계획 정리</span>
                        <span className="tabular-nums text-xs opacity-70">09:30</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 text-sm">
                        <span>저녁 러닝 4km</span>
                        <span className="tabular-nums text-xs opacity-70">19:30</span>
                      </div>
                    </div>
                  )}

                  {design.layout === 'diary' && (
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center text-xs opacity-70">
                        <span>다이어리 노트</span>
                        <span>다이어리형</span>
                      </div>
                      <p className="text-sm leading-relaxed opacity-90">
                        오늘은 오전 집중 시간을 확보하고 저녁에는 가벼운 운동으로 하루를 마무리하기.
                      </p>
                      <div className="pt-2 border-t border-dashed border-current/15 text-xs flex justify-between">
                        <span>체크 항목 2/3 완료</span>
                        <span style={{ color: previewAccent.primary }} className="font-semibold">
                          67%
                        </span>
                      </div>
                    </div>
                  )}

                  {design.layout === 'timetable' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs opacity-70 mb-1">
                        <span>시간표 타임라인</span>
                        <span>시간표형</span>
                      </div>
                      {[
                        { time: '09:00', title: '핵심 업무 집중' },
                        { time: '14:00', title: '미팅 및 피드백' },
                        { time: '19:30', title: '운동 루틴' },
                      ].map((row) => (
                        <div key={row.time} className="flex items-center gap-3 text-xs">
                          <span className="tabular-nums opacity-60 w-10">{row.time}</span>
                          <div
                            className="flex-1 px-2.5 py-1.5 rounded-md font-medium"
                            style={{
                              backgroundColor: previewTheme.isDark
                                ? 'rgba(255,255,255,0.08)'
                                : previewAccent.soft,
                              color: previewTheme.isDark ? '#F1F3F5' : '#1F2421',
                            }}
                          >
                            {row.title}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className="rounded-xl p-3.5 border flex items-center justify-between"
                  style={{
                    backgroundColor: previewTheme.swatchSurface,
                    borderColor: previewTheme.isDark ? '#2D323B' : '#E5E2DA',
                  }}
                >
                  <div>
                    <p className="text-xs opacity-65">오늘의 할 일</p>
                    <p className="text-sm font-medium mt-0.5">회의 안건 3줄 요약하기</p>
                  </div>
                  <span
                    className="w-5 h-5 rounded-md flex items-center justify-center"
                    style={{
                      backgroundColor: previewAccent.primary,
                      color: previewAccent.contrast,
                    }}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="max-w-4xl space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">필요한 기능을 선택하세요</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1.5">
                아무것도 선택하지 않아도 기본 플래너로 시작할 수 있으며, 나중에 설정에서 언제든 켜고 끌 수 있습니다.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ALL_WIDGET_KEYS.map((id) => {
                const meta = BUILTIN_WIDGET_META[id];
                const checked = selectedWidgets.includes(id);
                return (
                  <label
                    key={id}
                    className={`flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-colors ${
                      checked
                        ? 'bg-[var(--bg-surface)] border-[var(--accent-primary)]'
                        : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleWidget(id)}
                      className="mt-1 w-4 h-4 accent-[var(--accent-primary)] cursor-pointer"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{meta.label}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                        {meta.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">나만의 MY DAY 플래너 준비 완료</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1.5">
                아래 설정으로 맞춤형 대시보드를 생성합니다. 대시보드에 들어간 뒤에도 AI에게 말하거나 설정 페이지에서 모두 바꿀 수 있습니다.
              </p>
            </div>

            <div className="planner-surface rounded-2xl p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">생활 유형 · 연령대</p>
                  <p className="font-semibold mt-1">
                    {profile.lifestyle} · {profile.ageGroup}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">주요 목적</p>
                  <p className="font-semibold mt-1">
                    {profile.purposes.length > 0 ? profile.purposes.join(', ') : '자유 기록'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">선택한 테마 · 색상</p>
                  <p className="font-semibold mt-1">
                    {previewTheme.label} · {previewAccent.label}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">달력 보기 · 레이아웃</p>
                  <p className="font-semibold mt-1">
                    {design.defaultView === 'month' ? '월간' : design.defaultView === 'week' ? '주간' : '일간'} ·{' '}
                    {design.layout === 'simple'
                      ? '심플형'
                      : design.layout === 'diary'
                      ? '다이어리형'
                      : '시간표형'}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--border-hairline)]">
                <p className="text-xs text-[var(--text-muted)] mb-2">
                  활성화할 위젯 ({selectedWidgets.length}개)
                </p>
                {selectedWidgets.length > 0 ? (
                  <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                    {selectedWidgets.map((id) => BUILTIN_WIDGET_META[id].label).join(' · ')}
                  </p>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">
                    기본 달력과 오늘의 요약 중심으로 깔끔하게 시작합니다.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Step Navigation */}
      <div className="w-full max-w-[1160px] mx-auto px-6 py-5 border-t border-[var(--border-hairline)] flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => (step > 1 ? setStep((s) => (s - 1) as 1 | 2 | 3 | 4) : onSkip())}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>{step === 1 ? '건너뛰기' : '이전'}</span>
        </button>

        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-contrast)',
            }}
          >
            <span>다음 단계</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onComplete(profile, design, selectedWidgets)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-contrast)',
            }}
          >
            <Check className="w-4 h-4" />
            <span>플래너 생성하기</span>
          </button>
        )}
      </div>

      <SiteFooter maxWidthClass="max-w-[1160px]" />
    </div>
  );
};
