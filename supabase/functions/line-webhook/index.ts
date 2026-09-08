// LINE Messaging API webhook. verify_jwt = false (LINE authenticates via its
// own x-line-signature header).
//
//  - #งาน  -> create a task (handled inline; reply tokens are single-use and
//             expire in seconds)
//  - image / file in 1:1  -> auto-save to the sender's private locker
//  - file in an approved family group -> auto-save to the family locker
//  - image in an approved family group -> recorded as pending; saved only when a
//    linked member replies #เก็บ / เก็บรูปนี้ (optionally quoting the image)
//
// Media ingestion (LINE content download + Google Drive upload) runs in a
// background task so the webhook returns 200 immediately; the confirmation
// still uses the message's reply token.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  fetchLineContent,
  getGroupName,
  type LineMessage,
  type LineWebhookBody,
  type LineWebhookEvent,
  replyMessage,
  textMessage,
  verifyLineSignature,
} from "../_shared/line.ts";
import {
  duplicateFileFlex,
  renamedFileFlex,
  savedFileFlex,
  taskCreatedFlex,
} from "../_shared/line-flex.ts";
import {
  classifyAssignee,
  defaultDueIso,
  parseNganCommand,
  parseThaiDue,
} from "../_shared/parse-ngan.ts";
import {
  DriveError,
  driveConfigured,
  MAX_UPLOAD_BYTES,
  mimeToKind,
  renameDriveFile,
  renamePreservingExtension,
  safeFilename,
  synthName,
  uploadToDrive,
} from "../_shared/drive.ts";

const CHANNEL_SECRET = Deno.env.get("LINE_CHANNEL_SECRET") ?? "";
const ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Optional: KitiButler web origin, e.g. https://kitibutler.vercel.app. When set, a
// save reply includes a login-gated deep link to the file. Never a Drive URL.
const APP_PUBLIC_URL = (Deno.env.get("APP_PUBLIC_URL") ?? "").replace(/\/+$/, "");

function fileLink(fileId: string | null | undefined): string | null {
  if (!APP_PUBLIC_URL || !fileId) return null;
  return `${APP_PUBLIC_URL}/locker/files/${fileId}`;
}

function taskLink(taskId: string | null | undefined): string | null {
  if (!APP_PUBLIC_URL || !taskId) return null;
  return `${APP_PUBLIC_URL}/tasks/${taskId}`;
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const HINT_USAGE =
  "วิธีสร้างงาน:\n#งาน ชื่องาน\nกำหนด: 15/09/2026 18:00 (ไม่บังคับ)\nผู้รับผิดชอบ: ชื่อสมาชิก หรือ ฉัน (เฉพาะครอบครัว)";
const HINT_NOT_LINKED =
  "ยังไม่ได้เชื่อมบัญชี KitiButler — เปิดแอป KitiButler แล้วเข้าสู่ระบบด้วย LINE ก่อน จากนั้นส่งอีกครั้ง";
const HINT_GROUP_PENDING =
  "กลุ่มนี้ยังไม่ได้เปิดใช้งาน ให้เจ้าของครอบครัวอนุมัติที่ KitiButler › ตั้งค่า › การเชื่อมต่อ LINE";
const MSG_DRIVE_UNAVAILABLE =
  "ยังบันทึกไฟล์ไม่ได้ในตอนนี้ ลองส่งไฟล์นั้นอีกครั้งในภายหลัง";
const MSG_DRIVE_REAUTH =
  "การเชื่อมต่อ Google Drive หมดอายุ รบกวนแจ้งเจ้าของครอบครัวให้เชื่อมต่อใหม่";
const MSG_SAVE_FAILED = "บันทึกไฟล์ไม่สำเร็จ รบกวนส่งไฟล์นั้นอีกครั้ง";
const MSG_TOO_BIG = "ไฟล์นี้ใหญ่เกินไป — ส่งผ่าน LINE ได้ไม่เกิน 5 MB";
const MSG_CONTENT_GONE =
  "ดึงไฟล์จาก LINE ไม่ทัน (ไฟล์อาจหมดอายุ) รบกวนส่งอีกครั้ง";
const KEEP_HINT =
  "ได้รับรูปแล้ว ถ้าต้องการเก็บเข้าคลังครอบครัว ให้ตอบกลับรูปนั้นว่า  #เก็บ";

const KEEP_EXACT = new Set(["#เก็บ", "เก็บรูปนี้"]);
const RENAME_PREFIXES = ["#ชื่อไฟล์", "#เปลี่ยนชื่อ"];
const PENDING_IMAGE_TTL_MS = 24 * 60 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function runBackground(p: Promise<unknown>) {
  const g = globalThis as {
    EdgeRuntime?: { waitUntil(p: Promise<unknown>): void };
  };
  const guarded = p.catch((err) =>
    console.error("background task failed", (err as Error).message)
  );
  if (g.EdgeRuntime?.waitUntil) g.EdgeRuntime.waitUntil(guarded);
  else void guarded;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");
  const valid = await verifyLineSignature(rawBody, signature, CHANNEL_SECRET);
  if (!valid) return json({ error: "invalid signature" }, 401);

  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "bad json" }, 400);
  }

  for (const event of body.events ?? []) {
    try {
      await handleEvent(event);
    } catch (err) {
      console.error("event handling failed", (err as Error).message);
    }
  }

  return json({ ok: true });
});

