/*
  Task status derivation and ordering (rules 1, 2, 10; locked 2026-09-01).
*/
import { calendarDaysBetween } from "./datetime";
import type {
  Task,
  TaskDerivedStatus,
  TaskDisplayStatus,
} from "./types";

/** Hard cap on active reminders per task (rule 10). Enforce in UI and on the server. */
export const MAX_TASK_REMINDERS = 2;

/** "ใกล้กำหนด" = due within the next this-many calendar days (rule 1). */
export const DUE_SOON_WITHIN_DAYS = 2;

/**
 * Display status for a task.
 * - done / cancelled: explicit, never overridden by due-date logic (rule 1)
 * - open: "เลยกำหนด" if the due instant has passed, else "ใกล้กำหนด" if due
 *   within the next 2 calendar days (Asia/Bangkok), else "กำลังทำ"
 */
export function deriveTaskStatus(
  task: Pick<Task, "dueAt" | "lifecycleStatus">,
  now: Date = new Date(),
): TaskDisplayStatus {
  if (task.lifecycleStatus === "done") return "done";
  if (task.lifecycleStatus === "cancelled") return "cancelled";

  const due = new Date(task.dueAt);
  if (due.getTime() < now.getTime()) return "overdue";

  return calendarDaysBetween(now, due) <= DUE_SOON_WITHIN_DAYS
    ? "duesoon"
    : "progress";
}

export function isOpenTask(task: Pick<Task, "lifecycleStatus">): boolean {
  return task.lifecycleStatus === "open";
}

const OPEN_STATUS_RANK: Record<TaskDerivedStatus, number> = {
  overdue: 0,
  duesoon: 1,
  progress: 2,
};

/**
 * Home ordering comparator (rule 2): overdue first, then due soon, then later,
 * each bucket ordered by due date/time ascending. Intended for open tasks.
 */
export function compareHomeTasks(
  a: Pick<Task, "dueAt" | "lifecycleStatus">,
  b: Pick<Task, "dueAt" | "lifecycleStatus">,
  now: Date = new Date(),
): number {
  const rankA = OPEN_STATUS_RANK[deriveTaskStatus(a, now) as TaskDerivedStatus] ?? 3;
  const rankB = OPEN_STATUS_RANK[deriveTaskStatus(b, now) as TaskDerivedStatus] ?? 3;
  if (rankA !== rankB) return rankA - rankB;
  return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
}

/** Open tasks for the Home overview, ordered per rule 2, capped at `limit` (default 3). */
export function selectHomeTasks<
  T extends Pick<Task, "dueAt" | "lifecycleStatus">,
>(tasks: T[], now: Date = new Date(), limit = 3): T[] {
  return tasks
    .filter(isOpenTask)
    .sort((a, b) => compareHomeTasks(a, b, now))
    .slice(0, limit);
}

/**
 * Calendar "กำลังจะถึง" list: open tasks whose due instant is still in the
 * future, soonest first, capped at `limit`. The future-only filter is what keeps
 * overdue tasks out (an open task due earlier today is overdue, not upcoming).
 */
export function selectUpcomingTasks<
  T extends Pick<Task, "dueAt" | "lifecycleStatus">,
>(tasks: T[], now: Date = new Date(), limit = 2): T[] {
  return tasks
    .filter(isOpenTask)
    .filter((t) => new Date(t.dueAt).getTime() > now.getTime())
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, limit);
}
