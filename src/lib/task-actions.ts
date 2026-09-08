"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ReminderPreset, TaskLifecycleStatus } from "@/lib/types";

export interface TaskActionResult {
  ok: boolean;
  taskId?: string;
  error: string | null;
}

const GENERIC_ERROR = "ดำเนินการไม่สำเร็จ กรุณาลองใหม่";

const REASON_MESSAGES: Record<string, string> = {
  not_authenticated: "กรุณาเข้าสู่ระบบก่อน",
  no_workspace_access: "ไม่มีสิทธิ์เข้าถึงพื้นที่นี้",
  no_task_access: "ไม่มีสิทธิ์เข้าถึงงานนี้",
  invalid_title: "กรุณากรอกชื่องาน (ไม่เกิน 200 ตัวอักษร)",
  invalid_notes: "รายละเอียดยาวเกินไป",
  invalid_due_at: "กรุณาเลือกวันและเวลาครบกำหนด",
  invalid_status: "สถานะไม่ถูกต้อง",
  invalid_reminder_preset: "รูปแบบการแจ้งเตือนไม่ถูกต้อง",
  private_assignee_not_allowed: "งานส่วนตัวมอบหมายให้ผู้อื่นไม่ได้",
  assignee_not_family_member: "ผู้รับมอบหมายต้องเป็นสมาชิกในครอบครัวนี้",
  too_many_reminders: "ตั้งการแจ้งเตือนได้สูงสุด 2 รายการ",
  duplicate_reminder: "มีการแจ้งเตือนรูปแบบนี้อยู่แล้ว",
  reminder_conflict: "ไม่สามารถเพิ่มการแจ้งเตือนได้ กรุณาลองใหม่",
  reminder_already_sent: "การแจ้งเตือนนี้ถูกส่งไปแล้ว",
  task_conflict: "ไม่สามารถบันทึกงานได้ กรุณาลองใหม่",
  task_constraint_violation: "ข้อมูลงานไม่ถูกต้อง",
  permission_denied: "ไม่มีสิทธิ์ดำเนินการ",
};

function messageFor(reason: string | null | undefined): string {
  if (!reason) return GENERIC_ERROR;
  return REASON_MESSAGES[reason] ?? GENERIC_ERROR;
}

function revalidateTaskRoutes() {
  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/tasks/[id]", "page");
}

interface RpcRow {
  blocked_reason?: string | null;
  task_id?: string | null;
}

function firstRow(data: unknown): RpcRow | null {
  if (Array.isArray(data)) return (data[0] as RpcRow | undefined) ?? null;
  return (data as RpcRow | null) ?? null;
}

async function getAuthedClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser().catch(() => ({
    data: { user: null },
    error: new Error("auth lookup failed"),
  }));

  if (error || !user) return null;
  return supabase;
}

async function runMutation(
  fn: string,
  args: Record<string, unknown>,
): Promise<TaskActionResult> {
  const supabase = await getAuthedClient();
  if (!supabase) return { ok: false, error: REASON_MESSAGES.not_authenticated };

  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: GENERIC_ERROR };

  const row = firstRow(data);
  if (row?.blocked_reason) {
    return { ok: false, error: messageFor(row.blocked_reason) };
  }

  revalidateTaskRoutes();
  return { ok: true, error: null };
}

export interface CreateTaskActionInput {
  workspaceId: string;
  title: string;
  notes: string;
  assigneeId: string | null;
  dueAtIso: string;
  reminderPresets: ReminderPreset[];
}