async function markProcessed(eventId: string, status: "done" | "error") {
  await admin.rpc("mark_webhook_event_processed", {
    p_event_id: eventId,
    p_status: status,
  });
}

function toMessage(msg: string | LineMessage): LineMessage {
  return typeof msg === "string" ? textMessage(msg) : msg;
}

function replyWith(
  event: LineWebhookEvent,
  msg: string | LineMessage,
): Promise<unknown> {
  return event.replyToken
    ? replyMessage(ACCESS_TOKEN, event.replyToken, [toMessage(msg)])
    : Promise.resolve();
}

/** Reply without letting a dead/expired reply token break the caller. */
async function tryReply(
  event: LineWebhookEvent,
  msg: string | LineMessage,
): Promise<void> {
  try {
    await replyWith(event, msg);
  } catch (err) {
    console.error("reply failed (token expired?)", (err as Error).message);
  }
}

async function handleEvent(event: LineWebhookEvent): Promise<void> {
  if (event.mode && event.mode !== "active") return;
  const eventId = event.webhookEventId;
  if (!eventId) return;

  const source = event.source;
  const { data: isNew } = await admin.rpc("record_webhook_event", {
    p_event_id: eventId,
    p_source_type: source?.type ?? null,
    p_source_id: source?.groupId ?? source?.userId ?? null,
    p_event_type: event.type,
    p_payload: safePayload(event),
  });
  if (isNew !== true) return; // duplicate delivery

  const m = event.message;
  try {
    if (event.type === "join" && source?.type === "group" && source.groupId) {
      const name = await getGroupName(ACCESS_TOKEN, source.groupId);
      await admin.rpc("upsert_pending_line_group", {
        p_group_id: source.groupId,
        p_label: name,
      });
      await replyWith(
        event,
        "เพิ่ม KitiButler เข้ากลุ่มแล้ว ให้เจ้าของครอบครัวอนุมัติกลุ่มนี้ที่ KitiButler › ตั้งค่า › การเชื่อมต่อ LINE",
      );
    } else if (event.type === "message" && m) {
      if (m.type === "text" && typeof m.text === "string") {
        const t = m.text.trim();
        if (KEEP_EXACT.has(t) || t.startsWith("#เก็บ")) {
          runBackground(handleKeepImage(event, eventId));
          return;
        }
        const renameName = parseRenameCommand(t);
        if (renameName !== null) {
          runBackground(handleRenameRecentFile(event, eventId, renameName));
          return;
        }
        await handleTextMessage(event, m.text);
      } else if (m.type === "image" || m.type === "file") {
        runBackground(handleMediaIngest(event, eventId));
        return;
      } else if (
        (m.type === "video" || m.type === "audio") &&
        source?.type === "user"
      ) {
        await replyWith(
          event,
          "ยังไม่รองรับไฟล์ประเภทนี้ ตอนนี้เก็บได้เฉพาะรูปภาพและเอกสาร",
        );
      }
    }
    await markProcessed(eventId, "done");
  } catch (err) {
    console.error("processing error", (err as Error).message);
    await markProcessed(eventId, "error");
  }
}

