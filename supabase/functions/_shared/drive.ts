// Google Drive upload for LINE-ingested content. Backend only: uses an OAuth
// refresh token for a dedicated Google account (scope drive.file), stored as
// Edge Function secrets. Nothing here is ever exposed to the browser.
//
// Secrets (all set via `supabase secrets set`):
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   GOOGLE_REFRESH_TOKEN
//   GOOGLE_DRIVE_FOLDER_ID           (optional — active-uploads folder)
//   GOOGLE_DRIVE_DELETED_FOLDER_ID   (optional — where deleted files are moved)

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id";

/** Multipart uploadType caps at 5 MB of raw content; keep a margin. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export class DriveError extends Error {
  constructor(
    message: string,
    readonly code: "not_configured" | "invalid_grant" | "upload_failed",
  ) {
    super(message);
    this.name = "DriveError";
  }
}

export function driveConfigured(): boolean {
  return Boolean(
    Deno.env.get("GOOGLE_CLIENT_ID") &&
      Deno.env.get("GOOGLE_CLIENT_SECRET") &&
      Deno.env.get("GOOGLE_REFRESH_TOKEN"),
  );
}

let cached: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;

  const body = new URLSearchParams({
    client_id: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
    client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
    refresh_token: Deno.env.get("GOOGLE_REFRESH_TOKEN") ?? "",
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!res.ok || !json.access_token) {
    if (json.error === "invalid_grant") {
      // dead / revoked refresh token — needs the operator to re-consent
      throw new DriveError("google refresh token rejected", "invalid_grant");
    }
    throw new DriveError(
      `google token ${res.status}: ${json.error ?? "unknown"}`,
      "upload_failed",
    );
  }

  cached = {
    token: json.access_token,
    exp: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cached.token;
}

export interface DriveFile {
  id: string;
}

/** Upload bytes to Drive; returns the Drive file id. Throws DriveError. */
export async function uploadToDrive(
  bytes: Uint8Array,
  name: string,
  mimeType: string,
): Promise<DriveFile> {
  if (!driveConfigured()) {
    throw new DriveError("google drive secrets not set", "not_configured");
  }
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new DriveError("file exceeds MAX_UPLOAD_BYTES", "upload_failed");
  }

  const token = await accessToken();
  const folderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");
  const metadata: Record<string, unknown> = { name };
  if (folderId) metadata.parents = [folderId];

  const boundary = `famkeep${crypto.randomUUID()}`;
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);

  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
  };
  if (!res.ok || !json.id) {
    throw new DriveError(
      `drive upload ${res.status}: ${json.error?.message ?? "unknown"}`,
      "upload_failed",
    );
  }
  return { id: json.id };
}

export interface DriveDownload {
  body: ReadableStream<Uint8Array> | null;
  mime: string;
  status: number;
}

/** Stream a file's bytes back from Drive. `status` is the upstream HTTP status. */
export async function downloadFromDrive(
  driveFileId: string,
): Promise<DriveDownload> {
  if (!driveConfigured()) {
    throw new DriveError("google drive secrets not set", "not_configured");
  }
  const token = await accessToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${
      encodeURIComponent(driveFileId)
    }?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    return { body: null, mime: "", status: res.status };
  }
  return {
    body: res.body,
    mime: res.headers.get("content-type") ?? "application/octet-stream",
    status: 200,
  };
}

// ---- delete: move + rename into the cleanup folder -------------------------

export interface DriveMoveResult {
  ok: boolean;
  reason?: "not_configured" | "invalid_grant" | "move_failed";
}

/**
 * Rename a Drive file and move it into `targetFolderId` (dropping its current
 * parents). Best-effort — the caller treats any failure as non-fatal. Never
 * trashes or hard-deletes; stays within the same Drive account.
 */
export async function moveAndRenameDriveFile(
  driveFileId: string,
  newName: string,
  targetFolderId: string,
): Promise<DriveMoveResult> {
  if (!driveConfigured()) return { ok: false, reason: "not_configured" };

  let token: string;
  try {
    token = await accessToken();
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof DriveError && err.code === "invalid_grant"
        ? "invalid_grant"
        : "move_failed",
    };
  }

  const id = encodeURIComponent(driveFileId);
  const auth = { Authorization: `Bearer ${token}` };

  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}?fields=parents`,
    { headers: auth },
  );
  const parents: string[] = metaRes.ok
    ? ((await metaRes.json().catch(() => ({}))).parents ?? [])
    : [];
  const removeParents = parents.filter((p) => p !== targetFolderId).join(",");

  const url = new URL(`https://www.googleapis.com/drive/v3/files/${id}`);
  url.searchParams.set("fields", "id");
  url.searchParams.set("addParents", targetFolderId);
  if (removeParents) url.searchParams.set("removeParents", removeParents);

  const res = await fetch(url, {
    method: "PATCH",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ name: newName }),
  });
  return res.ok ? { ok: true } : { ok: false, reason: "move_failed" };
}

