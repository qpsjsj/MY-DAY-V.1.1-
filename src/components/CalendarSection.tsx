import React from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import {
  CalendarViewMode,
  CategoryColorMap,
  LayoutStyle,
  ScheduleEvent,
  TimeFormat,
  TodoItem,
  WeekStartDay,
} from '../types/planner';
import {
  addDaysYmd,
  addMonthsYmd,
  detectScheduleConflicts,
  formatKoreanFullDate,
  formatKoreanMonthDay,
  formatScheduleTimeRange,
  formatTimeDisplay,
  getDayOfWeek,
  getMonthGridDates,
  getSchedulesForDate,
  getWeekDates,
  getWeekdayLabels,
  isValidHhmm,
  parseYmd,
} from '../utils/dateKst';
import { getKoreanHoliday } from '../utils/koreanHolidays';

interface CalendarSectionProps {
  todayKst: string;
  selectedDate: string;
  onSelectDate: (ymd: string) => void;
  viewMode: CalendarViewMode;
  onChangeViewMode: (mode: CalendarViewMode) => void;
  layout: LayoutStyle;
  weekStart: WeekStartDay;
  timeFormat: TimeFormat;
  conflictAlertEnabled: boolean;
  schedules: ScheduleEvent[];
  todos: TodoItem[];
  categoryColors: CategoryColorMap;
  onOpenNewSchedule: (date: string, startTime?: string, endTime?: string) => void;
  onEditSchedule: (event: ScheduleEvent) => void;
}

