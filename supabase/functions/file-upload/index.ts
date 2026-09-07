// Web/PWA image upload. verify_jwt = false because this function validates the
// bearer token itself, resolves the target workspace server-side, uploads to
// Google Drive with backend-only secrets, then persists metadata. The browser
// sends the user-confirmed filename in the multipart form.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  DriveError,
  driveConfigured,
  mimeToKind,
  safeFilename,
  uploadToDrive,
} from "../_shared/drive.ts";

// Web uploads pass through a Next.js route handler, which the host caps near
// 4.5 MB. Keep the web limit under that; LINE ingestion still uses the larger
// shared MAX_UPLOAD_BYTES.
const WEB_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

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

type WorkspaceChoice = "private" | "family";

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

// service_role has no direct SELECT on public tables here, so workspace
// resolution goes through a SECURITY DEFINER RPC.
async function resolveWorkspace(
  profileId: string,
  choice: WorkspaceChoice,
): Promise<string | null> {
  const { data, error } = await admin.rpc("web_upload_workspace_id", {
    p_actor_profile_id: profileId,
    p_choice: choice,
  });
  if (error) {
    console.error("resolveWorkspace error", error.message);
    return null;
  }
  return (data as string | null) ?? null;
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

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    console.error("file-upload formData failed", (err as Error).message);
    return reply(400, "bad_form");
  }

  const file = form.get("file");
  const workspaceRaw = form.get("workspace");
  const nameRaw = form.get("name");
  const workspace: WorkspaceChoice =
    workspaceRaw === "family" ? "family" : "private";

  if (!(file instanceof File)) return reply(400, "no_file");
  if (!file.type.toLowerCase().startsWith("image/")) {
    return reply(400, "not_image");
  }
  if (file.size > WEB_UPLOAD_MAX_BYTES) return reply(413, "too_big");

  const workspaceId = await resolveWorkspace(profileId, workspace);
  if (!workspaceId) return reply(404, "workspace_not_found");

  const finalName = safeFilename(
    typeof nameRaw === "string" ? nameRaw : file.name,
    file.type,
  );
  const bytes = new Uint8Array(await file.arrayBuffer());

  let driveId: string;
  try {
    const uploaded = await uploadToDrive(bytes, finalName, file.type);
    driveId = uploaded.id;
  } catch (err) {
    if (err instanceof DriveError && err.code === "invalid_grant") {
      return reply(503, "drive_reauth");
    }
    if (err instanceof DriveError && err.code === "not_configured") {
      return reply(503, "drive_not_configured");
    }
    console.error("file-upload drive error", (err as Error).message);
    return reply(500, "drive_upload_failed");
  }

  const { data: created, error: rpcErr } = await admin.rpc(
    "create_file_from_web_upload",
    {
      p_workspace_id: workspaceId,
      p_actor_profile_id: profileId,
      p_name: finalName,
      p_kind: mimeToKind(file.type, "image"),
      p_size_bytes: bytes.length,
      p_drive_file_id: driveId,
    },
  );
  if (rpcErr) {
    console.error("create_file_from_web_upload error", rpcErr.message);
    return reply(500, "metadata_failed");
  }

  const row = (Array.isArray(created) ? created[0] : created) as
    | { file_id?: string | null; blocked_reason?: string | null }
    | undefined;
  if (row?.blocked_reason) return reply(403, row.blocked_reason);

  return reply(200, "ok", { id: row?.file_id ?? null, name: finalName });
});
