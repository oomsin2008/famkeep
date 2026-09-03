"use client";

import { useFiles } from "@/components/providers/FilesProvider";
import { formatThaiDate } from "@/lib/datetime";
import type { FileView } from "@/lib/types";
import { ClayTile } from "@/components/ui/ClayTile";
import {
  FILE_KIND_CLAY,
  FILE_KIND_ICON,
  FILE_KIND_ICON_COLOR,
  fileMetaLine,
} from "./presentation";

/** Floating rounded file row (Home "บันทึกล่าสุด" and mobile Locker). Opens the detail modal. */
export function FileRow({ file }: { file: FileView }) {
  const { openFile } = useFiles();
  const Icon = FILE_KIND_ICON[file.kind];

  return (
    <button
      type="button"
      onClick={() => openFile(file)}
      className="fk-row flex min-h-11 w-full items-center gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <ClayTile tone={FILE_KIND_CLAY[file.kind]} size={40} radius={14}>
        <Icon size={18} className={FILE_KIND_ICON_COLOR[file.kind]} />
      </ClayTile>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">{file.name}</div>
        <div className="truncate text-[13px] text-text-2">
          {fileMetaLine(file, formatThaiDate(file.createdAt))}
        </div>
      </div>
    </button>
  );
}