// ---- filename / kind helpers ------------------------------------------------

export type FileKind = "pdf" | "image" | "doc" | "other";

export function mimeToKind(mime: string, msgType?: string): FileKind {
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m === "application/pdf") return "pdf";
  if (
    /(msword|wordprocessing|spreadsheet|presentation|ms-excel|ms-powerpoint|opendocument|rtf|csv|text\/plain)/i
      .test(m)
  ) {
    return "doc";
  }
  return msgType === "file" ? "other" : "other";
}

const KIND_THAI: Record<FileKind, string> = {
  image: "รูปภาพ",
  pdf: "เอกสาร",
  doc: "เอกสาร",
  other: "ไฟล์",
};

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/bmp": "bmp",
  "image/tiff": "tif",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/zip": "zip",
  "application/json": "json",
};

/** Best-effort extension from a MIME type. "bin" when unknown. */
export function mimeToExt(mime: string): string {
  return MIME_EXT[(mime || "").toLowerCase().split(";")[0].trim()] ?? "bin";
}

const MAX_NAME_LEN = 150;

function stripControlChars(input: string): string {
  let out = "";
  for (const ch of input) {
    const c = ch.codePointAt(0)!;
    if (c >= 0x20 && c !== 0x7f) out += ch;
  }
  return out;
}

/** Bangkok (UTC+7, no DST) wall-clock stamp: YYYYMMDD-HHmmss. */
function bangkokStamp(tsMs?: number): string {
  const d = new Date((tsMs ?? Date.now()) + 7 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

/**
 * Light sanitize that preserves the whole name (extension, spaces, Thai):
 * drop any path, strip control + Windows-hostile characters, cap length.
 */
export function sanitizeName(name: string): string {
  const seg = stripControlChars(name ?? "").split(/[\\/]/).pop()?.trim() ?? "";
  const cleaned = seg.replace(/[<>:"|?*]+/g, "_").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 180) || "file";
}

/**
 * Name for a deleted file's Drive original:
 *   DELETED-YYYYMMDD-HHmmss-<original>   (Asia/Bangkok)
 * e.g. DELETED-20260903-145500-test print.pdf
 */
export function deletedName(originalName: string, tsMs?: number): string {
  return `DELETED-${bangkokStamp(tsMs)}-${sanitizeName(originalName)}`;
}

/**
 * Name for a file LINE gave us no filename for:
 *   <Thai kind>-YYYYMMDD-HHmmss.<ext>   (Asia/Bangkok)
 * e.g. รูปภาพ-20260903-144135.jpg / เอกสาร-20260903-144135.pdf / ไฟล์-20260903-144135.bin
 */
export function synthName(mime: string, tsMs?: number): string {
  return `${KIND_THAI[mimeToKind(mime)]}-${bangkokStamp(tsMs)}.${
    mimeToExt(mime)
  }`;
}

/**
 * Sanitize a LINE-provided filename: drop any path, strip hostile characters,
 * collapse whitespace, cap length (keeping the extension), and fall back to a
 * MIME-derived extension when the name has none. Empty/degenerate -> synthName.
 */
export function safeFilename(
  rawName: string | undefined | null,
  mime: string,
  tsMs?: number,
): string {
  const raw = stripControlChars(rawName ?? "").trim();
  const segment = raw.split(/[\\/]/).pop()?.trim() ?? "";
  const cleaned = segment
    .replace(/[<>:"|?*]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned === "." || cleaned === "..") {
    return synthName(mime, tsMs);
  }

  const dot = cleaned.lastIndexOf(".");
  const hasExt = dot > 0 &&
    dot < cleaned.length - 1 &&
    /^[A-Za-z0-9]{1,10}$/.test(cleaned.slice(dot + 1));
  let stem = hasExt ? cleaned.slice(0, dot) : cleaned;
  const ext = hasExt ? cleaned.slice(dot + 1).toLowerCase() : mimeToExt(mime);

  const room = MAX_NAME_LEN - (ext.length + 1);
  if (stem.length > room) stem = stem.slice(0, room).trim();
  if (!stem) stem = KIND_THAI[mimeToKind(mime)];

  return `${stem}.${ext}`;
}