export const CalendarSection: React.FC<CalendarSectionProps> = ({
  todayKst,
  selectedDate,
  onSelectDate,
  viewMode,
  onChangeViewMode,
  layout,
  weekStart,
  timeFormat,
  conflictAlertEnabled,
  schedules,
  todos,
  categoryColors,
  onOpenNewSchedule,
  onEditSchedule,
}) => {
  const { year, month } = parseYmd(selectedDate);
  const weekdayLabels = getWeekdayLabels(weekStart);

  const handlePrev = () => {
    if (viewMode === 'month') onSelectDate(addMonthsYmd(selectedDate, -1));
    else if (viewMode === 'week') onSelectDate(addDaysYmd(selectedDate, -7));
    else onSelectDate(addDaysYmd(selectedDate, -1));
  };

  const handleNext = () => {
    if (viewMode === 'month') onSelectDate(addMonthsYmd(selectedDate, 1));
    else if (viewMode === 'week') onSelectDate(addDaysYmd(selectedDate, 7));
    else onSelectDate(addDaysYmd(selectedDate, 1));
  };

  const monthDates = getMonthGridDates(year, month, weekStart);
  const weekDates = getWeekDates(selectedDate, weekStart);
  const selectedDayEvents = getSchedulesForDate(schedules, selectedDate);
  const selectedDayConflicts = detectScheduleConflicts(selectedDayEvents);
  const selectedDayHoliday = getKoreanHoliday(selectedDate);

  const headerTitle =
    viewMode === 'month'
      ? `${year}년 ${month}월`
      : viewMode === 'week'
      ? `${formatKoreanMonthDay(weekDates[0])} ~ ${formatKoreanMonthDay(weekDates[6])}`
      : formatKoreanFullDate(selectedDate);

  return (
    <section className="planner-surface rounded-2xl p-5 sm:p-6">
      {/* Calendar Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 pb-4 border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={handlePrev}
            aria-label="이전 기간"
            className="p-2 rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base sm:text-xl font-bold tracking-tight px-1 sm:px-2 tabular-nums">
            {headerTitle}
          </h2>
          <button
            type="button"
            onClick={handleNext}
            aria-label="다음 기간"
            className="p-2 rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onSelectDate(todayKst)}
            className="ml-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)] cursor-pointer whitespace-nowrap"
          >
            오늘
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-subtle)]">
            {(
              [
                { id: 'month', label: '월간' },
                { id: 'week', label: '주간' },
                { id: 'day', label: '일간' },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => onChangeViewMode(mode.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === mode.id
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onOpenNewSchedule(selectedDate)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-contrast)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>일정 추가</span>
          </button>
        </div>
      </div>

      {/* Conflict Alert Banner for selected day */}
      {conflictAlertEnabled && selectedDayConflicts.length > 0 && (
        <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs sm:text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {formatKoreanMonthDay(selectedDate)} 일정 중 시간이 겹치는 항목이 있습니다:{' '}
            <strong>
              {selectedDayConflicts
                .map((pair) => `${pair.a.title} · ${pair.b.title}`)
                .join(' / ')}
            </strong>
          </span>
        </div>
      )}

      {/* MONTH VIEW */}
      {viewMode === 'month' && (
        <div className="mt-4">
          <div className="grid grid-cols-7 text-center text-xs font-semibold text-[var(--text-muted)] pb-2">
            {weekdayLabels.map((label) => (
              <div key={label} className="py-1">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 border-t border-l border-[var(--border-hairline)] rounded-xl overflow-hidden">
            {monthDates.map((ymd) => {
              const parsed = parseYmd(ymd);
              const isCurrentMonth = parsed.month === month;
              const isToday = ymd === todayKst;
              const isSelected = ymd === selectedDate;
              const dow = getDayOfWeek(ymd);
              const holiday = getKoreanHoliday(ymd);
              const isRedDay = dow === 0 || Boolean(holiday);
              const isSaturday = dow === 6 && !holiday;
              const dayEvents = getSchedulesForDate(schedules, ymd);
              const dayTodos = todos.filter((t) => t.dueDate === ymd && !t.completed);
              const hasConflict =
                conflictAlertEnabled && detectScheduleConflicts(dayEvents).length > 0;

              return (
                <div
                  key={ymd}
                  onClick={() => onSelectDate(ymd)}
                  className={`group min-h-[72px] sm:min-h-[108px] p-1 sm:p-2 border-r border-b border-[var(--border-hairline)] cursor-pointer transition-colors flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[var(--bg-subtle)]'
                      : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]/50'
                  } ${!isCurrentMonth ? 'opacity-45' : ''}`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDate(ymd);
                        }}
                        aria-label={`${formatKoreanFullDate(ymd)}${holiday ? ` (${holiday.name})` : ''} 선택`}
                        aria-pressed={isSelected}
                        className={`inline-flex items-center justify-center w-6 h-6 text-xs tabular-nums rounded-full cursor-pointer ${
                          isToday
                            ? 'font-bold'
                            : isRedDay
                            ? 'font-semibold text-red-600 dark:text-red-400'
                            : isSaturday
                            ? 'font-medium text-blue-600 dark:text-blue-400'
                            : 'font-medium'
                        }`}
                        style={
                          isToday
                            ? {
                                backgroundColor: 'var(--accent-primary)',
                                color: 'var(--accent-contrast)',
                              }
                            : undefined
                        }
                      >
                        {parsed.day}
                      </button>

                      <div className="flex items-center gap-0.5 sm:gap-1">
                        {hasConflict && (
                          <AlertTriangle
                            className="w-3 h-3 text-amber-600 dark:text-amber-400"
                            aria-label="시간 충돌"
                          />
                        )}
                        {dayTodos.length > 0 && (
                          <span
                            className="text-[10px] tabular-nums text-[var(--text-muted)]"
                            title={`남은 할 일 ${dayTodos.length}개`}
                          >
                            <span className="hidden sm:inline">할일 </span>
                            {dayTodos.length}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDate(ymd);
                            onOpenNewSchedule(ymd);
                          }}
                          aria-label={`${ymd} 일정 추가`}
                          className={`p-0.5 rounded hover:bg-[var(--bg-canvas)] text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-opacity cursor-pointer ${
                            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                          }`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {holiday && (
                      <p
                        className="mt-0.5 px-0.5 text-[10px] font-medium text-red-600 dark:text-red-400 truncate"
                        title={holiday.name}
                      >
                        {holiday.name}
                      </p>
                    )}
                  </div>

                  <div className="mt-1 space-y-1 overflow-hidden">
                    {dayEvents.slice(0, layout === 'diary' ? 1 : 2).map((ev) => {
                      const catColor = categoryColors[ev.category] || 'var(--accent-primary)';
                      return (
                        <button
                          key={`${ev.id}-${ymd}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDate(ymd);
                            onEditSchedule(ev);
                          }}
                          className="w-full text-left px-1.5 py-0.5 rounded text-[11px] truncate flex items-center gap-1.5 bg-[var(--bg-canvas)] hover:opacity-85 cursor-pointer"
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: catColor }}
                          />
                          <span className="truncate font-medium">{ev.title}</span>
                        </button>
                      );
                    })}
                    {dayEvents.length > (layout === 'diary' ? 1 : 2) && (
                      <p className="text-[10px] text-[var(--text-muted)] px-1 tabular-nums">
                        +{dayEvents.length - (layout === 'diary' ? 1 : 2)}개 더보기
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WEEK VIEW */}
      {viewMode === 'week' && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-7 gap-2.5">
          {weekDates.map((ymd) => {
            const isToday = ymd === todayKst;
            const isSelected = ymd === selectedDate;
            const dow = getDayOfWeek(ymd);
            const holiday = getKoreanHoliday(ymd);
            const isRedDay = dow === 0 || Boolean(holiday);
            const dayEvents = getSchedulesForDate(schedules, ymd);
            const hasConflict =
              conflictAlertEnabled && detectScheduleConflicts(dayEvents).length > 0;

            return (
              <div
                key={ymd}
                onClick={() => onSelectDate(ymd)}
                className={`rounded-xl p-3 border cursor-pointer transition-colors min-h-[180px] flex flex-col ${
                  isSelected
                    ? 'border-[var(--accent-primary)] bg-[var(--bg-subtle)]/60'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)]'
                }`}
              >
                <div className="pb-2 mb-2 border-b border-[var(--border-hairline)]">
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDate(ymd);
                      }}
                      aria-pressed={isSelected}
                      className={`text-xs font-semibold tabular-nums cursor-pointer text-left ${
                        isToday
                          ? 'text-[var(--accent-primary)]'
                          : isRedDay
                          ? 'text-red-600 dark:text-red-400'
                          : ''
                      }`}
                    >
                      {formatKoreanMonthDay(ymd)}
                    </button>
                    <div className="flex items-center gap-1">
                      {hasConflict && (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDate(ymd);
                          onOpenNewSchedule(ymd);
                        }}
                        aria-label={`${ymd} 일정 추가`}
                        className="p-1 rounded hover:bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--accent-primary)] cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {holiday && (
                    <p
                      className="mt-0.5 text-[11px] font-medium text-red-600 dark:text-red-400 truncate"
                      title={holiday.name}
                    >
                      {holiday.name}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5 flex-1">
                  {dayEvents.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">일정 없음</p>
                  ) : (
                    dayEvents.map((ev) => (
                      <button
                        key={`${ev.id}-${ymd}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditSchedule(ev);
                        }}
                        className="w-full text-left p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:border-[var(--accent-primary)] cursor-pointer"
                      >
                        <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                          {formatTimeDisplay(ev.startTime, timeFormat)}
                        </p>
                        <p className="text-xs font-semibold truncate mt-0.5">{ev.title}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DAY VIEW */}
      {viewMode === 'day' && (
        <div className="mt-4 space-y-3">
          {selectedDayHoliday && (
            <p className="text-xs font-semibold text-red-600 dark:text-red-400">
              공휴일 · {selectedDayHoliday.name}
            </p>
          )}
          {layout === 'timetable' ? (
            <div className="border border-[var(--border-hairline)] rounded-xl divide-y divide-[var(--border-hairline)]">
              {selectedDayEvents.some((ev) => !isValidHhmm(ev.startTime)) && (
                <div className="flex items-stretch min-h-[46px]">
                  <div className="w-24 shrink-0 px-3 py-2 text-xs text-[var(--text-muted)] border-r border-[var(--border-hairline)] bg-[var(--bg-canvas)]">
                    시간 미정
                  </div>
                  <div className="flex-1 p-1.5 flex flex-wrap gap-2 items-center">
                    {selectedDayEvents
                      .filter((ev) => !isValidHhmm(ev.startTime))
                      .map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => onEditSchedule(ev)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:border-[var(--accent-primary)] cursor-pointer text-left"
                        >
                          {ev.title} (시간 미정)
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {selectedDayEvents.some(
                (ev) => isValidHhmm(ev.startTime) && Number(ev.startTime.slice(0, 2)) < 7
              ) && (
                <div className="flex items-stretch min-h-[46px]">
                  <div className="w-24 shrink-0 px-3 py-2 text-xs text-[var(--text-muted)] tabular-nums border-r border-[var(--border-hairline)] bg-[var(--bg-canvas)]">
                    이른 오전 (~07시)
                  </div>
                  <div className="flex-1 p-1.5 flex flex-wrap gap-2 items-center">
                    {selectedDayEvents
                      .filter(
                        (ev) => isValidHhmm(ev.startTime) && Number(ev.startTime.slice(0, 2)) < 7
                      )
                      .map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => onEditSchedule(ev)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:border-[var(--accent-primary)] cursor-pointer text-left"
                        >
                          {ev.title} ({formatScheduleTimeRange(ev.startTime, ev.endTime, timeFormat)})
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {Array.from({ length: 16 }, (_, i) => i + 7).map((hour) => {
                const hourStr = String(hour).padStart(2, '0');
                const nextHourStr = String(hour + 1).padStart(2, '0');
                const slotEvents = selectedDayEvents.filter(
                  (ev) => isValidHhmm(ev.startTime) && Number(ev.startTime.slice(0, 2)) === hour
                );
                return (
                  <div key={hour} className="flex items-stretch min-h-[46px]">
                    <div className="w-24 shrink-0 px-3 py-2 text-xs text-[var(--text-muted)] tabular-nums border-r border-[var(--border-hairline)] bg-[var(--bg-canvas)]">
                      {formatTimeDisplay(`${hourStr}:00`, timeFormat)}
                    </div>
                    <div
                      onClick={() =>
                        onOpenNewSchedule(selectedDate, `${hourStr}:00`, `${nextHourStr}:00`)
                      }
                      className="flex-1 p-1.5 flex flex-wrap gap-2 items-center hover:bg-[var(--bg-subtle)]/40 cursor-pointer transition-colors"
                    >
                      {slotEvents.map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditSchedule(ev);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:border-[var(--accent-primary)] cursor-pointer text-left"
                        >
                          {ev.title} ({formatScheduleTimeRange(ev.startTime, ev.endTime, timeFormat)})
                        </button>
                      ))}
                      {slotEvents.length === 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenNewSchedule(selectedDate, `${hourStr}:00`, `${nextHourStr}:00`);
                          }}
                          aria-label={`${hourStr}:00 일정 추가`}
                          className="text-[11px] text-transparent hover:text-[var(--text-muted)] focus:text-[var(--text-muted)] cursor-pointer px-1"
                        >
                          + 추가
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {selectedDayEvents.some(
                (ev) => isValidHhmm(ev.startTime) && Number(ev.startTime.slice(0, 2)) >= 23
              ) && (
                <div className="flex items-stretch min-h-[46px]">
                  <div className="w-24 shrink-0 px-3 py-2 text-xs text-[var(--text-muted)] tabular-nums border-r border-[var(--border-hairline)] bg-[var(--bg-canvas)]">
                    늦은 밤 (23시~)
                  </div>
                  <div className="flex-1 p-1.5 flex flex-wrap gap-2 items-center">
                    {selectedDayEvents
                      .filter(
                        (ev) => isValidHhmm(ev.startTime) && Number(ev.startTime.slice(0, 2)) >= 23
                      )
                      .map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => onEditSchedule(ev)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:border-[var(--accent-primary)] cursor-pointer text-left"
                        >
                          {ev.title} ({formatScheduleTimeRange(ev.startTime, ev.endTime, timeFormat)})
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : selectedDayEvents.length === 0 ? (
            <div className="py-10 text-center rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)]">
              <p className="text-sm text-[var(--text-secondary)]">
                {formatKoreanFullDate(selectedDate)}에 등록된 일정이 없습니다.
              </p>
              <button
                type="button"
                onClick={() => onOpenNewSchedule(selectedDate)}
                className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-contrast)',
                }}
              >
                이 날짜에 첫 일정 등록하기
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {selectedDayEvents.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onEditSchedule(ev)}
                  className="w-full text-left p-4 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] hover:border-[var(--accent-primary)] cursor-pointer flex items-start justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor:
                            categoryColors[ev.category] || 'var(--accent-primary)',
                        }}
                      />
                      <span>{ev.category}</span>
                      <span>·</span>
                      <span className="tabular-nums">
                        {formatScheduleTimeRange(ev.startTime, ev.endTime, timeFormat)}
                      </span>
                      {ev.importance === 'high' && (
                        <>
                          <span>·</span>
                          <span className="text-red-600 dark:text-red-400 font-semibold">
                            중요
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-sm font-semibold">{ev.title}</p>
                    {ev.memo && (
                      <p className="text-xs text-[var(--text-secondary)]">{ev.memo}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
