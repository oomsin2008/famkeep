"use client";

import { useMemo, useState } from "react";
import { useTasks } from "@/components/providers/TasksProvider";
import { bangkokDateKey } from "@/lib/datetime";
import { selectUpcomingTasks } from "@/lib/tasks";
import {
  buildMonthGrid,
  buildWeek,
  monthAnchorOf,
  shiftMonth,
  shiftWeek,
  todayKey,
  weekStartOf,
  type MonthAnchor,
} from "@/lib/calendar";
import type { TaskView } from "@/lib/types";
import { MonthGrid } from "./MonthGrid";
import { WeekStrip } from "./WeekStrip";
import { DayPanel } from "./DayPanel";
import { UpcomingList } from "./UpcomingList";

/** Tasks keyed by their Bangkok-local due date, each day sorted by due datetime asc. */
function groupByDueDate(tasks: TaskView[]): Map<string, TaskView[]> {
  const map = new Map<string, TaskView[]>();
  for (const task of tasks) {
    const key = bangkokDateKey(task.dueAt);
    const list = map.get(key);
    if (list) list.push(task);
    else map.set(key, [task]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }
  return map;
}

export function CalendarView({ tasks }: { tasks: TaskView[] }) {
  const { now } = useTasks();

  if (!now) {
    return <div className="fk-card h-64 animate-pulse" />;
  }

  return <CalendarBody tasks={tasks} now={now} />;
}

/**
 * Selected-date navigation (deterministic):
 * - ‹ › on the month grid change only the visible month; ‹ › on the week strip
 *   change only the visible week. Neither moves the selected date.
 * - If the selected date is outside the visible month/week, no cell is
 *   highlighted, but the day panel keeps showing that date (heading carries the
 *   full BE date so an off-range selection stays legible).
 * - Selecting any date re-centres both the month anchor and the week on it.
 */
function CalendarBody({ tasks, now }: { tasks: TaskView[]; now: Date }) {
  const today = todayKey(now);
  const [selectedDate, setSelectedDate] = useState(today);
  const [monthAnchor, setMonthAnchor] = useState<MonthAnchor>(() =>
    monthAnchorOf(today),
  );
  const [weekStart, setWeekStart] = useState(() => weekStartOf(today));

  const tasksByDate = useMemo(() => groupByDueDate(tasks), [tasks]);
  const monthDays = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor]);
  const weekDays = useMemo(() => buildWeek(weekStart), [weekStart]);
  const upcoming = useMemo(() => selectUpcomingTasks(tasks, now), [tasks, now]);

  const selectDate = (key: string) => {
    setSelectedDate(key);
    setMonthAnchor(monthAnchorOf(key));
    setWeekStart(weekStartOf(key));
  };

  const selectedTasks = tasksByDate.get(selectedDate) ?? [];

  return (
    <div>
      <h1 className="text-[26px] font-semibold md:text-[32px]">ปฏิทิน</h1>

      <div className="mt-6 md:grid md:grid-cols-[1.6fr_1fr] md:items-start md:gap-7">
        <div data-calendar="month" className="fk-panel hidden p-6 md:block">
          <MonthGrid
            anchor={monthAnchor}
            days={monthDays}
            tasksByDate={tasksByDate}
            today={today}
            selectedDate={selectedDate}
            now={now}
            onPrev={() => setMonthAnchor((a) => shiftMonth(a, -1))}
            onNext={() => setMonthAnchor((a) => shiftMonth(a, 1))}
            onSelectDate={selectDate}
          />
        </div>

        <div data-calendar="week" className="fk-card p-4 md:hidden">
          <WeekStrip
            weekStart={weekStart}
            days={weekDays}
            tasksByDate={tasksByDate}
            today={today}
            selectedDate={selectedDate}
            now={now}
            onPrev={() => setWeekStart((w) => shiftWeek(w, -1))}
            onNext={() => setWeekStart((w) => shiftWeek(w, 1))}
            onSelectDate={selectDate}
          />
        </div>

        <div className="md:fk-glass md:sticky md:top-24 md:rounded-panel md:p-5">
          <DayPanel selectedDate={selectedDate} tasks={selectedTasks} now={now} />

          <div className="md:hidden">
            <UpcomingList tasks={upcoming} now={now} />
          </div>
        </div>
      </div>
    </div>
  );
}
