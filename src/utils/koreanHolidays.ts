import { addDaysYmd, formatYmd, getDayOfWeek, isValidYmd } from './dateKst';

export interface KoreanHoliday {
  ymd: string;
  name: string;
  isSubstitute?: boolean;
}

const yearCache = new Map<number, Map<string, KoreanHoliday>>();

let lunarFormatter: Intl.DateTimeFormat | null = null;

function getLunarParts(ymd: string): { month: number; day: number; isLeap: boolean } | null {
  try {
    if (!lunarFormatter) {
      lunarFormatter = new Intl.DateTimeFormat('en-US-u-ca-chinese', {
        timeZone: 'Asia/Seoul',
        month: 'numeric',
        day: 'numeric',
      });
    }
    const [y, m, d] = ymd.split('-').map(Number);
    // Use 12:00 KST (03:00 UTC) so date boundary is unambiguous
    const utcDate = new Date(Date.UTC(y, m - 1, d, 3, 0, 0));
    const parts = lunarFormatter.formatToParts(utcDate);
    const monthStr = parts.find((p) => p.type === 'month')?.value ?? '';
    const dayStr = parts.find((p) => p.type === 'day')?.value ?? '';
    const isLeap = /bis/i.test(monthStr) || Number.isNaN(Number(monthStr));
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    if (Number.isNaN(month) || Number.isNaN(day)) return null;
    return { month, day, isLeap };
  } catch {
    return null;
  }
}

function addHolidayEntry(
  map: Map<string, KoreanHoliday[]>,
  ymd: string,
  name: string,
  isSubstitute = false
) {
  const existing = map.get(ymd) ?? [];
  existing.push({ ymd, name, isSubstitute });
  map.set(ymd, existing);
}

function findNextNonHolidayWeekday(
  startYmd: string,
  occupied: Map<string, KoreanHoliday[]>
): string {
  let cursor = addDaysYmd(startYmd, 1);
  for (let i = 0; i < 14; i++) {
    const dow = getDayOfWeek(cursor);
    if (dow !== 0 && dow !== 6 && !occupied.has(cursor)) {
      return cursor;
    }
    cursor = addDaysYmd(cursor, 1);
  }
  return cursor;
}

/**
 * Computes official South Korean public holidays (solar fixed, lunar Seollal/Buddha/Chuseok,
 * and statutory substitute holidays) for any given year.
 */
