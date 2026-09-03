/*
  Thai copy + token class maps for task UI. Class strings are static literals so
  Tailwind can see them.
*/
import type { TaskDisplayStatus, TaskView, Workspace } from "@/lib/types";

export const STATUS_LABELS: Record<TaskDisplayStatus, string> = {
  progress: "กำลังทำ",
  duesoon: "ใกล้กำหนด",
  overdue: "เลยกำหนด",
  done: "เสร็จแล้ว",
  cancelled: "ยกเลิก",
};

/** text / bg / border token classes per status (readme §2). */
export const STATUS_BADGE_CLASSES: Record<TaskDisplayStatus, string> = {
  progress:
    "text-status-progress-text bg-status-progress-bg border-status-progress-border",
  duesoon:
    "text-status-duesoon-text bg-status-duesoon-bg border-status-duesoon-border",
  overdue:
    "text-status-overdue-text bg-status-overdue-bg border-status-overdue-border",
  done: "text-status-done-text bg-status-done-bg border-status-done-border",
  cancelled:
    "text-status-cancelled-text bg-status-cancelled-bg border-status-cancelled-border",
};

/** Solid dot colour per status — calendar week-strip markers (status only, never ownership). */
export const STATUS_DOT_CLASSES: Record<TaskDisplayStatus, string> = {
  progress: "bg-status-progress-text",
  duesoon: "bg-status-duesoon-text",
  overdue: "bg-status-overdue-text",
  done: "bg-status-done-text",
  cancelled: "bg-status-cancelled-text",
};

/** Ownership label. Family tasks/pills pass the real workspace name. */
export function workspaceLabel(workspace: Workspace, familyName?: string): string {
  return workspace === "private" ? "ของฉัน" : (familyName?.trim() || "ครอบครัว");
}

/** Short ownership word for compact meta lines. */
export function workspaceShortLabel(workspace: Workspace): string {
  return workspace === "private" ? "ส่วนตัว" : "ครอบครัว";
}

/** Row subtitle: "งานส่วนตัว" or "<family name> · มอบหมายให้ <name>". */
export function taskSubtitle(
  task: Pick<TaskView, "workspace" | "assigneeName" | "workspaceName">,
): string {
  if (task.workspace === "private") return "งานส่วนตัว";
  return `${task.workspaceName} · มอบหมายให้ ${task.assigneeName ?? "ทุกคน"}`;
}
