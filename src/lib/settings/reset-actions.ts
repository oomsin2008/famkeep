"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export interface ResetResult {
  ok: boolean;
  error: string | null;
  files: number;
  tasks: number;
  failed: number;
}

const GENERIC = "ล้างข้อมูลไม่สำเร็จ กรุณาลองใหม่";
const NOT_OWNER = "เฉพาะเจ้าของครอบครัวเท่านั้นที่ล้างข้อมูลได้";
const AUTH = "กรุณาเข้าสู่ระบบใหม่";

function fail(error: string): ResetResult {
  return { ok: false, error, files: 0, tasks: 0, failed: 0 };
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/locker");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/settings/reset");
}

interface AuthedContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  accessToken: string;
}

/** Resolve an authed client + access token, only for a confirmed family owner. */
async function ownerContext(): Promise<AuthedContext | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return { error: AUTH };

  const { data: isOwner, error } = await supabase.rpc("is_family_owner");
  if (error) return { error: GENERIC };
  if (isOwner !== true) return { error: NOT_OWNER };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return { error: AUTH };

  return { supabase, accessToken: session.access_token };
}

/** Soft-delete every accessible file (private + family) and move each Drive
 *  original to the cleanup folder, one at a time via the file-delete Edge
 *  Function. */
async function wipeFiles(
  ctx: AuthedContext,
): Promise<{ deleted: number; failed: number }> {
  const config = getSupabaseConfig();
  if (!config) return { deleted: 0, failed: 0 };

  const { data: rows } = await ctx.supabase
    .from("files")
    .select("id")
    .is("deleted_at", null);
  const ids = ((rows as { id: string }[] | null) ?? []).map((r) => r.id);
  if (ids.length === 0) return { deleted: 0, failed: 0 };

  const base = config.supabaseUrl.replace(/\/+$/, "");
  let deleted = 0;
  let failed = 0;
  for (const id of ids) {
    const res = await fetch(`${base}/functions/v1/file-delete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        apikey: config.supabasePublishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
      cache: "no-store",
    }).catch(() => null);
    if (res?.ok) deleted += 1;
    else failed += 1;
  }
  return { deleted, failed };
}

async function wipeTasks(ctx: AuthedContext): Promise<number> {
  const { data, error } = await ctx.supabase.rpc("owner_wipe_tasks");
  if (error) throw new Error(error.message);
  const n = typeof data === "number" ? data : 0;
  return n < 0 ? 0 : n;
}

export async function wipeFilesAction(): Promise<ResetResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return fail(ctx.error);

  const { deleted, failed } = await wipeFiles(ctx);
  revalidateAll();
  return {
    ok: failed === 0,
    error: failed > 0 ? "บางไฟล์ล้างไม่สำเร็จ กรุณาลองอีกครั้ง" : null,
    files: deleted,
    tasks: 0,
    failed,
  };
}

export async function wipeTasksAction(): Promise<ResetResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return fail(ctx.error);

  try {
    const tasks = await wipeTasks(ctx);
    revalidateAll();
    return { ok: true, error: null, files: 0, tasks, failed: 0 };
  } catch {
    return fail(GENERIC);
  }
}

export async function resetAllAction(): Promise<ResetResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return fail(ctx.error);

  let tasks = 0;
  try {
    tasks = await wipeTasks(ctx);
  } catch {
    return fail(GENERIC);
  }
  const { deleted, failed } = await wipeFiles(ctx);
  revalidateAll();
  return {
    ok: failed === 0,
    error: failed > 0 ? "บางไฟล์ล้างไม่สำเร็จ กรุณาลองอีกครั้ง" : null,
    files: deleted,
    tasks,
    failed,
  };
}
