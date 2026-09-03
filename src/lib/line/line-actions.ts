"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LineActionState } from "@/lib/line/model";

const GENERIC = "ดำเนินการไม่สำเร็จ กรุณาลองใหม่";
const REASONS: Record<string, string> = {
  not_authenticated: "กรุณาเข้าสู่ระบบก่อน",
  not_owner: "เฉพาะเจ้าของครอบครัวเท่านั้นที่อนุมัติกลุ่มได้",
  conversation_not_found: "ไม่พบกลุ่มที่รออนุมัติ",
  not_a_group: "รายการนี้ไม่ใช่กลุ่ม LINE",
  group_bound_elsewhere: "กลุ่มนี้ถูกผูกกับครอบครัวอื่นแล้ว",
  workspace_already_has_group: "ครอบครัวนี้มีกลุ่ม LINE อยู่แล้ว ยกเลิกกลุ่มเดิมก่อน",
  not_bound: "ยังไม่มีกลุ่มที่ผูกไว้",
};

function messageFor(reason: string | null | undefined): string {
  if (!reason) return GENERIC;
  return REASONS[reason] ?? GENERIC;
}

interface RpcRow {
  blocked_reason?: string | null;
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

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function approveLineGroupAction(
  _prev: LineActionState,
  formData: FormData,
): Promise<LineActionState> {
  const workspaceId = readString(formData, "workspaceId");
  const conversationId = readString(formData, "conversationId");
  if (!workspaceId || !conversationId) {
    return { ok: false, error: GENERIC };
  }

  const supabase = await getAuthedClient();
  if (!supabase) return { ok: false, error: REASONS.not_authenticated };

  const { data, error } = await supabase.rpc("approve_line_group", {
    p_workspace_id: workspaceId,
    p_conversation_id: conversationId,
  });
  if (error) return { ok: false, error: GENERIC };

  const reason = firstRow(data)?.blocked_reason;
  if (reason) return { ok: false, error: messageFor(reason) };

  revalidatePath("/settings/line");
  return { ok: true, error: null };
}

export async function unbindLineGroupAction(
  _prev: LineActionState,
  formData: FormData,
): Promise<LineActionState> {
  const conversationId = readString(formData, "conversationId");
  if (!conversationId) return { ok: false, error: GENERIC };

  const supabase = await getAuthedClient();
  if (!supabase) return { ok: false, error: REASONS.not_authenticated };

  const { data, error } = await supabase.rpc("unbind_line_group", {
    p_conversation_id: conversationId,
  });
  if (error) return { ok: false, error: GENERIC };

  const reason = firstRow(data)?.blocked_reason;
  if (reason) return { ok: false, error: messageFor(reason) };

  revalidatePath("/settings/line");
  return { ok: true, error: null };
}
