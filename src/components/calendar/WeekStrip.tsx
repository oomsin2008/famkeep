"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { formatThaiFullDate, formatThaiMonthYear } from "@/lib/datetime";
import { deriveTaskStatus } from "@/lib/tasks";
import {
  addDaysToKey,
  dateKeyToInstant,
  WEEKDAY_LABELS_TH,
  type CalendarDay,
} from "@/lib/calendar";
import type { TaskDisplayStatus, TaskView } from "@/lib/types";
import { STATUS_DOT_CLASSES } from "@/components/tasks/presentation";

interface WeekStripProps {
  weekStart: string;
  days: CalendarDay[];
  tasksByDate: Map<string, TaskView[]>;
  today: string;
  selectedDate: string;
  now: Date;
  onPrev: () => void;
  onNext: () => void;
  onSelectDate: (key: string) => void;
}

/** Highest-urgency status wins the day's single dot. A day holding both an
 *  overdue and a done task shows only the overdue colour (documented trade-off). */
const STATUS_PRIORITY: Record<TaskDisplayStatus, number> = {
  overdue: 0,
  duesoon: 1,
  progress: 2,
  done: 3,
  cancelled: 4,
};

function dominantStatus(tasks: TaskView[], now: Date): TaskDisplayStatus | null {
  if (tasks.length === 0) return null;
  return tasks
    .map((task) => deriveTaskStatus(task, now))
    .sort((a, b) => STATUS_PRIORITY[a] - STATUS_PRIORITY[b])[0];
}

const NAV_BUTTON =
  "grid size-11 place-items-center rounded-full border border-border/60 bg-surface-glass text-text-2 shadow-soft transition-colors hover:text-text";

export function WeekStrip({
  weekStart,
  days,
  tasksByDate,
  today,
  selectedDate,
  now,
  onPrev,
  onNext,
  onSelectDate,
}: WeekStripProps) {
  // Label by the week's midpoint so a two-month week reads as its dominant month.
  const weekLabel = formatThaiMonthYear(
    dateKeyToInstant(addDaysToKey(weekStart, 3)),
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{weekLabel}</h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onPrev}
            aria-label="สัปดาห์ก่อนหน้า"
            className={NAV_BUTTON}
          >
            <CaretLeft size={18} />
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="สัปดาห์ถัดไป"
            className={NAV_BUTTON}
          >
            <CaretRight size={18} />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {days.map((day, index) => {
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
              className={[
                "flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-standard py-1.5 transition-colors",
                isSelected ? "bg-primary-soft/60" : "hover:bg-surface-muted/60",
              ].join(" ")}
            >
              <span className="text-xs text-text-2">
                {WEEKDAY_LABELS_TH[index]}
              </span>
              <span
                className={[
                  "flex size-8 items-center justify-center rounded-full text-sm font-bold",
                  isSelected
                    ? "fk-clay fk-clay-blue text-primary-strong"
                    : isToday
                      ? "text-primary-strong ring-1 ring-inset ring-primary/50"
                      : "text-text",
                ].join(" ")}
              >
                {day.day}
              </span>
              <span
                className={`size-1.5 rounded-full ${status ? STATUS_DOT_CLASSES[status] : "bg-transparent"}`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
