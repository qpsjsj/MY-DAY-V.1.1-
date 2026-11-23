export type ThemeId =
  | 'cream'
  | 'white'
  | 'sage'
  | 'lavender'
  | 'pastel'
  | 'monotone'
  | 'dark';

export type AccentId =
  | 'sage'
  | 'lavender'
  | 'charcoal'
  | 'ocean'
  | 'coral'
  | 'forest';

export type FontChoice = 'sans' | 'rounded' | 'serif' | 'mono';
export type CalendarViewMode = 'month' | 'week' | 'day';
export type LayoutStyle = 'simple' | 'diary' | 'timetable';
export type WeekStartDay = 'sunday' | 'monday';
export type TimeFormat = '24h' | '12h';

export type ImportanceLevel = 'high' | 'medium' | 'low';
export type RepeatRule = 'none' | 'daily' | 'weekly' | 'monthly';

export type BuiltinWidgetId =
  | 'calendar'
  | 'todos'
  | 'dday'
  | 'habits'
  | 'focus'
  | 'expenses'
  | 'notes'
  | 'routines'
  | 'checklists'
  | 'ai_recommend';

export interface UserProfile {
  ageGroup: '10대 이하' | '10대' | '20대' | '30대' | '40대' | '50대 이상';
  gender?: '선택 안 함' | '여성' | '남성' | '기타';
  lifestyle: '학생' | '대학생' | '직장인' | '프리랜서' | '취업 준비생' | '기타';
  purposes: string[];
  busyHours: string[]; // e.g., ['09:00-12:00', '13:00-18:00']
  weeklyGoal: string;
}

export interface DesignSettings {
  theme: ThemeId;
  accent: AccentId;
  font: FontChoice;
  defaultView: CalendarViewMode;
  layout: LayoutStyle;
  weekStart: WeekStartDay;
  timeFormat: TimeFormat;
}

export interface NotificationSettings {
  conflictAlert: boolean;
  deadlineAlert: boolean;
  dailySummary: boolean;
  summaryTime: string;
}

export interface CategoryColorMap {
  [category: string]: string;
}

export interface ScheduleEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD in KST
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  memo: string;
  category: string;
  importance: ImportanceLevel;
  repeat: RepeatRule;
  weekdays?: number[]; // 0=Sun..6=Sat for multi-day weekly recurrence
}

export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  importance: ImportanceLevel;
  dueDate: string; // YYYY-MM-DD in KST
  category: string;
}

export interface HabitItem {
  id: string;
  title: string;
  completedDates: string[]; // YYYY-MM-DD[]
  targetPerWeek: number;
}

export interface DDayItem {
  id: string;
  title: string;
  targetDate: string; // YYYY-MM-DD in KST
  category: '시험' | '자격증' | '생일' | '기념일' | '기타';
}

export interface FocusEntry {
  id: string;
  subject: string;
  targetMinutes: number;
  actualMinutes: number;
  date: string; // YYYY-MM-DD
}

export interface ExpenseItem {
  id: string;
  title: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category: '식비' | '교통' | '쇼핑' | '생활' | '학습' | '기타';
  type: 'expense' | 'income';
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  date: string; // YYYY-MM-DD
  updatedAt: string;
}

export interface RoutineItem {
  id: string;
  title: string;
  timeOfDay: '아침' | '오후' | '저녁' | '운동';
  durationMinutes: number;
  completedDates: string[];
}

export interface ChecklistItem {
  id: string;
  title: string;
  group: '준비물' | '장보기' | '여행' | '기타';
  checked: boolean;
}

export type CustomWidgetKind = 'checklist' | 'counter' | 'note_list' | 'exam_study';

export interface CustomWidgetEntry {
  id: string;
  label: string;
  detail?: string;
  checked?: boolean;
  value?: number;
  target?: number;
  date?: string;
}

export interface CustomWidget {
  id: string;
  title: string;
  description: string;
  kind: CustomWidgetKind;
  items: CustomWidgetEntry[];
}

export interface WidgetPlacement {
  id: string; // BuiltinWidgetId or custom widget id
  type: 'builtin' | 'custom';
  visible: boolean;
  size: 'compact' | 'wide';
}

export type AppStage = 'welcome' | 'onboarding' | 'app';
export type AppTab = 'dashboard' | 'calendar' | 'widgets' | 'settings';

export interface PlannerState {
  version: number;
  stage: AppStage;
  profile: UserProfile;
  design: DesignSettings;
  notifications: NotificationSettings;
  categoryColors: CategoryColorMap;
  monthlyBudget: number;
  widgets: WidgetPlacement[];
  customWidgets: CustomWidget[];
  schedules: ScheduleEvent[];
  todos: TodoItem[];
  habits: HabitItem[];
  ddays: DDayItem[];
  focusEntries: FocusEntry[];
  expenses: ExpenseItem[];
  notes: NoteItem[];
  routines: RoutineItem[];
  checklists: ChecklistItem[];
}

export interface PlannerRecord {
  plannerId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  data: PlannerState;
}

export interface PlannerWorkspace {
  version: 3;
  stage: AppStage;
  hasOpenedApp?: boolean;
  activePlannerId: string;
  planners: PlannerRecord[];
}

export type AiIntentType =
  | 'schedule_action'
  | 'todo_action'
  | 'design_change'
  | 'widget_config'
  | 'widget_create'
  | 'schedule_analysis'
  | 'unsupported';

export interface AiOperation {
  op:
    | 'add_schedule'
    | 'update_schedule'
    | 'delete_schedule'
    | 'add_todo'
    | 'split_todo'
    | 'delete_todo'
    | 'move_unfinished_todos'
    | 'toggle_todo'
    | 'update_design'
    | 'toggle_widget'
    | 'create_custom_widget'
    | 'add_dday'
    | 'add_expense'
    | 'add_habit'
    | 'add_note';
  payload: Record<string, unknown>;
}

export interface AiPlanProposal {
  intent: AiIntentType;
  intentLabel: string;
  requiresConfirmation: boolean;
  explanation: string;
  previewSummary: string[];
  operations: AiOperation[];
}
