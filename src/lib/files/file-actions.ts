"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export interface FileActionResult {
  ok: boolean;
  error: string | null;
}

const GENERIC = "ลบไฟล์ไม่สำเร็จ กรุณาลองใหม่";
const AUTH = "กรุณาเข้าสู่ระบบใหม่";

/**
 * Soft-delete a Locker file. Proxies to the file-delete Edge Function with the
 * user's access token (never exposes the token or any Drive id to the client),
 * then revalidates the Locker + Home lists.
 */
export async function deleteFileAction(
  fileId: string,
): Promise<FileActionResult> {
  const config = getSupabaseConfig();
  if (!config) return { ok: false, error: GENERIC };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return { ok: false, error: AUTH };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return { ok: false, error: AUTH };

  const base = config.supabaseUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/functions/v1/file-delete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: config.supabasePublishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: fileId }),
    cache: "no-store",
  }).catch(() => null);

  if (!res) return { ok: false, error: GENERIC };
  if (!res.ok) {
    if (res.status === 404) return { ok: false, error: "ไม่พบไฟล์ หรือคุณไม่มีสิทธิ์" };
    if (res.status === 401) return { ok: false, error: AUTH };
    return { ok: false, error: GENERIC };
  }

  revalidatePath("/");
  revalidatePath("/locker");
  return { ok: true, error: null };
}
