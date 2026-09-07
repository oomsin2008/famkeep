"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, PencilSimple, Trash, X } from "@phosphor-icons/react";
import { useFiles } from "@/components/providers/FilesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { WorkspacePill } from "@/components/tasks/WorkspacePill";
import { ClayTile } from "@/components/ui/ClayTile";
import { deleteFileAction } from "@/lib/files/file-actions";
import { formatThaiDate } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";
import {
  FILE_KIND_CLAY,
  FILE_KIND_ICON,
  FILE_KIND_ICON_COLOR,
  FILE_KIND_LABEL,
  formatFileSize,
} from "./presentation";

/**
 * Reusable File Detail modal, mounted once at app level. Opens from Home and
 * Locker via `openFile(file)`. Preview + download stream through the
 * same-origin proxy /api/files/[id]/content — no Drive id or token reaches
 * client JS. Delete soft-deletes in Supabase (+ best-effort Drive cleanup) and
 * revalidates the lists. Closes on X, backdrop click, and Escape (Radix).
 */
export function FileDetailModal() {
  const { openedFile: file, closeFile, renameOpenedFile } = useFiles();
  const toast = useToast();
  const router = useRouter();
  const Icon = file ? FILE_KIND_ICON[file.kind] : null;

  // per-file state so switching files resets it naturally (no effect)
  const [errorFileId, setErrorFileId] = useState<string | null>(null);
  const [confirmForId, setConfirmForId] = useState<string | null>(null);
  const [editingForId, setEditingForId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [deleting, startDelete] = useTransition();
  const [renaming, startRename] = useTransition();

  const previewError = Boolean(file) && errorFileId === file?.id;
  const confirming = Boolean(file) && confirmForId === file?.id;
  const editing = Boolean(file) && editingForId === file?.id;

  const contentUrl = (mode: "inline" | "attachment") =>
    file ? `/api/files/${file.id}/content?disposition=${mode}` : "#";

  const isImage = file?.kind === "image";
  const isPdf = file?.kind === "pdf";

  function onDelete() {
    if (!file) return;
    const id = file.id;
    startDelete(async () => {
      const result = await deleteFileAction(id);
      if (result.ok) {
        toast.show("success", "ลบไฟล์แล้ว");
        setConfirmForId(null);
        closeFile();
      } else {
        toast.show("error", result.error ?? "ลบไฟล์ไม่สำเร็จ");
        setConfirmForId(null);
      }
    });
  }

  function renameError(stage: string): string {
    const map: Record<string, string> = {
      drive_not_configured: "ระบบจัดเก็บไฟล์ยังไม่พร้อมใช้งาน",
      drive_reauth: "ระบบจัดเก็บไฟล์ต้องต่ออายุการเชื่อมต่อ Google",
      drive_rename_failed: "เปลี่ยนชื่อไฟล์ใน Google Drive ไม่สำเร็จ",
      missing_drive_file: "ไฟล์นี้ไม่มีข้อมูล Google Drive ที่ใช้เปลี่ยนชื่อ",
      not_found: "ไม่พบไฟล์นี้ หรือคุณไม่มีสิทธิ์",
      session_invalid: "กรุณาเข้าสู่ระบบใหม่",
      invalid_name: "ชื่อไฟล์ไม่ถูกต้อง",
      metadata_failed: "บันทึกข้อมูลชื่อไฟล์ไม่สำเร็จ",
    };
    return map[stage] ?? "เปลี่ยนชื่อไฟล์ไม่สำเร็จ กรุณาลองใหม่";
  }

  function beginRename() {
    if (!file) return;
    setDraftName(file.name);
    setEditingForId(file.id);
    setConfirmForId(null);
  }

  function cancelRename() {
    if (renaming) return;
    setEditingForId(null);
    setDraftName("");
  }

  function saveRename() {
    if (!file || !draftName.trim() || renaming) return;
    const fileId = file.id;
    const requestedName = draftName.trim();
    setDraftName(requestedName);

    startRename(async () => {
      const config = getSupabaseConfig();
      if (!config) {
        toast.show("error", "ยังไม่ได้ตั้งค่า Supabase");
        return;
      }
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.show("error", "กรุณาเข้าสู่ระบบใหม่");
        return;
      }

      const base = config.supabaseUrl.replace(/\/+$/, "");
      const res = await fetch(`${base}/functions/v1/file-rename`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: config.supabasePublishableKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: fileId, name: requestedName }),
      }).catch(() => null);

      if (!res) {
        toast.show("error", "เชื่อมต่อระบบจัดเก็บไฟล์ไม่ได้");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        name?: string;
        stage?: string;
      };
      if (!res.ok) {
        toast.show(
          "error",
          renameError(data.stage ?? res.headers.get("X-FK-Stage") ?? ""),
        );
        return;
      }

      const nextName = data.name ?? requestedName;
      renameOpenedFile(fileId, nextName);
      setDraftName(nextName);
      setEditingForId(null);
      toast.show("success", "เปลี่ยนชื่อไฟล์แล้ว");
      router.refresh();
    });
  }

  return (
    <Dialog.Root
      open={Boolean(file)}
      onOpenChange={(next) => {
        if (!next && !deleting) closeFile();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-[rgba(58,42,26,0.4)] backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fk-glass fixed left-1/2 top-1/2 z-[100] flex max-h-[85vh] w-[calc(100%-32px)] max-w-[460px] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-panel p-6 shadow-floating"
        >
          {file && Icon ? (
            <>
              <div className="flex items-start justify-between">
                <ClayTile tone={FILE_KIND_CLAY[file.kind]} size={52} radius={18}>
                  <Icon size={24} className={FILE_KIND_ICON_COLOR[file.kind]} />
                </ClayTile>
                <Dialog.Close
                  aria-label="ปิด"
                  className="-mr-2 -mt-2 flex size-11 items-center justify-center rounded-full text-text-2 hover:bg-surface-muted/70"
                >
                  <X size={18} />
                </Dialog.Close>
              </div>

              <div className="flex flex-col gap-2">
                {editing ? (
                  <div className="flex flex-col gap-2">
                    <Dialog.Title className="text-base font-semibold">
                      เปลี่ยนชื่อไฟล์
                    </Dialog.Title>
                    <div className="flex gap-2">
                      <input
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        disabled={renaming}
                        className="min-h-11 min-w-0 flex-1 rounded-standard border border-border bg-surface px-3 text-sm outline-none focus:border-primary disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={saveRename}
                        disabled={renaming || !draftName.trim()}
                        aria-label="บันทึกชื่อไฟล์"
                        className="fk-btn-primary grid size-11 place-items-center rounded-standard disabled:opacity-60"
                      >
                        <Check size={17} weight="bold" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        disabled={renaming}
                        aria-label="ยกเลิกเปลี่ยนชื่อ"
                        className="grid size-11 place-items-center rounded-standard border border-border bg-surface-strong disabled:opacity-60"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <Dialog.Title className="min-w-0 flex-1 break-words text-base font-semibold">
                      {file.name}
                    </Dialog.Title>
                    <button
                      type="button"
                      onClick={beginRename}
                      disabled={deleting}
                      aria-label="เปลี่ยนชื่อไฟล์"
                      className="grid size-9 shrink-0 place-items-center rounded-full text-text-2 hover:bg-surface-muted/70 disabled:opacity-60"
                    >
                      <PencilSimple size={17} />
                    </button>
                  </div>
                )}
                <div>
                  <WorkspacePill workspace={file.workspace} />
                </div>
              </div>

              {isImage && !previewError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={contentUrl("inline")}
                  alt={file.name}
                  onError={() => file && setErrorFileId(file.id)}
                  className="max-h-[40vh] w-full rounded-standard bg-surface-muted object-contain"
                />
              ) : isPdf && !previewError ? (
                <iframe
                  src={contentUrl("inline")}
                  title={file.name}
                  onError={() => file && setErrorFileId(file.id)}
                  className="h-[45vh] w-full rounded-standard border border-border bg-surface-muted"
                />
              ) : (
                <div className="grid h-32 place-items-center rounded-standard bg-surface-muted px-4 text-center font-mono text-xs text-text-2">
                  {previewError
                    ? "แสดงตัวอย่างไม่ได้ ลองดาวน์โหลดไฟล์"
                    : "ไฟล์ประเภทนี้ไม่มีตัวอย่าง"}
                </div>
              )}

              <div className="text-xs text-text-2">
                {file.savedByName} · {formatThaiDate(file.createdAt)} ·{" "}
                {FILE_KIND_LABEL[file.kind]} · {formatFileSize(file.sizeBytes)}
                {file.savedViaLine ? " · บันทึกจาก LINE" : ""}
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href={contentUrl("attachment")}
                  download={file.name}
                  className="fk-btn-primary fk-soft-hover min-h-11 flex-1 rounded-standard px-4 text-center text-sm font-semibold leading-[44px]"
                >
                  ดาวน์โหลด
                </a>
                {isImage || isPdf ? (
                  <a
                    href={contentUrl("inline")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-11 rounded-standard border border-border bg-surface-strong px-5 text-sm leading-[44px] shadow-soft"
                  >
                    เปิดในแท็บใหม่
                  </a>
                ) : null}
              </div>

              {confirming ? (
                <div className="flex flex-col gap-2.5 rounded-standard border border-danger/40 bg-danger-soft p-4">
                  <p className="text-[14px] font-semibold text-danger-strong">
                    ยืนยันการลบไฟล์นี้?
                  </p>
                  <p className="text-[12.5px] text-danger-strong/80">
                    ไฟล์จะถูกนำออกจากคลัง กู้คืนเองไม่ได้
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onDelete}
                      disabled={deleting || renaming}
                      className="fk-btn-danger fk-soft-hover min-h-11 flex-1 rounded-standard px-4 text-sm font-semibold disabled:opacity-60"
                    >
                      {deleting ? "กำลังลบ..." : "ยืนยันลบ"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmForId(null)}
                      disabled={deleting || renaming}
                      className="min-h-11 rounded-standard border border-border bg-surface-strong px-5 text-sm disabled:opacity-60"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => file && setConfirmForId(file.id)}
                  disabled={renaming}
                  className="inline-flex min-h-11 w-fit items-center gap-1.5 self-start rounded-standard px-2 text-sm font-semibold text-danger-strong"
                >
                  <Trash size={16} />
                  ลบไฟล์
                </button>
              )}
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