export function getKoreanHolidaysForYear(year: number): Map<string, KoreanHoliday> {
  const cached = yearCache.get(year);
  if (cached) return cached;

  const rawMap = new Map<string, KoreanHoliday[]>();

  // 1. Annual fixed solar public holidays
  const fixedSolar: Array<[number, number, string, boolean]> = [
    // [month, day, name, substituteEligible]
    [1, 1, '신정', false],
    [3, 1, '삼일절', true],
    [5, 5, '어린이날', true],
    [6, 6, '현충일', false],
    [8, 15, '광복절', true],
    [10, 3, '개천절', true],
    [10, 9, '한글날', true],
    [12, 25, '성탄절', true],
  ];

  for (const [m, d, name] of fixedSolar) {
    addHolidayEntry(rawMap, formatYmd(year, m, d), name);
  }

  // Known nationwide statutory election days
  if (year === 2026) {
    addHolidayEntry(rawMap, '2026-06-03', '전국동시지방선거일');
  } else if (year === 2028) {
    addHolidayEntry(rawMap, '2028-04-12', '국회의원선거일');
  } else if (year === 2030) {
    addHolidayEntry(rawMap, '2030-06-05', '전국동시지방선거일');
  }

  // 2. Lunar holidays (Seollal 1/1 +- 1 day, Buddha's Birthday 4/8, Chuseok 8/15 +- 1 day)
  // Scan current year and early next year (in case lunar 1/1 is Jan 21-31 -> eve falls in same year,
  // or Jan 1 -> lunar 1/1 in Jan; scanning Jan 1..Dec 31 of target year covers all solar dates in `year`).
  let seollalDay: string | null = null;
  let buddhaDay: string | null = null;
  let chuseokDay: string | null = null;

  for (let m = 1; m <= 12; m++) {
    const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const ymd = formatYmd(year, m, d);
      const lunar = getLunarParts(ymd);
      if (!lunar || lunar.isLeap) continue;
      if (lunar.month === 1 && lunar.day === 1) seollalDay = ymd;
      else if (lunar.month === 4 && lunar.day === 8) buddhaDay = ymd;
      else if (lunar.month === 8 && lunar.day === 15) chuseokDay = ymd;
    }
  }

  const seollalGroup: string[] = [];
  if (seollalDay) {
    const eve = addDaysYmd(seollalDay, -1);
    const next = addDaysYmd(seollalDay, 1);
    if (eve.startsWith(`${year}-`)) {
      addHolidayEntry(rawMap, eve, '설날 연휴');
      seollalGroup.push(eve);
    }
    addHolidayEntry(rawMap, seollalDay, '설날');
    seollalGroup.push(seollalDay);
    if (next.startsWith(`${year}-`)) {
      addHolidayEntry(rawMap, next, '설날 연휴');
      seollalGroup.push(next);
    }
  }

  if (buddhaDay) {
    addHolidayEntry(rawMap, buddhaDay, '부처님오신날');
  }

  const chuseokGroup: string[] = [];
  if (chuseokDay) {
    const eve = addDaysYmd(chuseokDay, -1);
    const next = addDaysYmd(chuseokDay, 1);
    if (eve.startsWith(`${year}-`)) {
      addHolidayEntry(rawMap, eve, '추석 연휴');
      chuseokGroup.push(eve);
    }
    addHolidayEntry(rawMap, chuseokDay, '추석');
    chuseokGroup.push(chuseokDay);
    if (next.startsWith(`${year}-`)) {
      addHolidayEntry(rawMap, next, '추석 연휴');
      chuseokGroup.push(next);
    }
  }

  // 3. Statutory substitute holidays (대체공휴일)
  // 3a. Seollal & Chuseok: substitute if any day in the 3-day holiday falls on Sunday or overlaps another holiday
  for (const [group, label] of [
    [seollalGroup, '대체공휴일(설날)'],
    [chuseokGroup, '대체공휴일(추석)'],
  ] as const) {
    if (group.length === 0) continue;
    const needsSub = group.some((ymd) => {
      const dow = getDayOfWeek(ymd);
      const entries = rawMap.get(ymd) ?? [];
      return dow === 0 || entries.length > 1;
    });
    if (needsSub) {
      const lastDay = group[group.length - 1];
      const subYmd = findNextNonHolidayWeekday(lastDay, rawMap);
      if (subYmd.startsWith(`${year}-`)) {
        addHolidayEntry(rawMap, subYmd, label, true);
      }
    }
  }

  // 3b. Single-day substitute-eligible holidays (삼일절, 어린이날, 부처님오신날, 광복절, 개천절, 한글날, 성탄절)
  const singleSubCandidates: Array<{ ymd: string | null; label: string }> = [
    { ymd: formatYmd(year, 3, 1), label: '대체공휴일(삼일절)' },
    { ymd: formatYmd(year, 5, 5), label: '대체공휴일(어린이날)' },
    { ymd: buddhaDay, label: '대체공휴일(부처님오신날)' },
    { ymd: formatYmd(year, 8, 15), label: '대체공휴일(광복절)' },
    { ymd: formatYmd(year, 10, 3), label: '대체공휴일(개천절)' },
    { ymd: formatYmd(year, 10, 9), label: '대체공휴일(한글날)' },
    { ymd: formatYmd(year, 12, 25), label: '대체공휴일(성탄절)' },
  ];

  for (const candidate of singleSubCandidates) {
    if (!candidate.ymd) continue;
    const dow = getDayOfWeek(candidate.ymd);
    const entries = rawMap.get(candidate.ymd) ?? [];
    if (dow === 0 || dow === 6 || entries.length > 1) {
      const subYmd = findNextNonHolidayWeekday(candidate.ymd, rawMap);
      if (subYmd.startsWith(`${year}-`)) {
        addHolidayEntry(rawMap, subYmd, candidate.label, true);
      }
    }
  }

  const finalMap = new Map<string, KoreanHoliday>();
  for (const [ymd, list] of rawMap.entries()) {
    const combinedName = Array.from(new Set(list.map((item) => item.name))).join(' · ');
    finalMap.set(ymd, {
      ymd,
      name: combinedName,
      isSubstitute: list.every((item) => Boolean(item.isSubstitute)),
    });
  }

  yearCache.set(year, finalMap);
  return finalMap;
}

export function getKoreanHoliday(ymd: string): KoreanHoliday | null {
  if (!isValidYmd(ymd)) return null;
  const year = Number(ymd.slice(0, 4));
  return getKoreanHolidaysForYear(year).get(ymd) ?? null;
}
