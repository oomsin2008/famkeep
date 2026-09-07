"use client";

import { Check } from "@phosphor-icons/react";
import { useFiles } from "@/components/providers/FilesProvider";
import { InlineDeleteButton } from "@/components/ui/InlineDeleteButton";
import { deleteFileAction } from "@/lib/files/file-actions";
import { formatThaiDate } from "@/lib/datetime";
import type { FileView } from "@/lib/types";
import { ClayTile } from "@/components/ui/ClayTile";
import {
  FILE_KIND_CLAY,
  FILE_KIND_ICON,
  FILE_KIND_ICON_COLOR,
  fileMetaLine,
} from "./presentation";

/** Floating rounded file row (Home "บันทึกล่าสุด" and mobile Locker). Opens the
 *  detail modal; `deletable` adds an inline delete (Locker only). In select mode
 *  a checkbox replaces the delete and the row toggles selection. */
export function FileRow({
  file,
  deletable = false,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: {
  file: FileView;
  deletable?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { openFile } = useFiles();
  const Icon = FILE_KIND_ICON[file.kind];
  const openOrToggle =
    selectMode && onToggleSelect ? onToggleSelect : () => openFile(file);

  return (
    <div
      className={[
        "fk-row flex min-h-11 w-full items-center gap-1 p-3",
        selected ? "ring-2 ring-primary" : "",
      ].join(" ")}
    >
      {selectMode ? (
        <span
          aria-hidden
          className={[
            "mr-1 flex size-6 shrink-0 items-center justify-center rounded-md border",
            selected
              ? "border-primary bg-primary text-white"
              : "border-border bg-surface",
          ].join(" ")}
        >
          {selected ? <Check size={15} weight="bold" /> : null}
        </span>
      ) : null}
      <button
        type="button"
        onClick={openOrToggle}
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
      {deletable && !selectMode ? (
        <InlineDeleteButton
          itemLabel={file.name}
          question="ลบไฟล์นี้?"
          successMessage="ลบไฟล์แล้ว"
          onConfirm={() => deleteFileAction(file.id)}
        />
      ) : null}
    </div>
  );
}
