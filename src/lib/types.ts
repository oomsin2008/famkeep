/*
  KitiButler domain types. Phase 0: shapes only, no data layer.
  Rules reference: memory/famkeep-locked-decisions.md (locked 2026-09-01).
*/

/** Ownership context. Locked read-only after task creation (rule 7). */
export type Workspace = "private" | "family";

/** The four reminder presets. Hard max 2 active per task (rule 10). */
export type ReminderPreset =
  | "at_due_time"
  | "ten_minutes_before"
  | "one_day_before"
  | "morning_of_due";

export interface TaskReminder {
  id: string;
  preset: ReminderPreset;
  /** ISO 8601 UTC. Recomputed whenever the task due date/time changes (rule 10). */
  scheduledAt: string;
  /** ISO 8601 UTC once delivered via LINE push; null while pending. Never resent. */
  sentAt: string | null;
}

/**
 * User-controlled lifecycle. "done"/"cancelled" are explicit and are never
 * auto-overridden by due-date logic (rule 1). "open" tasks get a derived
 * display status (progress/duesoon/overdue) computed at read time.
 */
export type TaskLifecycleStatus = "open" | "done" | "cancelled";

/** Statuses derived from an open task's due date relative to now (Asia/Bangkok). */
export type TaskDerivedStatus = "progress" | "duesoon" | "overdue";

/** What a status badge shows: derived value for open tasks, else the explicit one. */
export type TaskDisplayStatus = TaskDerivedStatus | "done" | "cancelled";

export interface Task {
  id: string;
  title: string;
  notes: string;
  workspace: Workspace;
  /** Family member id, or null for "ทุกคน". Private tasks are implicitly self. */
  assigneeId: string | null;
  /** ISO 8601 UTC. Displayed and evaluated in Asia/Bangkok (rule 3). */
  dueAt: string;
  lifecycleStatus: TaskLifecycleStatus;
  /** At most 2 (rule 10). */
  reminders: TaskReminder[];
  createdAt: string;
  updatedAt: string;
}

/**
 * A task plus the display fields resolved server-side from related rows
 * (family member names, workspace name) so the task UI stays free of the
 * data layer and of mock lookups.
 */
export interface TaskView extends Task {
  /**
   * Assignee's family-member display name. `null` when there is no specific
   * assignee ("ทุกคน") or the task is private. A distinct label is used when
   * the assignee is a profile that is no longer in the family workspace.
   */
  assigneeName: string | null;
  /** Family workspace name for family tasks; "ของฉัน" for private tasks. */
  workspaceName: string;
}

export type FileKind = "pdf" | "image" | "doc" | "other";

export interface FileItem {
  id: string;
  name: string;
  kind: FileKind;
  workspace: Workspace;
  sizeBytes: number;
  /** Profile id of whoever saved the file. */
  savedById: string;
  /** True when ingested from LINE (auto-save or #เก็บ). */
  savedViaLine: boolean;
  createdAt: string;
  /** Null in MVP: originals live in Google Drive and are not served yet (rule 8). */
  downloadUrl: string | null;
}

/**
 * A file plus display fields resolved server-side (saver name, workspace name)
 * so the Locker UI stays free of the data layer and of mock lookups.
 */
export interface FileView extends FileItem {
  /** Display name of the saver, resolved for family files; "คุณ" for own private files. */
  savedByName: string;
  /** Family workspace name for family files; "ของฉัน" for private files. */
  workspaceName: string;
}

export type FamilyRole = "owner" | "member";
