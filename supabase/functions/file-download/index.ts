// Secure file proxy. verify_jwt = false: this function authenticates the caller
// itself (admin.auth.getUser) — the gateway's verify_jwt was not carrying
// auth.uid() into RLS.
//
// In this project service_role has NO table-level DML on public tables; every
// backend path goes through a SECURITY DEFINER RPC. So:
//   1. bearer token -> admin.auth.getUser(token) -> the user, or 401.
//   2. admin.rpc("get_file_download_ref", { file, actor }) -> authorizes and
//      returns { drive_file_id, name } or a blocked_reason.
//   3. stream the bytes from Google Drive with this function's own credentials.
// drive_file_id and the Google tokens never leave the server.
//
// Every non-200 carries an `X-FK-Stage` header (safe stage name, no secrets).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { downloadFromDrive, DriveError } from "../_shared/drive.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function fail(status: number, stage: string, body = stage) {
  console.log(`file-download stage=${stage} status=${status}`);
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-FK-Stage": stage,
    },
  });
}

function asciiName(name: string): string {
  return name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "file";
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return fail(405, "bad_method");

  const token = (req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return fail(401, "no_token");

  const url = new URL(req.url);
  const fileId = url.searchParams.get("id");
  const disposition = url.searchParams.get("disposition") === "attachment"
    ? "attachment"
    : "inline";
  if (!fileId) return fail(400, "no_id");

  // 1. authenticate the caller
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return fail(401, "session_invalid");

  // 2. authorize + fetch the Drive ref (one SECURITY DEFINER RPC)
  const { data: res, error: refErr } = await admin.rpc("get_file_download_ref", {
    p_file_id: fileId,
    p_actor_profile_id: userData.user.id,
  });
  if (refErr) {
    console.log("get_file_download_ref error", refErr.message);
    return fail(500, "access_check_error");
  }
  const row = (Array.isArray(res) ? res[0] : res) as
    | { drive_file_id?: string | null; name?: string | null; blocked_reason?: string | null }
    | undefined;

  const reason = row?.blocked_reason ?? (row ? null : "file_not_found");
  if (reason === "no_drive_ref") {
    // accessible row with no Drive object — legacy / pre-Drive-integration
    return fail(404, "no_drive_ref");
  }
  if (reason) {
    // actor_unknown / file_not_found / no_access — don't distinguish
    return fail(404, "no_access");
  }
  if (!row?.drive_file_id) return fail(404, "no_drive_ref");

  // 3. stream from Drive
  let dl;
  try {
    dl = await downloadFromDrive(row.drive_file_id);
  } catch (err) {
    if (err instanceof DriveError && err.code === "not_configured") {
      return fail(503, "drive_not_configured", "file storage not configured");
    }
    if (err instanceof DriveError && err.code === "invalid_grant") {
      return fail(503, "drive_reauth", "file storage needs re-auth");
    }
    console.log("drive download error", (err as Error).message);
    return fail(502, "drive_fetch_failed", "download failed");
  }
  if (!dl.body) {
    return fail(dl.status === 404 ? 404 : 502, "drive_no_body");
  }

  const name = row.name ?? "file";
  return new Response(dl.body, {
    status: 200,
    headers: {
      "Content-Type": dl.mime,
      "Content-Disposition":
        `${disposition}; filename="${asciiName(name)}"; filename*=UTF-8''${
          encodeURIComponent(name)
        }`,
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
      "X-FK-Stage": "ok",
    },
  });
});
