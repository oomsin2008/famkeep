// Web/PWA file rename. verify_jwt = false because this function validates the
// bearer token itself, then renames both Google Drive and FamKeep metadata.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  driveConfigured,
  renameDriveFile,
  renamePreservingExtension,
} from "../_shared/drive.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function reply(status: number, stage: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ stage, ...extra }), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "X-FK-Stage": stage,
    },
  });
}

function tokenFrom(req: Request): string {
  return (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return reply(405, "bad_method");
  if (!driveConfigured()) return reply(503, "drive_not_configured");

  const token = tokenFrom(req);
  if (!token) return reply(401, "no_token");

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return reply(401, "session_invalid");
  const profileId = userData.user.id;

  let body: { id?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply(400, "bad_json");
  }

  if (typeof body.id !== "string" || typeof body.name !== "string") {
    return reply(400, "bad_payload");
  }

  const { data: prepared, error: prepareErr } = await admin.rpc(
    "prepare_file_rename",
    {
      p_actor_profile_id: profileId,
      p_file_id: body.id,
    },
  );
  if (prepareErr) {
    console.error("prepare_file_rename error", prepareErr.message);
    return reply(500, "metadata_failed");
  }

  const row = (Array.isArray(prepared) ? prepared[0] : prepared) as
    | {
      file_id?: string | null;
      name?: string | null;
      drive_file_id?: string | null;
      blocked_reason?: string | null;
    }
    | undefined;
  if (row?.blocked_reason) return reply(403, row.blocked_reason);
  if (!row?.file_id || !row.drive_file_id || !row.name) {
    return reply(404, "not_found");
  }

  const finalName = renamePreservingExtension(body.name, row.name);
  const renamed = await renameDriveFile(row.drive_file_id, finalName);
  if (!renamed.ok) {
    if (renamed.reason === "invalid_grant") return reply(503, "drive_reauth");
    if (renamed.reason === "not_configured") return reply(503, "drive_not_configured");
    return reply(500, "drive_rename_failed");
  }

  const { data: updated, error: updateErr } = await admin.rpc(
    "rename_file_metadata_from_web",
    {
      p_actor_profile_id: profileId,
      p_file_id: row.file_id,
      p_new_name: finalName,
    },
  );
  if (updateErr) {
    console.error("rename_file_metadata_from_web error", updateErr.message);
    await renameDriveFile(row.drive_file_id, row.name);
    return reply(500, "metadata_failed");
  }

  const updatedRow = (Array.isArray(updated) ? updated[0] : updated) as
    | { file_id?: string | null; blocked_reason?: string | null }
    | undefined;
  if (updatedRow?.blocked_reason) {
    await renameDriveFile(row.drive_file_id, row.name);
    return reply(403, updatedRow.blocked_reason);
  }

  return reply(200, "ok", { id: row.file_id, name: finalName });
});
