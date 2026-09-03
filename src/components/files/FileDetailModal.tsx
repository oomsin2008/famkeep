"use client";

import { useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Trash, X } from "@phosphor-icons/react";
import { useFiles } from "@/components/providers/FilesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { WorkspacePill } from "@/components/tasks/WorkspacePill";
import { ClayTile } from "@/components/ui/ClayTile";
import { deleteFileAction } from "@/lib/files/file-actions";
import { formatThaiDate } from "@/lib/datetime";
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
  const { openedFile: file, closeFile } = useFiles();
  const toast = useToast();
  const Icon = file ? FILE_KIND_ICON[file.kind] : null;

  // per-file state so switching files resets it naturally (no effect)
  const [errorFileId, setErrorFileId] = useState<string | null>(null);
  const [confirmForId, setConfirmForId] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  const previewError = Boolean(file) && errorFileId === file?.id;
  const confirming = Boolean(file) && confirmForId === file?.id;

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
                <Dialog.Title className="text-base font-semibold break-words">
                  {file.name}
                </Dialog.Title>
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
                      disabled={deleting}
                      className="fk-btn-danger fk-soft-hover min-h-11 flex-1 rounded-standard px-4 text-sm font-semibold disabled:opacity-60"
                    >
                      {deleting ? "กำลังลบ..." : "ยืนยันลบ"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmForId(null)}
                      disabled={deleting}
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