export async function createTaskAction(
  input: CreateTaskActionInput,
): Promise<TaskActionResult> {
  const supabase = await getAuthedClient();
  if (!supabase) return { ok: false, error: REASON_MESSAGES.not_authenticated };

  const { data, error } = await supabase.rpc("create_task", {
    p_workspace_id: input.workspaceId,
    p_title: input.title,
    p_notes: input.notes,
    p_assignee_profile_id: input.assigneeId,
    p_due_at: input.dueAtIso,
    p_reminder_presets: input.reminderPresets,
  });

  if (error) return { ok: false, error: GENERIC_ERROR };

  const row = firstRow(data);
  if (row?.blocked_reason) {
    return { ok: false, error: messageFor(row.blocked_reason) };
  }

  revalidateTaskRoutes();
  return { ok: true, taskId: row?.task_id ?? undefined, error: null };
}

export async function updateTaskFieldsAction(
  taskId: string,
  patch: { title?: string; notes?: string },
): Promise<TaskActionResult> {
  return runMutation("update_task_fields", {
    p_task_id: taskId,
    p_title: patch.title ?? null,
    p_notes: patch.notes ?? null,
  });
}

export async function setTaskAssigneeAction(
  taskId: string,
  assigneeId: string | null,
): Promise<TaskActionResult> {
  return runMutation("set_task_assignee", {
    p_task_id: taskId,
    p_assignee_profile_id: assigneeId,
  });
}

export async function setTaskLifecycleAction(
  taskId: string,
  status: TaskLifecycleStatus,
): Promise<TaskActionResult> {
  return runMutation("set_task_lifecycle", {
    p_task_id: taskId,
    p_status: status,
  });
}

export async function setTaskDueAtAction(
  taskId: string,
  dueAtIso: string,
): Promise<TaskActionResult> {
  return runMutation("set_task_due_at", {
    p_task_id: taskId,
    p_due_at: dueAtIso,
  });
}

export async function addTaskReminderAction(
  taskId: string,
  preset: ReminderPreset,
): Promise<TaskActionResult> {
  return runMutation("add_task_reminder", {
    p_task_id: taskId,
    p_preset: preset,
  });
}

export async function removeTaskReminderAction(
  taskId: string,
  preset: ReminderPreset,
): Promise<TaskActionResult> {
  return runMutation("remove_task_reminder", {
    p_task_id: taskId,
    p_preset: preset,
  });
}

/** Soft-delete one task (recoverable in the DB). */
export async function deleteTaskAction(taskId: string): Promise<TaskActionResult> {
  return runMutation("soft_delete_task", { p_task_id: taskId });
}

export interface BulkDeleteResult {
  ok: boolean;
  count: number;
  error: string | null;
}

/** Soft-delete the given tasks, one `soft_delete_task` call each. Ids the caller
 *  cannot access are counted as failures. */
export async function deleteTasksAction(
  taskIds: string[],
): Promise<BulkDeleteResult> {
  const ids = [...new Set(taskIds.filter(Boolean))];
  if (ids.length === 0) return { ok: true, count: 0, error: null };

  const supabase = await getAuthedClient();
  if (!supabase) {
    return { ok: false, count: 0, error: REASON_MESSAGES.not_authenticated };
  }

  let deleted = 0;
  let failed = 0;
  for (const id of ids) {
    const { data, error } = await supabase.rpc("soft_delete_task", {
      p_task_id: id,
    });
    if (!error && !firstRow(data)?.blocked_reason) deleted += 1;
    else failed += 1;
  }

  revalidateTaskRoutes();
  return {
    ok: failed === 0,
    count: deleted,
    error: failed > 0 ? "บางรายการลบไม่สำเร็จ กรุณาลองอีกครั้ง" : null,
  };
}

/** Soft-delete every task (any status) in the caller's private workspace. */
export async function deleteAllMyTasksAction(): Promise<BulkDeleteResult> {
  const supabase = await getAuthedClient();
  if (!supabase) {
    return { ok: false, count: 0, error: REASON_MESSAGES.not_authenticated };
  }

  const { data, error } = await supabase.rpc("soft_delete_all_my_tasks");
  if (error) return { ok: false, count: 0, error: GENERIC_ERROR };

  revalidateTaskRoutes();
  return { ok: true, count: typeof data === "number" ? data : 0, error: null };
}
