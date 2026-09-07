import type { NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Vercel caps a route handler request body near 4.5 MB; stay under it. */
const WEB_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

/**
 * Same-origin proxy for a web image upload. Reads the Supabase session from
 * cookies, forwards the multipart body verbatim to the file-upload Edge Function
 * with the user's access token, and relays the JSON response. Browsers cannot
 * POST the multipart body straight to the Edge Function gateway, so the upload
 * goes server-side, matching /api/files/[id]/content.
 *
 * The body is forwarded as a raw ArrayBuffer (original Content-Type + boundary,
 * fixed Content-Length) rather than a re-serialized FormData, which the gateway
 * rejects.
 *
 *   POST /api/files/upload   (multipart: file, name, workspace)
 */
export async function POST(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config) {
    return Response.json({ stage: "not_configured" }, { status: 503 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return Response.json({ stage: "bad_form" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) {
    return Response.json({ stage: "session_invalid" }, { status: 401 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return Response.json({ stage: "session_invalid" }, { status: 401 });
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > WEB_UPLOAD_MAX_BYTES) {
    return Response.json({ stage: "too_big" }, { status: 413 });
  }

  const base = config.supabaseUrl.replace(/\/+$/, "");
  const upstream = await fetch(`${base}/functions/v1/file-upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: config.supabasePublishableKey,
      "Content-Type": contentType,
    },
    body,
    cache: "no-store",
  }).catch((err) => {
    console.error("file-upload proxy fetch failed", err);
    return null;
  });

  if (!upstream) {
    return Response.json({ stage: "upstream_unavailable" }, { status: 502 });
  }

  const data = await upstream.json().catch(() => ({ stage: "bad_response" }));
  const stage = upstream.headers.get("x-fk-stage");
  return Response.json(data, {
    status: upstream.status,
    headers: stage ? { "X-FK-Stage": stage } : undefined,
  });
}
