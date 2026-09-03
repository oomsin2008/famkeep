import {
  File as FileIcon,
  FileDoc,
  FilePdf,
  Image as ImageIcon,
  type Icon,
} from "@phosphor-icons/react";
import type { FileKind, FileView, Workspace } from "@/lib/types";

export const FILE_KIND_ICON: Record<FileKind, Icon> = {
  pdf: FilePdf,
  image: ImageIcon,
  doc: FileDoc,
  other: FileIcon,
};

export const FILE_KIND_LABEL: Record<FileKind, string> = {
  pdf: "PDF",
  image: "รูปภาพ",
  doc: "เอกสาร",
  other: "ไฟล์",
};

/** File icon colour follows the owner context; nothing else about a file is coloured. */
export function fileIconColorClass(workspace: Workspace): string {
  return workspace === "private" ? "text-private" : "text-family";
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Compact meta line: "สมชาย ใจดี · 30 ส.ค. 2569 · 320.0 KB" (date formatted by caller). */
export function fileMetaLine(file: FileView, dateLabel: string): string {
  return `${file.savedByName} · ${dateLabel} · ${formatFileSize(file.sizeBytes)}`;
}
