/*
  Reminder preset vocabulary (rule 10, locked 2026-09-01).

  Schedule math lives in the database (public.compute_reminder_scheduled_at,
  preset vocabulary v2 in migration 20260903190000): reminders are persisted
  rows, and `scheduled_at` is recomputed server-side whenever a task's due
  datetime changes. `sent_at` is preserved and a reminder is never resent.
  Delivery is via LINE push (line-worker Edge Function).
*/
import type { ReminderPreset } from "./types";

export const REMINDER_PRESETS: readonly ReminderPreset[] = [
  "at_due_time",
  "ten_minutes_before",
  "one_day_before",
  "morning_of_due",
];

export const REMINDER_PRESET_LABELS: Record<ReminderPreset, string> = {
  at_due_time: "แจ้งตอนถึงเวลากำหนดจริง",
  ten_minutes_before: "10 นาทีก่อนกำหนด",
  one_day_before: "1 วันก่อนกำหนด",
  morning_of_due: "เช้าวันครบกำหนด",
};
