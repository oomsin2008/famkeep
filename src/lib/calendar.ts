/*
  Pure calendar-grid helpers for the Calendar screen. Everything operates on
  `yyyy-MM-dd` Bangkok-local date keys (the same key space as `bangkokDateKey`).
  Day arithmetic runs on plain Date objects read with local getters — safe here
  because Thailand has no DST and every key round-trips through the same fields.
*/
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { bangkokDateKey, bangkokDateTimeToUtcIso } from "./datetime";

export const WEEKDAY_LABELS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"] as const;

export interface CalendarDay {
  /** `yyyy-MM-dd` */
  key: string;
  /** day of month */
  day: number;
  /** belongs to the grid's target month (month grid only; always true for the week strip) */
  inMonth: boolean;
}

export interface MonthAnchor {
  year: number;
  /** 1-12 */
  month: number;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** `yyyy-MM-dd` from a Date's local fields. */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `yyyy-MM-dd` -> Date at local midnight with those exact fields. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysToKey(key: string, n: number): string {
  return toDateKey(addDays(parseDateKey(key), n));
}

/** Today's date key, in Asia/Bangkok. */
export function todayKey(now: Date): string {
  return bangkokDateKey(now);
}

export function monthAnchorOf(key: string): MonthAnchor {
  const d = parseDateKey(key);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function monthAnchorKey(anchor: MonthAnchor): string {
  return `${anchor.year}-${pad(anchor.month)}-01`;
}

export function shiftMonth(anchor: MonthAnchor, delta: number): MonthAnchor {
  const d = addMonths(new Date(anchor.year, anchor.month - 1, 1), delta);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** Sunday-of-week key for the week containing `key`. */
export function weekStartOf(key: string): string {
  return toDateKey(startOfWeek(parseDateKey(key), { weekStartsOn: 0 }));
}

export function shiftWeek(weekStartKey: string, deltaWeeks: number): string {
  return addDaysToKey(weekStartKey, deltaWeeks * 7);
}

/** 5- or 6-row month grid (Sunday-first), trimmed to whole weeks. */
export function buildMonthGrid(anchor: MonthAnchor): CalendarDay[] {
  const first = new Date(anchor.year, anchor.month - 1, 1);
  const start = startOfWeek(startOfMonth(first), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(first), { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end }).map((d) => ({
    key: toDateKey(d),
    day: d.getDate(),
    inMonth: d.getMonth() === anchor.month - 1,
  }));
}

/** 7 days starting at `weekStartKey`. */
export function buildWeek(weekStartKey: string): CalendarDay[] {
  const start = parseDateKey(weekStartKey);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    return { key: toDateKey(d), day: d.getDate(), inMonth: true };
  });
}

/** A safe UTC instant inside the given Bangkok day (noon) — for the BE formatters. */
export function dateKeyToInstant(key: string): string {
  return bangkokDateTimeToUtcIso(key, "12:00");
}
