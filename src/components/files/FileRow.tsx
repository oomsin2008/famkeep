"use client";

import { useFiles } from "@/components/providers/FilesProvider";
import { formatThaiDate } from "@/lib/datetime";
import type { FileView } from "@/lib/types";
import {
  FILE_KIND_ICON,
  fileIconColorClass,
  fileMetaLine,
} from "./presentation";

/** Plain divider row for a file (Home "บันทึกล่าสุด" and mobile Locker). Opens the detail modal. */
export function FileRow({ file }: { file: FileView }) {
  const { openFile } = useFiles();
  const Icon = FILE_KIND_ICON[file.kind];

  return (
    <button
      type="button"
      onClick={() => openFile(file)}
      className="flex min-h-11 w-full items-center gap-3 border-b border-border py-3 text-left transition-colors hover:bg-surface-muted"
    >
      <Icon size={22} className={`shrink-0 ${fileIconColorClass(file.workspace)}`} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{file.name}</div>
        <div className="truncate text-xs text-text-2">
          {fileMetaLine(file, formatThaiDate(file.createdAt))}
        </div>
      </div>
    </button>
  );
}
