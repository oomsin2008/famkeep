/*
  Centralized date/time utilities for FamKeep (rule 3, locked 2026-09-01).

  - Product locale: th-TH
  - Canonical timezone: Asia/Bangkok
  - Backend stores UTC; convert to Bangkok for display and business rules
  - Thai dates display in Buddhist Era via Intl (ca-buddhist) — no scattered +543
*/
import { differenceInCalendarDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const APP_LOCALE = "th-TH";
export const APP_TIME_ZONE = "Asia/Bangkok";
/** th-TH with the Buddhist calendar: yields BE years and Thai month names natively. */
export const APP_BE_LOCALE = "th-TH-u-ca-buddhist";

type DateInput = Date | string | number;

function asDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

/** UTC instant -> Date whose fields read as Asia/Bangkok wall-clock time. */
export function toBangkok(utc: DateInput): Date {
  return toZonedTime(asDate(utc), APP_TIME_ZONE);
}

/** Asia/Bangkok wall-clock time -> the corresponding UTC instant. */
export function bangkokToUtc(wallClock: DateInput): Date {
  return fromZonedTime(asDate(wallClock), APP_TIME_ZONE);
}

/** Combine a `yyyy-MM-dd` date and optional `HH:mm` time (Bangkok) into a UTC ISO string. */
export function bangkokDateTimeToUtcIso(date: string, time?: string): string {
  const stamp = time && time.length > 0 ? `${date}T${time}:00` : `${date}T00:00:00`;
  return bangkokToUtc(stamp).toISOString();
}

/** Whole calendar days from `now` to `target`, counted in Asia/Bangkok. */
export function calendarDaysBetween(now: DateInput, target: DateInput): number {
  return differenceInCalendarDays(toBangkok(target), toBangkok(now));
}

const beDate = new Intl.DateTimeFormat(APP_BE_LOCALE, {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const beDateTime = new Intl.DateTimeFormat(APP_BE_LOCALE, {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const beTime = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const beMonthYear = new Intl.DateTimeFormat(APP_BE_LOCALE, {
  timeZone: APP_TIME_ZONE,
  month: "long",
  year: "numeric",
});

const beWeekdayLong = new Intl.DateTimeFormat(APP_BE_LOCALE, {
  timeZone: APP_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const beFullDate = new Intl.DateTimeFormat(APP_BE_LOCALE, {
  timeZone: APP_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** e.g. "3 ก.ย. 2569" */
export function formatThaiDate(utc: DateInput): string {
  return beDate.format(asDate(utc));
}

/** e.g. "3 ก.ย. 2569 18:00" */
export function formatThaiDateTime(utc: DateInput): string {
  return beDateTime.format(asDate(utc));
}

/** e.g. "18:00" */
export function formatThaiTime(utc: DateInput): string {
  return beTime.format(asDate(utc));
}

/** e.g. "กันยายน 2569" */
export function formatThaiMonthYear(utc: DateInput): string {
  return beMonthYear.format(asDate(utc));
}

/** e.g. "วันศุกร์ที่ 6 กันยายน" */
export function formatThaiWeekdayDate(utc: DateInput): string {
  return beWeekdayLong.format(asDate(utc));
}

/** e.g. "วันศุกร์ที่ 6 กันยายน 2569" — carries the BE year (calendar day-panel heading). */
export function formatThaiFullDate(utc: DateInput): string {
  return beFullDate.format(asDate(utc));
}

/** `yyyy-MM-dd` for the given instant, in Asia/Bangkok (stable map key for calendar grids). */
export function bangkokDateKey(utc: DateInput): string {
  const d = toBangkok(utc);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** `HH:mm` (24h) for the given instant, in Asia/Bangkok — for `<input type="time">` values. */
export function bangkokTimeKey(utc: DateInput): string {
  const d = toBangkok(utc);
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}
