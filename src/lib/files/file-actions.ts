"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export interface FileActionResult {
  ok: boolean;
  error: string | null;
}

export interface RenameFileResult extends FileActionResult {
  name?: string;
}

const GENERIC = "ลบไฟล์ไม่สำเร็จ กรุณาลองใหม่";
const RENAME_GENERIC = "เปลี่ยนชื่อไฟล์ไม่สำเร็จ กรุณาลองใหม่";
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

/**
 * Rename a Locker file. Proxies to the file-rename Edge Function with the user's
 * access token server-side (no token or Drive id reaches the client); the Edge
 * Function keeps the original extension. Revalidates the Locker + Home lists.
 */
export async function renameFileAction(
  fileId: string,
  name: string,
): Promise<RenameFileResult> {
  const clean = name.trim();
  if (!clean) return { ok: false, error: RENAME_GENERIC };

  const config = getSupabaseConfig();
  if (!config) return { ok: false, error: RENAME_GENERIC };

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
  const res = await fetch(`${base}/functions/v1/file-rename`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: config.supabasePublishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: fileId, name: clean }),
    cache: "no-store",
  }).catch(() => null);

  if (!res) return { ok: false, error: RENAME_GENERIC };
  const data = (await res.json().catch(() => ({}))) as {
    name?: string;
    stage?: string;
  };
  if (!res.ok) {
    if (res.status === 404) return { ok: false, error: "ไม่พบไฟล์ หรือคุณไม่มีสิทธิ์" };
    if (res.status === 401) return { ok: false, error: AUTH };
    if (data.stage === "drive_reauth" || data.stage === "drive_not_configured") {
      return { ok: false, error: "ระบบจัดเก็บไฟล์ยังไม่พร้อมใช้งาน" };
    }
    return { ok: false, error: RENAME_GENERIC };
  }

  revalidatePath("/");
  revalidatePath("/locker");
  return { ok: true, error: null, name: data.name };
}

export interface BulkDeleteFilesResult {
  ok: boolean;
  count: number;
  failed: number;
  error: string | null;
}

/**
 * Soft-delete every file in the caller's private Locker. Each file goes through
 * the same file-delete Edge Function as a single delete (metadata + best-effort
 * Drive cleanup), one at a time — the private locker is small in practice.
 */
export async function deleteAllMyFilesAction(): Promise<BulkDeleteFilesResult> {
  const config = getSupabaseConfig();
  if (!config) return { ok: false, count: 0, failed: 0, error: GENERIC };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return { ok: false, count: 0, failed: 0, error: AUTH };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, count: 0, failed: 0, error: AUTH };
  }

  const { data: rows, error: listErr } = await supabase
    .from("files")
    .select("id, workspaces!inner(type)")
    .is("deleted_at", null)
    .eq("workspaces.type", "private");
  if (listErr) return { ok: false, count: 0, failed: 0, error: GENERIC };

  const ids = ((rows as { id: string }[] | null) ?? []).map((r) => r.id);
  if (ids.length === 0) return { ok: true, count: 0, failed: 0, error: null };

  const base = config.supabaseUrl.replace(/\/+$/, "");
  let deleted = 0;
  let failed = 0;
  for (const id of ids) {
    const res = await fetch(`${base}/functions/v1/file-delete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: config.supabasePublishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
      cache: "no-store",
    }).catch(() => null);
    if (res?.ok) deleted += 1;
    else failed += 1;
  }

  revalidatePath("/");
  revalidatePath("/locker");
  return {
    ok: failed === 0,
    count: deleted,
    failed,
    error: failed > 0 ? "บางไฟล์ลบไม่สำเร็จ กรุณาลองอีกครั้ง" : null,
  };
}
