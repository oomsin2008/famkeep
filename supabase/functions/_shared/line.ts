// LINE Messaging API helpers (Deno / Edge Functions).
// Docs verified 2026-09: developers.line.biz/en/reference/messaging-api
//  - signature: header `x-line-signature`, HMAC-SHA256(channelSecret, rawBody), base64
//  - reply:  POST https://api.line.me/v2/bot/message/reply  { replyToken, messages }
//  - push:   POST https://api.line.me/v2/bot/message/push   { to, messages }
//  - group:  GET  https://api.line.me/v2/bot/group/{groupId}/summary

const LINE_API = "https://api.line.me/v2/bot";
const LINE_DATA_API = "https://api-data.line.me/v2/bot";

/** Constant-time-ish comparison of two base64 strings. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verify the `x-line-signature` header against the RAW request body. */
export async function verifyLineSignature(
  rawBody: string,
  signature: string | null,
  channelSecret: string,
): Promise<boolean> {
  if (!signature || !channelSecret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return safeEqual(expected, signature);
}

export interface LineTextMessage {
  type: "text";
  text: string;
}

export function textMessage(text: string): LineTextMessage {
  // LINE hard limit is 5000 chars per text message.
  return { type: "text", text: text.slice(0, 4900) };
}

async function lineFetch(
  path: string,
  accessToken: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch(`${LINE_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

/** Reply to a webhook event. The reply token is single-use and short-lived. */
export function replyMessage(
  accessToken: string,
  replyToken: string,
  messages: LineTextMessage[],
) {
  return lineFetch("/message/reply", accessToken, {
    method: "POST",
    body: JSON.stringify({ replyToken, messages }),
  });
}

/** Push a message to a user or group id. */
export function pushMessage(
  accessToken: string,
  to: string,
  messages: LineTextMessage[],
) {
  return lineFetch("/message/push", accessToken, {
    method: "POST",
    body: JSON.stringify({ to, messages }),
  });
}

export interface LineContent {
  bytes: Uint8Array;
  mime: string;
}

/**
 * Download the binary content of an image/file/video/audio message.
 * Returns null when LINE no longer has the content (404/410) — content is
 * retained only for a limited, undocumented period after the message.
 */
export async function fetchLineContent(
  accessToken: string,
  messageId: string,
): Promise<LineContent | null> {
  const res = await fetch(
    `${LINE_DATA_API}/message/${encodeURIComponent(messageId)}/content`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`line_content ${res.status}`);
  const mime = (res.headers.get("content-type") ?? "application/octet-stream")
    .split(";")[0]
    .trim() || "application/octet-stream";
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { bytes, mime };
}

/** Best-effort group name; returns null on any failure. */
export async function getGroupName(
  accessToken: string,
  groupId: string,
): Promise<string | null> {
  try {
    const res = await lineFetch(`/group/${groupId}/summary`, accessToken, {
      method: "GET",
    });
    if (!res.ok) return null;
    const json = JSON.parse(res.body) as { groupName?: string };
    return json.groupName ?? null;
  } catch {
    return null;
  }
}

// ---- webhook payload types (only the fields this backend uses) --------------

export interface LineSource {
  type: "user" | "group" | "room";
  userId?: string;
  groupId?: string;
  roomId?: string;
}

export interface LineWebhookEvent {
  type: string;
  mode?: "active" | "standby";
  webhookEventId?: string;
  deliveryContext?: { isRedelivery?: boolean };
  timestamp?: number;
  replyToken?: string;
  source?: LineSource;
  message?: {
    type: string;
    id?: string;
    text?: string;
    fileName?: string;
    fileSize?: number;
    quotedMessageId?: string;
    contentProvider?: { type: "line" | "external"; originalContentUrl?: string };
  };
}

export interface LineWebhookBody {
  destination?: string;
  events?: LineWebhookEvent[];
}
