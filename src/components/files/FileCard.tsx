"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, DownloadSimple, Eye, PencilSimple, X } from "@phosphor-icons/react";
import { useFiles } from "@/components/providers/FilesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { InlineDeleteButton } from "@/components/ui/InlineDeleteButton";
import { deleteFileAction, renameFileAction } from "@/lib/files/file-actions";
import { formatThaiDate } from "@/lib/datetime";
import type { FileView } from "@/lib/types";
import { ClayTile } from "@/components/ui/ClayTile";
import {
  FILE_KIND_CLAY,
  FILE_KIND_ICON,
  FILE_KIND_ICON_COLOR,
  FILE_KIND_LABEL,
  formatFileSize,
} from "./presentation";

/** Split "report.final.pdf" into stem "report.final" and ext ".pdf" (ext incl. dot, "" if none). */
function splitFilename(name: string): { stem: string; ext: string } {
  const dot = name.lastIndexOf(".");
  if (dot > 0 && dot < name.length - 1) {
    return { stem: name.slice(0, dot), ext: name.slice(dot) };
  }
  return { stem: name, ext: "" };
}

/**
 * Grid-mode file card. Images preview through the same-origin proxy
 * /api/files/[id]/content — no Drive id or token reaches client JS. Thumbnails
 * are lazy so a large locker does not fire every download at once. The preview
 * box keeps a fixed aspect ratio, so the icon fallback never shifts layout.
 * The pencil renames the file in place; the extension is fixed and never sent.
 */
export function FileCard({ file }: { file: FileView }) {
  const { openFile } = useFiles();
  const toast = useToast();
  const router = useRouter();
  const [thumbFailed, setThumbFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, startSave] = useTransition();

  const Icon = FILE_KIND_ICON[file.kind];
  const showThumb = file.kind === "image" && !thumbFailed;
  const showPdfThumb = file.kind === "pdf" && !thumbFailed;
  const canPreview = file.kind === "image" || file.kind === "pdf";
  const contentUrl = `/api/files/${file.id}/content`;
  const { stem, ext } = splitFilename(file.name);
  const canSave = draft.trim().length > 0 && draft.trim() !== stem && !saving;

  function beginEdit() {
    setDraft(stem);
    setEditing(true);
  }

  function save() {
    if (!canSave) return;
    startSave(async () => {
      const result = await renameFileAction(file.id, draft.trim());
      if (!result.ok) {
        toast.show("error", result.error ?? "เปลี่ยนชื่อไฟล์ไม่สำเร็จ");
        return;
      }
      toast.show("success", "เปลี่ยนชื่อไฟล์แล้ว");
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <article className="fk-row flex w-full flex-col overflow-hidden">
      <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-surface-muted">
        <div className="size-full">
          {showThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${contentUrl}?disposition=inline`}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setThumbFailed(true)}
              className="size-full object-cover"
            />
          ) : showPdfThumb ? (
            <iframe
              src={`${contentUrl}?disposition=inline#toolbar=0&navpanes=0&scrollbar=0&page=1&view=FitH`}
              title={`ตัวอย่าง ${file.name}`}
              loading="lazy"
              onError={() => setThumbFailed(true)}
              tabIndex={-1}
              className="pointer-events-none size-full border-0 bg-white"
            />
          ) : (
            <span className="flex size-full items-center justify-center">
              <ClayTile tone={FILE_KIND_CLAY[file.kind]} size={52} radius={18}>
                <Icon size={24} className={FILE_KIND_ICON_COLOR[file.kind]} />
              </ClayTile>
            </span>
          )}
        </div>
        {file.kind === "pdf" ? (
          <span className="absolute bottom-2 left-2 rounded-full bg-surface-strong/90 px-2 py-1 text-[11px] font-semibold text-text-2 shadow-soft">
            PDF
          </span>
        ) : null}
        {!editing ? (
          <button
            type="button"
            onClick={() => openFile(file)}
            aria-label={`${canPreview ? "เปิดดูตัวอย่าง" : "เปิดรายละเอียด"} ${file.name}`}
            className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span className="sr-only">
              {canPreview ? "เปิดดูตัวอย่าง" : "เปิดรายละเอียด"} {file.name}
            </span>
          </button>
        ) : null}
        {!editing ? (
          <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-1">
            <button
              type="button"
              onClick={beginEdit}
              aria-label={`เปลี่ยนชื่อ ${file.name}`}
              title="เปลี่ยนชื่อ"
              className="flex size-8 items-center justify-center rounded-full bg-surface-strong/90 text-text-2 shadow-soft backdrop-blur-sm transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <PencilSimple size={15} />
            </button>
            <InlineDeleteButton
              itemLabel={file.name}
              question="ลบไฟล์นี้?"
              successMessage="ลบไฟล์แล้ว"
              onConfirm={() => deleteFileAction(file.id)}
              size={8}
              className="bg-surface-strong/90 shadow-soft backdrop-blur-sm hover:text-danger-strong"
            />
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="flex flex-col gap-1.5 px-3 py-2.5">
          <div className="flex items-center gap-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
              disabled={saving}
              aria-label="ชื่อไฟล์ใหม่"
              autoFocus
              className="min-w-0 flex-1 rounded-standard border border-border bg-surface px-2 py-1.5 text-[13px] outline-none focus:border-primary disabled:opacity-60"
            />
            {ext ? (
              <span className="shrink-0 text-[12px] text-text-2">{ext}</span>
            ) : null}
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              aria-label="บันทึกชื่อไฟล์"
              className="fk-btn-primary grid size-9 place-items-center rounded-full disabled:opacity-50"
            >
              <Check size={16} weight="bold" />
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              aria-label="ยกเลิก"
              className="grid size-9 place-items-center rounded-full border border-border bg-surface-strong text-text-2 disabled:opacity-50"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => openFile(file)}
          className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <span className="truncate text-[13.5px] font-semibold">{file.name}</span>
          <span className="truncate text-[12px] text-text-2">
            {FILE_KIND_LABEL[file.kind]} · {formatThaiDate(file.createdAt)} ·{" "}
            {formatFileSize(file.sizeBytes)}
          </span>
        </button>
      )}

      <div className="flex items-center justify-between border-t border-border/60 px-2 py-1.5">
        <span className="truncate px-1 text-[11.5px] text-text-2">
          {canPreview ? "เปิดดูตัวอย่าง" : "ไม่มีตัวอย่าง"}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => openFile(file)}
            aria-label={`${canPreview ? "เปิดดูตัวอย่าง" : "เปิดรายละเอียด"} ${file.name}`}
            title={canPreview ? "เปิดดูตัวอย่าง" : "เปิดรายละเอียด"}
            className="flex size-9 items-center justify-center rounded-full text-text-2 hover:bg-surface-muted/70 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Eye size={17} />
          </button>
          <a
            href={`${contentUrl}?disposition=attachment`}
            download={file.name}
            aria-label={`ดาวน์โหลด ${file.name}`}
            title="ดาวน์โหลด"
            className="flex size-9 items-center justify-center rounded-full text-text-2 hover:bg-surface-muted/70 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <DownloadSimple size={17} />
          </a>
        </div>
      </div>
    </article>
  );
}
