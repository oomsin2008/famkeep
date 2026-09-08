"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { formatThaiFullDate, formatThaiMonthYear } from "@/lib/datetime";
import { dominantStatus } from "@/lib/tasks";
import {
  dateKeyToInstant,
  monthAnchorKey,
  WEEKDAY_LABELS_TH,
  type CalendarDay,
  type MonthAnchor,
} from "@/lib/calendar";
import type { TaskView } from "@/lib/types";
import { STATUS_DOT_CLASSES } from "@/components/tasks/presentation";

interface MobileMonthGridProps {
  anchor: MonthAnchor;
  days: CalendarDay[];
  tasksByDate: Map<string, TaskView[]>;
  today: string;
  selectedDate: string;
  now: Date;
  onPrev: () => void;
  onNext: () => void;
  onSelectDate: (key: string) => void;
}

const NAV_BUTTON =
  "grid size-11 place-items-center rounded-full border border-border/60 bg-surface-glass text-text-2 shadow-soft transition-colors hover:text-text";

/** Compact month grid for mobile: one dominant-status dot per day, no task
 *  title chips (too narrow). Tapping a day opens its panel like the week strip. */
export function MobileMonthGrid({
  anchor,
  days,
  tasksByDate,
  today,
  selectedDate,
  now,
  onPrev,
  onNext,
  onSelectDate,
}: MobileMonthGridProps) {
  const monthLabel = formatThaiMonthYear(
    dateKeyToInstant(monthAnchorKey(anchor)),
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{monthLabel}</h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onPrev}
            aria-label="เดือนก่อนหน้า"
            className={NAV_BUTTON}
          >
            <CaretLeft size={18} />
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="เดือนถัดไป"
            className={NAV_BUTTON}
          >
            <CaretRight size={18} />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-y-1">
        {WEEKDAY_LABELS_TH.map((label) => (
          <div
            key={label}
            className="pb-1 text-center text-xs font-semibold text-text-2"
          >
            {label}
          </div>
        ))}

        {days.map((day) => {
          const status = dominantStatus(tasksByDate.get(day.key) ?? [], now);
          const isSelected = day.key === selectedDate;
          const isToday = day.key === today;
          return (
            <button
              key={day.key}
              type="button"
              data-date={day.key}
              onClick={() => onSelectDate(day.key)}
              aria-label={formatThaiFullDate(dateKeyToInstant(day.key))}
              aria-pressed={isSelected}
              className="flex min-h-[46px] flex-col items-center justify-center gap-1 rounded-standard py-1 transition-colors hover:bg-surface-muted/60"
            >
              <span
                className={[
                  "flex size-8 items-center justify-center rounded-full text-sm font-bold",
                  isSelected
                    ? "fk-clay fk-clay-blue text-primary-strong"
                    : isToday
                      ? "text-primary-strong ring-1 ring-inset ring-primary/50"
                      : day.inMonth
                        ? "text-text"
                        : "text-text-soft/60",
                ].join(" ")}
              >
                {day.day}
              </span>
              <span
                className={`size-1.5 rounded-full ${
                  status ? STATUS_DOT_CLASSES[status] : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
