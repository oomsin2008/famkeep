import {
  File as FileIcon,
  FileDoc,
  FilePdf,
  Image as ImageIcon,
  type Icon,
} from "@phosphor-icons/react";
import type { FileKind, FileView, Workspace } from "@/lib/types";
import type { ClayTone } from "@/components/ui/ClayTile";

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

/** Clay tile tone per file type (reference: PDF red, image blue, doc peach). */
export const FILE_KIND_CLAY: Record<FileKind, ClayTone> = {
  pdf: "peach",
  image: "blue",
  doc: "yellow",
  other: "mint",
};

/** Icon colour inside the clay tile, per file type. */
export const FILE_KIND_ICON_COLOR: Record<FileKind, string> = {
  pdf: "text-status-overdue-text",
  image: "text-private-press",
  doc: "text-status-duesoon-text",
  other: "text-status-done-text",
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
