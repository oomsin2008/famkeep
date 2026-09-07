"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ProfileActionResult {
  ok: boolean;
  error: string | null;
  name?: string;
}

const GENERIC = "บันทึกไม่สำเร็จ กรุณาลองใหม่";
const REASONS: Record<string, string> = {
  not_authenticated: "กรุณาเข้าสู่ระบบใหม่",
  empty_name: "กรุณากรอกชื่อที่แสดง",
};

/** Update the signed-in user's display name via the column-scoped
 *  update_own_profile RPC (never touches line_user_id / email / avatar_url). */
export async function updateDisplayNameAction(
  name: string,
): Promise<ProfileActionResult> {
  const clean = name.trim();
  if (!clean) return { ok: false, error: REASONS.empty_name };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return { ok: false, error: REASONS.not_authenticated };

  const { data, error } = await supabase.rpc("update_own_profile", {
    p_display_name: clean,
  });
  if (error) return { ok: false, error: GENERIC };

  const row = (Array.isArray(data) ? data[0] : data) as
    | { display_name?: string | null; blocked_reason?: string | null }
    | null;
  if (row?.blocked_reason) {
    return { ok: false, error: REASONS[row.blocked_reason] ?? GENERIC };
  }

  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true, error: null, name: row?.display_name ?? clean };
}
