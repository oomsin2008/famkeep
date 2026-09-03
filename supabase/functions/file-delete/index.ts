// Locker file delete. verify_jwt = false — this function authenticates the
// caller itself (admin.auth.getUser) and authorizes via soft_delete_file
// (SECURITY DEFINER, service_role only).
//
// Flow:
//   1. bearer token -> admin.auth.getUser -> the user, or 401.
//   2. admin.rpc("soft_delete_file", { actor, file }) -> sets files.deleted_at
//      (the app's source of truth) and returns the Drive ref, or a
//      blocked_reason (outsider / not found).
//   3. best-effort: move + rename the Drive original into the cleanup folder.
//      Any Drive failure is non-fatal — the soft delete already stands.
//
// Response body is JSON { stage, drive } — safe strings only. drive_file_id and
// Google tokens never leave the server.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { deletedName, moveAndRenameDriveFile } from "../_shared/drive.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function reply(status: number, stage: string, extra: Record<string, unknown> = {}) {
  console.log(`file-delete stage=${stage} status=${status}`);
  return new Response(JSON.stringify({ stage, ...extra }), {
    status,
    headers: { "Content-Type": "application/json", "X-FK-Stage": stage },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply(405, "bad_method");

  const token = (req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return reply(401, "no_token");

  let fileId: string | null = null;
  try {
    const body = await req.json();
    if (body && typeof body.id === "string") fileId = body.id;
  } catch { /* fall through */ }
  if (!fileId) return reply(400, "no_id");

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return reply(401, "session_invalid");
  const uid = userData.user.id;

  const { data: res, error: rpcErr } = await admin.rpc("soft_delete_file", {
    p_actor_profile_id: uid,
    p_file_id: fileId,
  });
  if (rpcErr) {
    console.log("soft_delete_file error", rpcErr.message);
    return reply(500, "soft_delete_error");
  }
  const row = (Array.isArray(res) ? res[0] : res) as
    | { drive_file_id?: string | null; name?: string | null; blocked_reason?: string | null }
    | undefined;

  const reason = row?.blocked_reason ?? null;
  if (reason && reason !== "already_deleted") {
    // outsider / not found — don't distinguish
    return reply(404, "not_deleted", { reason: "no_access" });
  }

  // soft delete is done (source of truth). Drive move is best-effort.
  let drive = "skipped";
  const deletedFolder = Deno.env.get("GOOGLE_DRIVE_DELETED_FOLDER_ID") || "";
  if (!deletedFolder) {
    console.log("file-delete drive_deleted_folder_not_configured");
    drive = "drive_deleted_folder_not_configured";
  } else if (!row?.drive_file_id) {
    drive = "no_drive_ref";
  } else {
    const mv = await moveAndRenameDriveFile(
      row.drive_file_id,
      deletedName(row.name ?? "file"),
      deletedFolder,
    );
    if (mv.ok) {
      drive = "moved";
    } else {
      drive = mv.reason === "invalid_grant" ? "drive_reauth" : "drive_move_failed";
      console.log(`file-delete drive move failed reason=${mv.reason}`);
    }
  }

  return reply(200, "ok", { drive });
});
