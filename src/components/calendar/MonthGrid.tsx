"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { formatThaiMonthYear } from "@/lib/datetime";
import {
  dateKeyToInstant,
  monthAnchorKey,
  WEEKDAY_LABELS_TH,
  type CalendarDay,
  type MonthAnchor,
} from "@/lib/calendar";
import type { TaskView } from "@/lib/types";
import { DayCell } from "./DayCell";

interface MonthGridProps {
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
  "grid size-11 place-items-center rounded-standard text-text-2 hover:bg-surface-muted";

export function MonthGrid({
  anchor,
  days,
  tasksByDate,
  today,
  selectedDate,
  now,
  onPrev,
  onNext,
  onSelectDate,
}: MonthGridProps) {
  const monthLabel = formatThaiMonthYear(dateKeyToInstant(monthAnchorKey(anchor)));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{monthLabel}</h2>
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

      <div className="mt-4 grid grid-cols-7 border-l border-t border-border">
        {WEEKDAY_LABELS_TH.map((label) => (
          <div
            key={label}
            className="border-b border-r border-border bg-surface-muted py-2 text-center text-xs font-semibold text-text-2"
          >
            {label}
          </div>
        ))}
        {days.map((day) => (
          <DayCell
            key={day.key}
            day={day}
            tasks={tasksByDate.get(day.key) ?? []}
            isToday={day.key === today}
            isSelected={day.key === selectedDate}
            now={now}
            onSelect={() => onSelectDate(day.key)}
          />
        ))}
      </div>
    </div>
  );
}
