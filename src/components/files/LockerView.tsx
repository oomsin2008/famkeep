"use client";

import { useState } from "react";
import { FileArrowUp } from "@phosphor-icons/react";
import { useFiles } from "@/components/providers/FilesProvider";
import { formatThaiDate } from "@/lib/datetime";
import type { FileView, Workspace } from "@/lib/types";
import { ClayTile } from "@/components/ui/ClayTile";
import { FileRow } from "./FileRow";
import {
  FILE_KIND_CLAY,
  FILE_KIND_ICON,
  FILE_KIND_ICON_COLOR,
  FILE_KIND_LABEL,
  formatFileSize,
} from "./presentation";

const TABS: { key: Workspace; label: string }[] = [
  { key: "private", label: "ของฉัน" },
  { key: "family", label: "ครอบครัว" },
];

type SortKey =
  | "date-desc"
  | "date-asc"
  | "name-asc"
  | "name-desc"
  | "size-desc"
  | "size-asc";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "date-desc", label: "วันที่ ใหม่→เก่า" },
  { key: "date-asc", label: "วันที่ เก่า→ใหม่" },
  { key: "name-asc", label: "ชื่อไฟล์ A→Z" },
  { key: "name-desc", label: "ชื่อไฟล์ Z→A" },
  { key: "size-desc", label: "ขนาด ใหญ่→เล็ก" },
  { key: "size-asc", label: "ขนาด เล็ก→ใหญ่" },
];

function sortFiles(files: FileView[], key: SortKey): FileView[] {
  const out = [...files];
  out.sort((a, b) => {
    switch (key) {
      case "name-asc":
        return a.name.localeCompare(b.name, "th");
      case "name-desc":
        return b.name.localeCompare(a.name, "th");
      case "date-asc":
        return a.createdAt.localeCompare(b.createdAt);
      case "size-desc":
        return b.sizeBytes - a.sizeBytes;
      case "size-asc":
        return a.sizeBytes - b.sizeBytes;
      case "date-desc":
      default:
        return b.createdAt.localeCompare(a.createdAt);
    }
  });
  return out;
}

export function LockerView({
  files,
  familyName,
  familyMemberCount,
}: {
  files: FileView[];
  familyName: string | null;
  familyMemberCount: number;
}) {
  const { lockerTab, setLockerTab, openFile } = useFiles();
  const [sort, setSort] = useState<SortKey>("date-desc");

  const visible = sortFiles(
    files.filter((f) => f.workspace === lockerTab),
    sort,
  );

  const title = lockerTab === "private" ? "ของฉัน" : (familyName ?? "ครอบครัว");
  const subtitle =
    lockerTab === "private"
      ? `${visible.length} ไฟล์ · เห็นได้เฉพาะคุณ`
      : `สมาชิก ${familyMemberCount} คนเข้าถึงไฟล์ในคลังนี้ได้ · ${visible.length} ไฟล์`;

  return (
    <div>
      <div className="inline-flex rounded-pill border border-border/70 bg-surface-glass p-1 shadow-soft">
        {TABS.map((tab) => {
          const active = tab.key === lockerTab;
          const activeTone =
            tab.key === "private"
              ? "bg-private-tint text-private-press"
              : "bg-family-tint text-family-press";
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setLockerTab(tab.key)}
              aria-pressed={active}
              className={[
                "min-h-10 rounded-pill px-5 text-[14px] font-semibold transition-colors",
                active ? activeTone : "text-text-2 hover:text-text",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold md:text-[28px]">{title}</h1>
          <p className="mt-1 text-[13px] text-text-2">{subtitle}</p>
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-text-2">
          จัดเรียง
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="min-h-11 rounded-standard border border-border bg-surface px-2.5 text-[13px] text-text shadow-soft outline-none focus:border-primary"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="fk-card mt-5 flex flex-col items-center gap-3 px-6 py-14 text-center">
          <ClayTile tone="blue" size={60} radius={20}>
            <FileArrowUp size={26} weight="duotone" className="text-private-press" />
          </ClayTile>
          <p className="max-w-sm text-sm text-text-2">
            {lockerTab === "family"
              ? "ยังไม่มีไฟล์ในคลังครอบครัว ส่งเอกสารในกลุ่ม LINE ที่อนุมัติแล้ว หรือตอบกลับรูปด้วย #เก็บ"
              : "ยังไม่มีไฟล์ในคลังนี้ ส่งไฟล์หรือรูปหาบอท FamKeep ใน LINE เพื่อบันทึก"}
          </p>
        </div>
      ) : (
        <>
          <div className="fk-card mt-5 hidden p-4 md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-2">
                  <th className="w-1/2 px-2 pb-2 font-semibold">ชื่อไฟล์</th>
                  <th className="pb-2 font-semibold">ชนิด</th>
                  <th className="pb-2 font-semibold">ผู้บันทึก</th>
                  <th className="pb-2 pr-2 text-right font-semibold">วันที่</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((file) => (
                  <LockerTableRow
                    key={file.id}
                    file={file}
                    onOpen={() => openFile(file)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-col gap-2.5 md:hidden">
            {visible.map((file) => (
              <FileRow key={file.id} file={file} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LockerTableRow({
  file,
  onOpen,
}: {
  file: FileView;
  onOpen: () => void;
}) {
  const Icon = FILE_KIND_ICON[file.kind];
  return (
    <tr
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="cursor-pointer outline-none transition-colors hover:bg-surface-muted/60 focus-visible:bg-surface-muted/60 [&>td]:border-b [&>td]:border-border/60"
    >
      <td className="px-2 py-3.5">
        <div className="flex items-center gap-3">
          <ClayTile tone={FILE_KIND_CLAY[file.kind]} size={38} radius={13}>
            <Icon size={17} className={FILE_KIND_ICON_COLOR[file.kind]} />
          </ClayTile>
          <div className="min-w-0">
            <div className="truncate font-semibold">{file.name}</div>
            <div className="text-xs text-text-2">
              {formatFileSize(file.sizeBytes)}
            </div>
          </div>
        </div>
      </td>
      <td className="text-[12.5px] text-text-2">{FILE_KIND_LABEL[file.kind]}</td>
      <td className="text-[12.5px]">{file.savedByName}</td>
      <td className="pr-2 text-right text-[12.5px] text-text-2">
        {formatThaiDate(file.createdAt)}
      </td>
    </tr>
  );
}
