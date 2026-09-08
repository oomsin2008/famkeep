"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FamilyActionState } from "./model";

const REASON_MESSAGES: Record<string, string> = {
  not_authenticated: "กรุณาเข้าสู่ระบบก่อน",
  profile_not_provisioned:
    "ยังไม่ได้ตั้งค่าโปรไฟล์ กรุณาเข้าสู่ระบบด้วย LINE อีกครั้ง",
  invalid_name: "กรุณากรอกชื่อพื้นที่ครอบครัว (ไม่เกิน 120 ตัวอักษร)",
  not_owner: "เฉพาะเจ้าของพื้นที่ครอบครัวเท่านั้นที่จัดการสมาชิกได้",
  invalid_line_user_id: "LINE user ID ไม่ถูกต้อง",
  profile_not_found: "ไม่พบผู้ใช้ KitiButler สำหรับ LINE user ID นี้",
  already_member: "ผู้ใช้นี้เป็นสมาชิกอยู่แล้ว",
  not_a_member: "ไม่พบสมาชิกนี้ในพื้นที่ครอบครัว",
  last_owner: "ต้องมีเจ้าของอย่างน้อยหนึ่งคนเสมอ",
  permission_denied: "ไม่มีสิทธิ์ดำเนินการ",
};

const GENERIC_ERROR = "ดำเนินการไม่สำเร็จ กรุณาลองใหม่";

function reasonToMessage(reason: string | null | undefined): string {
  if (!reason) {
    return GENERIC_ERROR;
  }
  return REASON_MESSAGES[reason] ?? GENERIC_ERROR;
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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

  if (error || !user) {
    return null;
  }

  return supabase;
}

interface RpcRow {
  blocked_reason?: string | null;
}

function firstRow(data: unknown): RpcRow | null {
  if (Array.isArray(data)) {
    return (data[0] as RpcRow | undefined) ?? null;
  }
  return (data as RpcRow | null) ?? null;
}

export async function createFamilyWorkspaceAction(
  _prev: FamilyActionState,
  formData: FormData,
): Promise<FamilyActionState> {
  const name = readString(formData, "name");
  if (!name) {
    return { ok: false, error: REASON_MESSAGES.invalid_name };
  }

  const supabase = await getAuthedClient();
  if (!supabase) {
    return { ok: false, error: REASON_MESSAGES.not_authenticated };
  }

  const { data, error } = await supabase.rpc("create_family_workspace", {
    p_name: name,
  });

  if (error) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const reason = firstRow(data)?.blocked_reason;
  if (reason) {
    return { ok: false, error: reasonToMessage(reason) };
  }

  revalidatePath("/settings/family");
  return { ok: true, error: null };
}

export async function addFamilyMemberAction(
  _prev: FamilyActionState,
  formData: FormData,
): Promise<FamilyActionState> {
  const workspaceId = readString(formData, "workspaceId");
  const lineUserId = readString(formData, "lineUserId");

  if (!workspaceId) {
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!lineUserId) {
    return { ok: false, error: REASON_MESSAGES.invalid_line_user_id };
  }

  const supabase = await getAuthedClient();
  if (!supabase) {
    return { ok: false, error: REASON_MESSAGES.not_authenticated };
  }

  const { data, error } = await supabase.rpc("add_family_member_by_line_user_id", {
    p_workspace_id: workspaceId,
    p_line_user_id: lineUserId,
  });

  if (error) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const reason = firstRow(data)?.blocked_reason;
  if (reason) {
    return { ok: false, error: reasonToMessage(reason) };
  }

  revalidatePath("/settings/family");
  return { ok: true, error: null };
}

export async function removeFamilyMemberAction(
  _prev: FamilyActionState,
  formData: FormData,
): Promise<FamilyActionState> {
  const workspaceId = readString(formData, "workspaceId");
  const profileId = readString(formData, "profileId");

  if (!workspaceId || !profileId) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const supabase = await getAuthedClient();
  if (!supabase) {
    return { ok: false, error: REASON_MESSAGES.not_authenticated };
  }

  const { data, error } = await supabase.rpc("remove_family_member", {
    p_workspace_id: workspaceId,
    p_profile_id: profileId,
  });

  if (error) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const reason = firstRow(data)?.blocked_reason;
  if (reason) {
    return { ok: false, error: reasonToMessage(reason) };
  }

  revalidatePath("/settings/family");
  return { ok: true, error: null };
}