function parseRenameCommand(text: string): string | null {
  for (const prefix of RENAME_PREFIXES) {
    if (text === prefix) return "";
    if (text.startsWith(`${prefix} `)) return text.slice(prefix.length).trim();
  }
  return null;
}

async function handleRenameRecentFile(
  event: LineWebhookEvent,
  eventId: string,
  rawName: string,
): Promise<void> {
  let status: "done" | "error" = "done";
  let replyMsg: string | LineMessage = "";

  try {
    if (!rawName.trim()) {
      replyMsg = "พิมพ์แบบนี้:  #ชื่อไฟล์ ชื่อใหม่ของไฟล์";
    } else {
      const source = event.source;
      const lineUserId = source?.userId ?? null;
      if (!lineUserId) {
        replyMsg = "ไม่ทราบว่าใครส่ง รบกวนเพิ่ม KitiButler เป็นเพื่อนใน LINE ก่อน";
      } else {
        const { data: reg } = await admin.rpc("register_line_user_conversation", {
          p_line_user_id: lineUserId,
        });
        const profileId = firstRow(reg)?.profile_id ?? null;
        if (!profileId) {
          replyMsg = HINT_NOT_LINKED;
        } else {
          const { data: latest, error: lookupErr } = await admin.rpc(
            "latest_file_for_line_rename",
            { p_actor_profile_id: profileId },
          );
          if (lookupErr) {
            console.error("latest_file_for_line_rename error", lookupErr.message);
            replyMsg = "เปลี่ยนชื่อไฟล์ไม่สำเร็จ รบกวนลองอีกครั้ง";
            status = "error";
          } else {
            const row = firstRow(latest);
            if (!row?.file_id || !row.name || !row.drive_file_id) {
              replyMsg = "ไม่พบไฟล์ล่าสุดที่จะเปลี่ยนชื่อ ส่งไฟล์เข้ามาก่อนแล้วค่อยเปลี่ยนชื่อ";
            } else {
              const newName = renamePreservingExtension(rawName, row.name);
              const renamed = await renameDriveFile(row.drive_file_id, newName);
              if (!renamed.ok) {
                replyMsg = renamed.reason === "invalid_grant"
                  ? MSG_DRIVE_REAUTH
                  : "เปลี่ยนชื่อไฟล์ไม่สำเร็จ รบกวนลองอีกครั้ง";
                status = "error";
              } else {
                const { data: saved, error: saveErr } = await admin.rpc(
                  "rename_file_metadata_from_line",
                  {
                    p_actor_profile_id: profileId,
                    p_file_id: row.file_id,
                    p_new_name: newName,
                  },
                );
                const savedRow = firstRow(saved);
                if (saveErr || savedRow?.blocked_reason) {
                  console.error(
                    "rename_file_metadata_from_line error",
                    saveErr?.message ?? savedRow?.blocked_reason,
                  );
                  replyMsg = "เปลี่ยนชื่อไฟล์ไม่สำเร็จ รบกวนลองอีกครั้ง";
                  status = "error";
                } else {
                  replyMsg = renamedFileFlex(newName, fileLink(row.file_id));
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("rename recent file failed", (err as Error).message);
    replyMsg = "เปลี่ยนชื่อไฟล์ไม่สำเร็จ รบกวนลองอีกครั้ง";
    status = "error";
  }

  if (replyMsg) await tryReply(event, replyMsg);
  await markProcessed(eventId, status);
}

// ---- #งาน --------------------------------------------------------------------

async function handleTextMessage(
  event: LineWebhookEvent,
  text: string,
): Promise<void> {
  const parsed = parseNganCommand(text);
  const source = event.source;

  if (!parsed.ok && parsed.reason === "no_trigger") return; // not for us
  const reply = (msg: string | LineMessage) => replyWith(event, msg);

  if (!parsed.ok) {
    await reply(HINT_USAGE);
    return;
  }

  let actorProfileId: string | null = null;
  let workspaceId: string | null = null;
  let isFamily = false;

  if (source?.type === "user" && source.userId) {
    const { data: reg } = await admin.rpc("register_line_user_conversation", {
      p_line_user_id: source.userId,
    });
    const row = firstRow(reg);
    if (!row?.profile_id) {
      await reply(HINT_NOT_LINKED);
      return;
    }
    actorProfileId = row.profile_id;
    const { data: resolved } = await admin.rpc("resolve_line_user", {
      p_line_user_id: source.userId,
    });
    workspaceId = firstRow(resolved)?.private_workspace_id ?? null;
  } else if (source?.type === "group" && source.groupId) {
    if (!source.userId) {
      await reply("ไม่ทราบว่าใครส่ง รบกวนเพิ่ม KitiButler เป็นเพื่อนใน LINE ก่อน แล้วลองอีกครั้ง");
      return;
    }
    const { data: grp } = await admin.rpc("resolve_line_group", {
      p_group_id: source.groupId,
    });
    const grow = firstRow(grp);
    if (!grow || grow.approved !== true || !grow.workspace_id) {
      const name = await getGroupName(ACCESS_TOKEN, source.groupId);
      await admin.rpc("upsert_pending_line_group", {
        p_group_id: source.groupId,
        p_label: name,
      });
      await reply(HINT_GROUP_PENDING);
      return;
    }
    workspaceId = grow.workspace_id;
    isFamily = true;

    const { data: reg } = await admin.rpc("register_line_user_conversation", {
      p_line_user_id: source.userId,
    });
    const row = firstRow(reg);
    if (!row?.profile_id) {
      await reply(HINT_NOT_LINKED);
      return;
    }
    actorProfileId = row.profile_id;
  } else {
    return;
  }

  if (!workspaceId || !actorProfileId) {
    await reply(HINT_NOT_LINKED);
    return;
  }

  const due = parseThaiDue(parsed.dueRaw, new Date());
  if (due.error) {
    await reply(
      "อ่านวันที่ไม่ออก ลองแบบนี้: 15/09/2026 18:00 หรือ พรุ่งนี้ 09:00",
    );
    return;
  }
  const dueIso = due.iso ?? defaultDueIso(new Date());

  let assigneeProfileId: string | null = null;
  let assigneeName: string | null = null;
  if (isFamily) {
    const intent = classifyAssignee(parsed.assigneeRaw);
    if (intent.kind === "self") {
      assigneeProfileId = actorProfileId;
      assigneeName = "ตัวเอง";
    } else if (intent.kind === "name") {
      const { data: resolved } = await admin.rpc(
        "resolve_family_member_by_name",
        { p_workspace_id: workspaceId, p_name: intent.value },
      );
      if (!resolved) {
        await reply(`ไม่พบสมาชิกชื่อ "${intent.value}" ในครอบครัวนี้`);
        return;
      }
      assigneeProfileId = resolved as string;
      assigneeName = intent.value;
    }
  }

  const { data: created, error } = await admin.rpc("create_task_from_line", {
    p_actor_profile_id: actorProfileId,
    p_workspace_id: workspaceId,
    p_title: parsed.title,
    p_notes: "",
    p_assignee_profile_id: assigneeProfileId,
    p_due_at: dueIso,
  });
  if (error) {
    await reply("สร้างงานไม่สำเร็จ รบกวนลองอีกครั้ง");
    return;
  }
  const crow = firstRow(created);
  if (crow?.blocked_reason) {
    await reply(reasonToThai(crow.blocked_reason));
    return;
  }

  await reply(
    taskCreatedFlex({
      title: parsed.title,
      dueLabel: formatDue(dueIso),
      assigneeName,
      context: isFamily ? "family" : "private",
      link: taskLink(crow?.task_id),
    }),
  );
}

// ---- media ingestion -------------------------------------------------------

interface MediaTarget {
  workspaceId: string;
  actorProfileId: string;
  kind: "private" | "family";
  conversationId: string | null;
}

/** Resolve who/where a media message from `event` should be saved. */
async function resolveMediaTarget(
  event: LineWebhookEvent,
): Promise<{ target?: MediaTarget; reply?: string }> {
  const source = event.source;

  if (source?.type === "user" && source.userId) {
    const { data: reg } = await admin.rpc("register_line_user_conversation", {
      p_line_user_id: source.userId,
    });
    const profileId = firstRow(reg)?.profile_id ?? null;
    if (!profileId) return { reply: HINT_NOT_LINKED };
    const { data: resolved } = await admin.rpc("resolve_line_user", {
      p_line_user_id: source.userId,
    });
    const ws = firstRow(resolved)?.private_workspace_id ?? null;
    if (!ws) return { reply: HINT_NOT_LINKED };
    return {
      target: {
        workspaceId: ws,
        actorProfileId: profileId,
        kind: "private",
        conversationId: null,
      },
    };
  }

  if (source?.type === "group" && source.groupId) {
    if (!source.userId) {
      return { reply: "ไม่ทราบว่าใครส่ง รบกวนเพิ่ม KitiButler เป็นเพื่อนใน LINE ก่อน" };
    }
    const { data: grp } = await admin.rpc("resolve_line_group", {
      p_group_id: source.groupId,
    });
    const grow = firstRow(grp);
    if (!grow || grow.approved !== true || !grow.workspace_id) {
      return { reply: HINT_GROUP_PENDING };
    }
    const { data: reg } = await admin.rpc("register_line_user_conversation", {
      p_line_user_id: source.userId,
    });
    const profileId = firstRow(reg)?.profile_id ?? null;
    if (!profileId) return { reply: HINT_NOT_LINKED };
    const { data: convId } = await admin.rpc("get_line_conversation_id", {
      p_source_type: "group",
      p_source_id: source.groupId,
    });
    return {
      target: {
        workspaceId: grow.workspace_id,
        actorProfileId: profileId,
        kind: "family",
        conversationId: (convId as string | null) ?? null,
      },
    };
  }

  return {}; // room / unsupported source: ignore silently
}

async function handleMediaIngest(
  event: LineWebhookEvent,
  eventId: string,
): Promise<void> {
  const m = event.message;
  const source = event.source;
  if (!m?.id) {
    await markProcessed(eventId, "error");
    return;
  }

  let status: "done" | "error" = "done";
  let replyMsg: string | LineMessage | null = null;
  try {
    const { target, reply: blockMsg } = await resolveMediaTarget(event);
    if (!target) {
      replyMsg = blockMsg ?? null; // room/unsupported -> null -> silent
    } else if (m.type === "image" && target.kind === "family") {
      // A normal image in a family group is NOT auto-saved: record it as pending.
      if (target.conversationId) {
        await admin.rpc("create_pending_line_image", {
          p_conversation_id: target.conversationId,
          p_line_message_id: m.id,
          p_posted_by_line_user_id: source?.userId ?? "unknown",
          p_expires_at: new Date(Date.now() + PENDING_IMAGE_TTL_MS)
            .toISOString(),
        });
      }
      replyMsg = KEEP_HINT;
    } else {
      // 1:1 image/file, or group file -> auto-save
      const saved = await saveMediaToLocker(event, target, m.id, {
        preferredName: m.type === "file" ? m.fileName : undefined,
        msgType: m.type,
        tsMs: event.timestamp,
      });
      replyMsg = saved.reply ?? null;
      status = saved.ok ? "done" : "error";
    }
  } catch (err) {
    console.error("media ingest failed", (err as Error).message);
    replyMsg = MSG_SAVE_FAILED;
    status = "error";
  }

  if (replyMsg) await tryReply(event, replyMsg);
  await markProcessed(eventId, status);
}

async function handleKeepImage(
  event: LineWebhookEvent,
  eventId: string,
): Promise<void> {
  const source = event.source;
  let status: "done" | "error" = "done";
  let replyMsg: string | LineMessage | null = null;

  try {
    if (source?.type !== "group" || !source.groupId) {
      replyMsg = "คำสั่ง #เก็บ ใช้ในกลุ่มครอบครัว โดยตอบกลับที่รูปที่ต้องการเก็บ";
    } else {
      const { target, reply: blockMsg } = await resolveMediaTarget(event);
      if (!target) {
        replyMsg = blockMsg ?? null; // room/unsupported -> silent
      } else if (target.kind !== "family" || !target.conversationId) {
        replyMsg = blockMsg ?? HINT_GROUP_PENDING;
      } else {
        const quoted = event.message?.quotedMessageId ?? null;
        const { data: res } = await admin.rpc("resolve_pending_line_image", {
          p_conversation_id: target.conversationId,
          p_quoted_message_id: quoted,
        });
        const imageMsgId = firstRow(res)?.line_message_id ?? null;
        if (!imageMsgId) {
          replyMsg = "ไม่พบรูปที่จะเก็บ ส่งรูปในกลุ่มแล้วตอบกลับที่รูปนั้นว่า  #เก็บ";
        } else {
          const saved = await saveMediaToLocker(event, target, imageMsgId, {
            msgType: "image",
            tsMs: event.timestamp,
          });
          if (saved.ok) {
            await admin.rpc("mark_pending_line_resolved", {
              p_conversation_id: target.conversationId,
              p_line_message_id: imageMsgId,
            });
          }
          replyMsg = saved.reply ?? null;
          status = saved.ok ? "done" : "error";
        }
      }
    }
  } catch (err) {
    console.error("keep image failed", (err as Error).message);
    replyMsg = MSG_SAVE_FAILED;
    status = "error";
  }

  if (replyMsg) await tryReply(event, replyMsg);
  await markProcessed(eventId, status);
}

interface SaveResult {
  ok: boolean;
  reply?: string | LineMessage;
}

/** Download LINE content, upload to Drive, persist metadata. */
async function saveMediaToLocker(
  _event: LineWebhookEvent,
  target: MediaTarget,
  lineMessageId: string,
  opts: { preferredName?: string; msgType: string; tsMs?: number },
): Promise<SaveResult> {
  // pre-check: never touch Drive for an already-saved message
  const { data: existing } = await admin.rpc("file_exists_for_line_message", {
    p_line_message_id: lineMessageId,
  });
  if (existing) {
    return {
      ok: true,
      reply: duplicateFileFlex(fileLink(existing as string)),
    };
  }

  if (!driveConfigured()) {
    return { ok: false, reply: MSG_DRIVE_UNAVAILABLE };
  }

  const content = await fetchLineContent(ACCESS_TOKEN, lineMessageId);
  if (!content) return { ok: false, reply: MSG_CONTENT_GONE };
  if (content.bytes.length > MAX_UPLOAD_BYTES) {
    return { ok: false, reply: MSG_TOO_BIG };
  }

  const name = opts.preferredName
    ? safeFilename(opts.preferredName, content.mime, opts.tsMs)
    : synthName(content.mime, opts.tsMs);
  const kind = mimeToKind(content.mime, opts.msgType);

  let driveId: string;
  try {
    const uploaded = await uploadToDrive(content.bytes, name, content.mime);
    driveId = uploaded.id;
  } catch (err) {
    if (err instanceof DriveError && err.code === "invalid_grant") {
      console.error("drive invalid_grant: refresh token needs re-consent");
      return { ok: false, reply: MSG_DRIVE_REAUTH };
    }
    if (err instanceof DriveError && err.code === "not_configured") {
      return { ok: false, reply: MSG_DRIVE_UNAVAILABLE };
    }
    console.error("drive upload error", (err as Error).message);
    return { ok: false, reply: MSG_SAVE_FAILED };
  }

  const { data: created, error } = await admin.rpc("create_file_from_line", {
    p_workspace_id: target.workspaceId,
    p_actor_profile_id: target.actorProfileId,
    p_name: name,
    p_kind: kind,
    p_size_bytes: content.bytes.length,
    p_drive_file_id: driveId,
    p_line_message_id: lineMessageId,
  });
  if (error) {
    console.error("create_file_from_line error", error.message);
    return { ok: false, reply: MSG_SAVE_FAILED };
  }
  const row = firstRow(created);
  if (row?.blocked_reason && row.blocked_reason !== "already_saved") {
    return { ok: false, reply: MSG_SAVE_FAILED };
  }

  return {
    ok: true,
    reply: savedFileFlex({
      kind,
      name,
      sizeBytes: content.bytes.length,
      tsMs: opts.tsMs,
      context: target.kind,
      link: fileLink(row?.file_id),
    }),
  };
}

// ---- helpers --------------------------------------------------------------

interface RpcRow {
  profile_id?: string | null;
  private_workspace_id?: string | null;
  workspace_id?: string | null;
  approved?: boolean | null;
  blocked_reason?: string | null;
  task_id?: string | null;
  file_id?: string | null;
  drive_file_id?: string | null;
  name?: string | null;
  line_message_id?: string | null;
}
function firstRow(data: unknown): RpcRow | null {
  if (Array.isArray(data)) return (data[0] as RpcRow | undefined) ?? null;
  return (data as RpcRow | null) ?? null;
}

function reasonToThai(reason: string): string {
  const map: Record<string, string> = {
    no_workspace_access: "คุณไม่ได้อยู่ในครอบครัวนี้",
    assignee_not_family_member: "ผู้รับผิดชอบต้องเป็นสมาชิกในครอบครัวนี้",
    private_assignee_not_allowed: "งานของฉันมอบหมายให้คนอื่นไม่ได้",
    invalid_title: "ชื่องานไม่ถูกต้อง ลองพิมพ์ใหม่",
    invalid_due_at: "กำหนดวันไม่ถูกต้อง ลองพิมพ์ใหม่",
    actor_unknown: HINT_NOT_LINKED,
  };
  return map[reason] ?? "สร้างงานไม่สำเร็จ รบกวนลองอีกครั้ง";
}

/** e.g. "อ. 16 ก.ย. 2569 · 10:00" (Bangkok, Buddhist Era). */
function formatDue(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
  return `${date} · ${time}`;
}

/** Minimum safe payload: no tokens, no message text, no raw ids beyond flags. */
function safePayload(event: LineWebhookEvent): Record<string, unknown> {
  return {
    type: event.type,
    timestamp: event.timestamp,
    isRedelivery: event.deliveryContext?.isRedelivery ?? false,
    source: {
      type: event.source?.type,
      hasUserId: Boolean(event.source?.userId),
      hasGroupId: Boolean(event.source?.groupId),
    },
    message: event.message
      ? {
        type: event.message.type,
        textLength: event.message.text?.length ?? 0,
        hasQuoted: Boolean(event.message.quotedMessageId),
      }
      : undefined,
  };
}
