"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import Link from "next/link";
import { deriveTaskStatus } from "@/lib/tasks";
import { dateKeyToInstant } from "@/lib/calendar";
import type { CalendarDay } from "@/lib/calendar";
import type { TaskView } from "@/lib/types";
import { formatThaiFullDate } from "@/lib/datetime";
import { STATUS_BADGE_CLASSES } from "@/components/tasks/presentation";

interface DayCellProps {
  day: CalendarDay;
  tasks: TaskView[];
  isToday: boolean;
  isSelected: boolean;
  now: Date;
  onSelect: () => void;
}

const MAX_CHIPS = 2;

export function DayCell({
  day,
  tasks,
  isToday,
  isSelected,
  now,
  onSelect,
}: DayCellProps) {
  const chips = tasks.slice(0, MAX_CHIPS);
  const extra = tasks.length - chips.length;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Only when the cell itself is focused — Enter on a focused chip must not also select.
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  const stopChipBubble = (event: MouseEvent) => event.stopPropagation();

  const className = [
    "flex min-h-[96px] cursor-pointer flex-col gap-1 border-b border-r border-border/60 p-1.5 text-left transition-colors",
    isSelected ? "bg-primary-soft/60" : "hover:bg-surface-muted/60",
  ].join(" ");

  return (
    <div
      role="button"
      tabIndex={0}
      data-date={day.key}
      aria-label={formatThaiFullDate(dateKeyToInstant(day.key))}
      aria-pressed={isSelected}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={className}
    >
      <span
        className={[
          "flex size-6 items-center justify-center rounded-full text-xs font-bold",
          isSelected
            ? "fk-clay fk-clay-blue text-primary-strong"
            : isToday
              ? "text-primary-strong ring-1 ring-inset ring-primary/50"
              : day.inMonth
                ? "text-text-2"
                : "text-text-soft/60",
        ].join(" ")}
      >
        {day.day}
      </span>

      <div className="flex min-w-0 flex-col gap-0.5">
        {chips.map((task) => {
          const status = deriveTaskStatus(task, now);
          return (
            <Link
              key={task.id}
              href={`/tasks/${task.id}?from=calendar`}
              onClick={stopChipBubble}
              title={task.title}
              className={`truncate rounded-[7px] border px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[status]}`}
            >
              {task.title}
            </Link>
          );
        })}
        {extra > 0 && (
          <span className="px-1.5 text-xs text-text-2">+{extra} เพิ่มเติม</span>
        )}
      </div>
    </div>
  );
}
