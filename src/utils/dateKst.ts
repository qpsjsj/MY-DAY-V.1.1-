import { ScheduleEvent, TimeFormat, WeekStartDay } from '../types/planner';

const KST_TIMEZONE = 'Asia/Seoul';

/**
 * Returns today's YYYY-MM-DD strictly in Korea Standard Time (Asia/Seoul).
 */
export function getKstTodayString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: KST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Returns current HH:mm in Korea Standard Time.
 */
export function getKstNowTimeString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: KST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
}

/**
 * Validates both YYYY-MM-DD format and actual calendar validity (e.g. rejects 2026-02-30).
 */
export function isValidYmd(ymd: unknown): ymd is string {
  if (typeof ymd !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

/**
 * Validates HH:mm 24-hour time string.
 */
export function isValidHhmm(hhmm: unknown): hhmm is string {
  return typeof hhmm === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm.trim());
}

/**
 * Pure calendar integer parser for YYYY-MM-DD (avoids UTC shift bugs).
 */
export function parseYmd(ymd: string): { year: number; month: number; day: number } {
  if (!isValidYmd(ymd)) {
    const today = getKstTodayString();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today)!;
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    };
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())!;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function formatYmd(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Adds days to a YYYY-MM-DD string using pure UTC noon math so timezone offsets never shift a day.
 */
export function addDaysYmd(ymd: string, offsetDays: number): string {
  const { year, month, day } = parseYmd(ymd);
  const dt = new Date(Date.UTC(year, month - 1, day + offsetDays, 12, 0, 0));
  return formatYmd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/**
 * Adds months to YYYY-MM-DD safely clamping to end of target month.
 */
export function addMonthsYmd(ymd: string, offsetMonths: number): string {
  const { year, month, day } = parseYmd(ymd);
  const targetZeroMonth = month - 1 + offsetMonths;
  const targetYear = year + Math.floor(targetZeroMonth / 12);
  const normalizedMonth = ((targetZeroMonth % 12) + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, daysInTargetMonth);
  return formatYmd(targetYear, normalizedMonth + 1, clampedDay);
}

/**
 * Difference in calendar days: target - base. Positive means target is in the future.
 */
export function diffDaysYmd(targetYmd: string, baseYmd: string): number {
  const t = parseYmd(targetYmd);
  const b = parseYmd(baseYmd);
  const tMs = Date.UTC(t.year, t.month - 1, t.day, 12, 0, 0);
  const bMs = Date.UTC(b.year, b.month - 1, b.day, 12, 0, 0);
  return Math.round((tMs - bMs) / 86_400_000);
}

/**
 * Day of week: 0 (Sunday) .. 6 (Saturday)
 */
export function getDayOfWeek(ymd: string): number {
  const { year, month, day } = parseYmd(ymd);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

const KOREAN_WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const KOREAN_SHORT_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function formatKoreanFullDate(ymd: string): string {
  const { year, month, day } = parseYmd(ymd);
  const dow = KOREAN_WEEKDAYS[getDayOfWeek(ymd)];
  return `${year}년 ${month}월 ${day}일 ${dow}`;
}

export function formatKoreanMonthDay(ymd: string): string {
  const { month, day } = parseYmd(ymd);
  const dow = KOREAN_SHORT_WEEKDAYS[getDayOfWeek(ymd)];
  return `${month}월 ${day}일 (${dow})`;
}

export function getWeekdayLabels(weekStart: WeekStartDay): string[] {
  if (weekStart === 'monday') {
    return ['월', '화', '수', '목', '금', '토', '일'];
  }
  return ['일', '월', '화', '수', '목', '금', '토'];
}

export function getMonthGridDates(year: number, month: number, weekStart: WeekStartDay): string[] {
  const firstYmd = formatYmd(year, month, 1);
  const firstDow = getDayOfWeek(firstYmd); // 0=Sun..6=Sat
  const leadingDays = weekStart === 'monday' ? (firstDow + 6) % 7 : firstDow;
  const startGridYmd = addDaysYmd(firstYmd, -leadingDays);
  const cells: string[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(addDaysYmd(startGridYmd, i));
  }
  return cells;
}

export function getWeekDates(anchorYmd: string, weekStart: WeekStartDay): string[] {
  const dow = getDayOfWeek(anchorYmd);
  const offset = weekStart === 'monday' ? (dow + 6) % 7 : dow;
  const start = addDaysYmd(anchorYmd, -offset);
  return Array.from({ length: 7 }, (_, i) => addDaysYmd(start, i));
}

export function formatTimeDisplay(hhmm: string, format: TimeFormat): string {
  if (!hhmm || !hhmm.trim()) return '시간 미정';
  const [hStr, mStr] = hhmm.trim().split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  if (format === '24h') {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const period = h < 12 ? '오전' : '오후';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${hour12}:${String(m).padStart(2, '0')}`;
}

export function formatScheduleTimeRange(
  startTime: string,
  endTime: string,
  format: TimeFormat
): string {
  if (!isValidHhmm(startTime)) return '시간 미정';
  if (!isValidHhmm(endTime)) return formatTimeDisplay(startTime, format);
  return `${formatTimeDisplay(startTime, format)} ~ ${formatTimeDisplay(endTime, format)}`;
}

export function timeToMinutes(hhmm: string): number {
  if (!hhmm || !hhmm.trim()) return -1;
  const [h, m] = hhmm.trim().split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return -1;
  return h * 60 + m;
}

/**
 * Expands schedules (including recurring rules) for a specific YYYY-MM-DD date.
 */
export function getSchedulesForDate(schedules: ScheduleEvent[], targetYmd: string): ScheduleEvent[] {
  if (!isValidYmd(targetYmd)) return [];
  const targetDow = getDayOfWeek(targetYmd);
  const targetParsed = parseYmd(targetYmd);
  const daysInTargetMonth = new Date(
    Date.UTC(targetParsed.year, targetParsed.month, 0)
  ).getUTCDate();

  return schedules
    .filter((ev) => {
      if (ev.date === targetYmd) return true;
      if (!isValidYmd(ev.date) || targetYmd < ev.date) return false;
      if (ev.repeat === 'daily') return true;
      if (ev.repeat === 'weekly') {
        if (ev.weekdays && ev.weekdays.length > 0) {
          return ev.weekdays.includes(targetDow);
        }
        return getDayOfWeek(ev.date) === targetDow;
      }
      if (ev.repeat === 'monthly') {
        const baseParsed = parseYmd(ev.date);
        const clampedTargetDay = Math.min(baseParsed.day, daysInTargetMonth);
        return clampedTargetDay === targetParsed.day;
      }
      return false;
    })
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

export interface ConflictPair {
  a: ScheduleEvent;
  b: ScheduleEvent;
}

export function detectScheduleConflicts(dayEvents: ScheduleEvent[]): ConflictPair[] {
  const timedOnly = dayEvents.filter((ev) => isValidHhmm(ev.startTime));
  const sorted = [...timedOnly].sort(
    (x, y) => timeToMinutes(x.startTime) - timeToMinutes(y.startTime)
  );
  const conflicts: ConflictPair[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const aStart = timeToMinutes(sorted[i].startTime);
    const aEnd = isValidHhmm(sorted[i].endTime)
      ? Math.max(aStart + 15, timeToMinutes(sorted[i].endTime))
      : aStart + 60;
    for (let j = i + 1; j < sorted.length; j++) {
      const bStart = timeToMinutes(sorted[j].startTime);
      const bEnd = isValidHhmm(sorted[j].endTime)
        ? Math.max(bStart + 15, timeToMinutes(sorted[j].endTime))
        : bStart + 60;
      if (aStart < bEnd && bStart < aEnd) {
        conflicts.push({ a: sorted[i], b: sorted[j] });
      }
    }
  }
  return conflicts;
}

export function formatDDayBadge(targetYmd: string, baseYmd: string): string {
  const diff = diffDaysYmd(targetYmd, baseYmd);
  if (diff === 0) return 'D-Day';
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}
