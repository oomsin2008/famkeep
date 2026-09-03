import type { NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Same-origin proxy for a Locker file. Reads the Supabase session from cookies,
 * calls the file-download Edge Function with the user's access token, and
 * streams the bytes back. Usable in <img>/<iframe>/<a> without exposing any
 * token or Drive id to client JS.
 *
 *   GET /api/files/<id>/content?disposition=inline|attachment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const config = getSupabaseConfig();
  if (!config) {
    return new Response("not configured", { status: 503 });
  }

  const { id } = await params;
  const disposition =
    request.nextUrl.searchParams.get("disposition") === "attachment"
      ? "attachment"
      : "inline";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) {
    return new Response("unauthorized", { status: 401 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return new Response("unauthorized", { status: 401 });
  }

  const base = config.supabaseUrl.replace(/\/+$/, "");
  const fnUrl = new URL(`${base}/functions/v1/file-download`);
  fnUrl.searchParams.set("id", id);
  fnUrl.searchParams.set("disposition", disposition);

  const upstream = await fetch(fnUrl, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: config.supabasePublishableKey,
    },
    cache: "no-store",
  }).catch(() => null);

  if (!upstream) {
    return new Response("upstream unavailable", { status: 502 });
  }

  if (!upstream.ok) {
    const stage = upstream.headers.get("x-fk-stage") ?? "unknown";
    const message = stage === "no_drive_ref"
      ? "ไฟล์นี้ยังไม่มีข้อมูล Drive กรุณาอัปโหลดใหม่"
      : upstream.status === 401
      ? "กรุณาเข้าสู่ระบบใหม่"
      : upstream.status === 404
      ? "ไม่พบไฟล์ หรือคุณไม่มีสิทธิ์เข้าถึง"
      : upstream.status === 503
      ? "ระบบจัดเก็บไฟล์ยังไม่พร้อมใช้งาน"
      : "เปิดไฟล์ไม่สำเร็จ";
    return new Response(`${message} (${stage})`, {
      status: upstream.status,
      headers: { "X-FK-Stage": stage },
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition":
        upstream.headers.get("content-disposition") ?? disposition,
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
