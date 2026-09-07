"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  CloudArrowUp,
  Image as ImageIcon,
  X,
} from "@phosphor-icons/react";
import { useFiles } from "@/components/providers/FilesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { defaultFilenameFromOriginal, sanitizeFilename } from "@/lib/filename";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function uploadError(stage: string): string {
  const map: Record<string, string> = {
    drive_not_configured: "ระบบจัดเก็บไฟล์ยังไม่พร้อมใช้งาน",
    not_configured: "ระบบจัดเก็บไฟล์ยังไม่พร้อมใช้งาน",
    drive_reauth: "ระบบจัดเก็บไฟล์ต้องต่ออายุการเชื่อมต่อ Google",
    too_big: "ไฟล์ใหญ่เกินไป จำกัด 4 MB",
    not_image: "รองรับเฉพาะรูปภาพ",
    no_file: "ไม่พบไฟล์ที่จะอัปโหลด",
    bad_form: "ข้อมูลอัปโหลดไม่ถูกต้อง กรุณาลองใหม่",
    workspace_not_found: "ไม่พบคลังไฟล์นี้ หรือคุณไม่มีสิทธิ์",
    session_invalid: "กรุณาเข้าสู่ระบบใหม่",
    metadata_failed: "บันทึกข้อมูลไฟล์ไม่สำเร็จ",
    upstream_unavailable: "เชื่อมต่อระบบจัดเก็บไฟล์ไม่ได้ กรุณาลองใหม่",
    bad_response: "ระบบจัดเก็บไฟล์ตอบกลับผิดปกติ กรุณาลองใหม่",
  };
  return map[stage] ?? "อัปโหลดไม่สำเร็จ กรุณาลองใหม่";
}

/**
 * "อัปโหลดรูป" toolbar button that opens the image upload flow in a modal. The
 * filename defaults to the picked file's own name; the user can edit it before
 * saving. The target Locker is the active tab from FilesProvider.
 */
export function UploadImageDialog() {
  const { lockerTab } = useFiles();
  const toast = useToast();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [isUploading, startUpload] = useTransition();

  const targetLabel = lockerTab === "private" ? "ของฉัน" : "ครอบครัว";
  const canSave = Boolean(file && filename.trim()) && !isUploading;

  function clearSelection() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setFilename("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function onOpenChange(next: boolean) {
    if (!next && isUploading) return;
    if (!next) clearSelection();
    setOpen(next);
  }

  function onPick(nextFile: File | undefined) {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("image/")) {
      toast.show("error", "รองรับเฉพาะรูปภาพ");
      return;
    }
    if (nextFile.size > MAX_UPLOAD_BYTES) {
      toast.show("error", "ไฟล์ใหญ่เกินไป จำกัด 4 MB");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setFilename(defaultFilenameFromOriginal(nextFile.name));
  }

  function upload() {
    if (!file || !canSave) return;
    const cleanName = sanitizeFilename(filename, file.name);
    setFilename(cleanName);

    startUpload(async () => {
      const body = new FormData();
      body.set("file", file, file.name);
      body.set("name", cleanName);
      body.set("workspace", lockerTab);

      const res = await fetch("/api/files/upload", {
        method: "POST",
        body,
      }).catch(() => null);

      if (!res) {
        toast.show("error", "เชื่อมต่อระบบจัดเก็บไฟล์ไม่ได้");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { stage?: string };
      if (!res.ok) {
        toast.show(
          "error",
          uploadError(data.stage ?? res.headers.get("X-FK-Stage") ?? ""),
        );
        return;
      }

      toast.show("success", "บันทึกรูปเข้าคลังแล้ว");
      clearSelection();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="fk-btn-primary fk-soft-hover inline-flex min-h-12 items-center gap-1.5 rounded-pill px-4 text-[13px] font-semibold"
        >
          <CloudArrowUp size={16} weight="bold" />
          อัปโหลดรูป
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-[rgba(58,42,26,0.4)] backdrop-blur-sm" />
        <Dialog.Content className="fk-glass fixed left-1/2 top-1/2 z-[100] flex max-h-[85vh] w-[calc(100%-32px)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-panel p-6 shadow-floating">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-[17px] font-semibold">
                อัปโหลดรูปเข้าคลัง
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12.5px] text-text-2">
                เลือกรูปจากเครื่อง ตั้งชื่อไฟล์ แล้วบันทึกเข้าคลัง
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="ปิด"
              disabled={isUploading}
              className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-full text-text-2 hover:bg-surface-muted/70 disabled:opacity-40"
            >
              <X size={18} />
            </Dialog.Close>
          </div>

          <p className="text-[12.5px] text-text-2">
            บันทึกไปที่ ·{" "}
            <span className="font-semibold text-text">{targetLabel}</span>
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />

          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-standard border border-dashed border-border bg-surface-muted/40 px-4 py-10 text-center transition-colors hover:border-primary hover:bg-surface-muted/70"
            >
              <ImageIcon size={30} weight="duotone" className="text-primary" />
              <span className="text-sm font-semibold">เลือกรูปจากเครื่อง</span>
              <span className="text-[12px] text-text-2">
                รองรับรูปภาพ ไม่เกิน 4 MB
              </span>
            </button>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt=""
                  className="aspect-[4/3] w-full rounded-standard bg-surface-muted object-cover"
                />
              ) : null}

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-text-2">
                  <span className="truncate font-semibold text-text">
                    {file.name}
                  </span>
                  <span>{(file.size / 1024).toFixed(1)} KB</span>
                </div>

                <label
                  htmlFor="upload-filename"
                  className="mt-3 block text-[13px] font-semibold text-text-2"
                >
                  ชื่อไฟล์ก่อนบันทึก
                </label>
                <input
                  id="upload-filename"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  disabled={isUploading}
                  className="mt-1.5 min-h-11 w-full rounded-standard border border-border bg-surface px-3 text-sm outline-none focus:border-primary disabled:opacity-60"
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={upload}
                    disabled={!canSave}
                    className="fk-btn-primary fk-soft-hover min-h-11 rounded-standard px-4 text-sm font-semibold disabled:opacity-60"
                  >
                    {isUploading ? "กำลังบันทึก..." : "บันทึกเข้าคลัง"}
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    disabled={isUploading}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-standard border border-border bg-surface-strong px-4 text-sm font-semibold disabled:opacity-60"
                  >
                    <X size={16} />
                    เลือกรูปอื่น
                  </button>
                </div>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
