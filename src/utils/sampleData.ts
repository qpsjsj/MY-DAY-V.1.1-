import {
  AccentId,
  BuiltinWidgetId,
  PlannerState,
  ThemeId,
} from '../types/planner';

export const THEME_OPTIONS: Array<{
  id: ThemeId;
  label: string;
  description: string;
  swatchBg: string;
  swatchSurface: string;
  isDark?: boolean;
}> = [
  {
    id: 'cream',
    label: '크림',
    description: '따뜻하고 차분한 종이 질감',
    swatchBg: '#FAF7F0',
    swatchSurface: '#FFFDF9',
  },
  {
    id: 'white',
    label: '화이트',
    description: '깔끔하고 선명한 기본 화이트',
    swatchBg: '#F8F9FA',
    swatchSurface: '#FFFFFF',
  },
  {
    id: 'sage',
    label: '세이지 그린',
    description: '눈이 편안한 자연 초록빛',
    swatchBg: '#F2F6F2',
    swatchSurface: '#FBFDFB',
  },
  {
    id: 'lavender',
    label: '연한 라벤더',
    description: '부드럽고 고요한 보랏빛',
    swatchBg: '#F6F4FA',
    swatchSurface: '#FDFCFF',
  },
  {
    id: 'pastel',
    label: '파스텔',
    description: '은은한 블러시 파스텔 톤',
    swatchBg: '#FDF6F5',
    swatchSurface: '#FFFFFF',
  },
  {
    id: 'monotone',
    label: '모노톤',
    description: '절제된 무채색 미니멀리즘',
    swatchBg: '#F4F4F5',
    swatchSurface: '#FFFFFF',
  },
  {
    id: 'dark',
    label: '다크 모드',
    description: '밤에도 눈부시지 않은 어두운 화면',
    swatchBg: '#121417',
    swatchSurface: '#1A1D22',
    isDark: true,
  },
];

export const ACCENT_OPTIONS: Array<{
  id: AccentId;
  label: string;
  primary: string;
  soft: string;
  contrast: string;
}> = [
  {
    id: 'sage',
    label: '세이지 그린',
    primary: '#4F7760',
    soft: '#E7EFEA',
    contrast: '#FFFFFF',
  },
  {
    id: 'lavender',
    label: '소프트 라벤더',
    primary: '#6E5FA8',
    soft: '#EDEAF7',
    contrast: '#FFFFFF',
  },
  {
    id: 'charcoal',
    label: '딥 차콜',
    primary: '#2A2F36',
    soft: '#EAECEF',
    contrast: '#FFFFFF',
  },
  {
    id: 'ocean',
    label: '오션 블루',
    primary: '#3B6E8C',
    soft: '#E6EFF4',
    contrast: '#FFFFFF',
  },
  {
    id: 'coral',
    label: '웜 테라코타',
    primary: '#B5634D',
    soft: '#F5EAE7',
    contrast: '#FFFFFF',
  },
  {
    id: 'forest',
    label: '포레스트',
    primary: '#2E5A44',
    soft: '#E3ECE7',
    contrast: '#FFFFFF',
  },
];

export const BUILTIN_WIDGET_META: Record<
  BuiltinWidgetId,
  { label: string; description: string; defaultSize: 'compact' | 'wide' }
> = {
  calendar: {
    label: '달력 및 일정 관리',
    description: '월간·주간·일간 일정 확인과 시간 충돌 감지',
    defaultSize: 'wide',
  },
  todos: {
    label: '할 일 목록',
    description: '중요도, 마감일, 미완료 이동 기능 지원',
    defaultSize: 'compact',
  },
  dday: {
    label: '시험 및 기념일 D-day',
    description: '남은 날짜 자동 계산 및 다가오는 일정 표시',
    defaultSize: 'compact',
  },
  habits: {
    label: '습관 트래커',
    description: '연속 실천 일수와 주간 실천율 확인',
    defaultSize: 'compact',
  },
  focus: {
    label: '공부 및 업무 시간 관리',
    description: '집중 타이머 및 목표 대비 실제 시간 기록',
    defaultSize: 'compact',
  },
  expenses: {
    label: '수입 및 지출 관리',
    description: '카테고리별 지출 기록과 월 예산 비교',
    defaultSize: 'compact',
  },
  notes: {
    label: '메모와 아이디어 기록',
    description: '날짜 연결 빠른 메모 및 키워드 검색',
    defaultSize: 'compact',
  },
  routines: {
    label: '운동 및 개인 루틴',
    description: '아침·저녁·운동 루틴 체크리스트',
    defaultSize: 'compact',
  },
  checklists: {
    label: '준비물 및 장보기 목록',
    description: '외출 준비물과 장보기 품목 관리',
    defaultSize: 'compact',
  },
  ai_recommend: {
    label: 'AI 일정 추천',
    description: '일정 충돌, 바쁜 시간대, 업무량을 분석해 제안',
    defaultSize: 'wide',
  },
};

export function createInitialPlannerState(_todayOverride?: string): PlannerState {
  return {
    version: 2,
    stage: 'welcome',
    profile: {
      ageGroup: '20대',
      gender: '선택 안 함',
      lifestyle: '직장인',
      purposes: ['업무', '자기계발', '생활 관리'],
      busyHours: ['09:00-12:00', '14:00-18:00'],
      weeklyGoal: '',
    },
    design: {
      theme: 'cream',
      accent: 'sage',
      font: 'sans',
      defaultView: 'month',
      layout: 'simple',
      weekStart: 'monday',
      timeFormat: '24h',
    },
    notifications: {
      conflictAlert: true,
      deadlineAlert: true,
      dailySummary: true,
      summaryTime: '08:30',
    },
    categoryColors: {
      업무: '#4F7760',
      학업: '#3B6E8C',
      운동: '#B5634D',
      생활: '#6E5FA8',
      약속: '#8A6D3B',
    },
    monthlyBudget: 0,
    widgets: [
      { id: 'todos', type: 'builtin', visible: true, size: 'compact' },
      { id: 'dday', type: 'builtin', visible: true, size: 'compact' },
      { id: 'habits', type: 'builtin', visible: true, size: 'compact' },
      { id: 'focus', type: 'builtin', visible: true, size: 'compact' },
      { id: 'expenses', type: 'builtin', visible: true, size: 'compact' },
      { id: 'notes', type: 'builtin', visible: true, size: 'compact' },
      { id: 'routines', type: 'builtin', visible: false, size: 'compact' },
      { id: 'checklists', type: 'builtin', visible: false, size: 'compact' },
      { id: 'ai_recommend', type: 'builtin', visible: true, size: 'wide' },
    ],
    customWidgets: [],
    schedules: [],
    todos: [],
    habits: [],
    ddays: [],
    focusEntries: [],
    expenses: [],
    notes: [],
    routines: [],
    checklists: [],
  };
}
