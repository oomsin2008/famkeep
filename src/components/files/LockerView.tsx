"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  ArrowsDownUp,
  CaretDown,
  Check,
  FileArrowUp,
  ListBullets,
  SquaresFour,
  type Icon,
} from "@phosphor-icons/react";
import { useFiles } from "@/components/providers/FilesProvider";
import { InlineDeleteButton } from "@/components/ui/InlineDeleteButton";
import { DeleteAllDialog } from "@/components/ui/DeleteAllDialog";
import {
  deleteAllMyFilesAction,
  deleteFileAction,
} from "@/lib/files/file-actions";
import { formatThaiDate } from "@/lib/datetime";
import type { FileView, Workspace } from "@/lib/types";
import { ClayTile } from "@/components/ui/ClayTile";
import { FileCard } from "./FileCard";
import { UploadImageDialog } from "./UploadImageDialog";
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

type ViewMode = "list" | "grid";
type SortField = "name" | "date" | "size";
type SortDir = "asc" | "desc";

const SORT_FIELDS: { key: SortField; label: string }[] = [
  { key: "name", label: "ชื่อไฟล์" },
  { key: "date", label: "วันที่บันทึก" },
  { key: "size", label: "ขนาดไฟล์" },
];

/** Direction wording follows the field, the way Drive relabels asc/desc. */
const SORT_DIRECTIONS: Record<SortField, { key: SortDir; label: string }[]> = {
  name: [
    { key: "asc", label: "ก → ฮ (A → Z)" },
    { key: "desc", label: "ฮ → ก (Z → A)" },
  ],
  date: [
    { key: "desc", label: "ใหม่ → เก่า" },
    { key: "asc", label: "เก่า → ใหม่" },
  ],
  size: [
    { key: "desc", label: "ใหญ่ → เล็ก" },
    { key: "asc", label: "เล็ก → ใหญ่" },
  ],
};

/** Default direction when the field changes: names A→Z, date and size largest first. */
const DEFAULT_DIR: Record<SortField, SortDir> = {
  name: "asc",
  date: "desc",
  size: "desc",
};

function compareFiles(a: FileView, b: FileView, field: SortField): number {
  switch (field) {
    case "name":
      return a.name.localeCompare(b.name, "th");
    case "size":
      return a.sizeBytes - b.sizeBytes;
    case "date":
    default:
      return a.createdAt.localeCompare(b.createdAt);
  }
}

function sortFiles(
  files: FileView[],
  field: SortField,
  dir: SortDir,
): FileView[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...files].sort((a, b) => sign * compareFiles(a, b, field));
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
  const [view, setView] = useState<ViewMode>("grid");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const visible = sortFiles(
    files.filter((f) => f.workspace === lockerTab),
    sortField,
    sortDir,
  );

  function pickField(field: SortField) {
    setSortField(field);
    setSortDir(DEFAULT_DIR[field]);
  }

  const title = lockerTab === "private" ? "ของฉัน" : (familyName ?? "ครอบครัว");
  const subtitle =
    lockerTab === "private"
      ? `${visible.length} ไฟล์ · เห็นได้เฉพาะคุณ`
      : `สมาชิก ${familyMemberCount} คนเข้าถึงไฟล์ในคลังนี้ได้ · ${visible.length} ไฟล์`;

  return (
    <div>
      <div className="inline-flex rounded-pill border border-border/70 bg-surface-glass p-1 shadow-soft lg:hidden">
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

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 lg:mt-0">
        <div>
          <h1 className="text-[24px] font-semibold md:text-[28px]">{title}</h1>
          <p className="mt-1 text-[13px] text-text-2">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <UploadImageDialog />
          {lockerTab === "private" ? (
            <DeleteAllDialog
              noun="ไฟล์"
              count={visible.length}
              onConfirm={deleteAllMyFilesAction}
            />
          ) : null}
          <SortMenu
            field={sortField}
            dir={sortDir}
            onPickField={pickField}
            onPickDir={setSortDir}
          />
          <ViewToggle view={view} onChange={setView} />
        </div>
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
      ) : view === "grid" ? (
        <div className="mt-5 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((file) => (
            <FileCard key={file.id} file={file} />
          ))}
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
                  <th className="pb-2 font-semibold">วันที่</th>
                  <th className="pb-2 pr-2">
                    <span className="sr-only">การจัดการ</span>
                  </th>
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
              <FileRow key={file.id} file={file} deletable />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Drive-style sort control: one group picks the field, one picks the direction. */
function SortMenu({
  field,
  dir,
  onPickField,
  onPickDir,
}: {
  field: SortField;
  dir: SortDir;
  onPickField: (field: SortField) => void;
  onPickDir: (dir: SortDir) => void;
}) {
  const fieldLabel = SORT_FIELDS.find((f) => f.key === field)?.label ?? "";

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex min-h-12 items-center gap-2 rounded-pill border border-border/70 bg-surface-glass px-4 text-[13px] font-semibold text-text-2 shadow-soft hover:text-text"
        >
          <ArrowsDownUp size={16} />
          {fieldLabel}
          <CaretDown size={12} weight="bold" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="fk-glass z-50 flex w-60 flex-col rounded-standard p-2"
        >
          <p className="px-2.5 pb-1 pt-1.5 text-[11.5px] font-semibold text-text-2">
            จัดเรียงตาม
          </p>
          <div role="group" aria-label="จัดเรียงตาม" className="flex flex-col">
            {SORT_FIELDS.map((f) => (
              <SortMenuItem
                key={f.key}
                label={f.label}
                active={f.key === field}
                onSelect={() => onPickField(f.key)}
              />
            ))}
          </div>

          <div className="my-1.5 border-t border-border/70" />

          <p className="px-2.5 pb-1 text-[11.5px] font-semibold text-text-2">
            ลำดับ
          </p>
          <div role="group" aria-label="ลำดับ" className="flex flex-col">
            {SORT_DIRECTIONS[field].map((d) => (
              <SortMenuItem
                key={d.key}
                label={d.label}
                active={d.key === dir}
                onSelect={() => onPickDir(d.key)}
              />
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function SortMenuItem({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="flex min-h-11 items-center gap-2 rounded-standard px-2.5 text-left text-[13px] hover:bg-surface-muted/70"
    >
      <Check
        size={14}
        weight="bold"
        className={active ? "text-primary" : "invisible"}
      />
      <span className={active ? "font-semibold" : ""}>{label}</span>
    </button>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}) {
  const options: { key: ViewMode; label: string; Icon: Icon }[] = [
    { key: "list", label: "มุมมองรายการ", Icon: ListBullets },
    { key: "grid", label: "มุมมองตาราง", Icon: SquaresFour },
  ];

  return (
    <div
      role="group"
      aria-label="รูปแบบการแสดงผล"
      className="inline-flex rounded-pill border border-border/70 bg-surface-glass p-1 shadow-soft"
    >
      {options.map(({ key, label, Icon }) => {
        const active = key === view;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={active}
            aria-label={label}
            title={label}
            className={[
              "flex size-10 items-center justify-center rounded-pill transition-colors",
              active
                ? "bg-primary-soft text-primary-strong"
                : "text-text-2 hover:text-text",
            ].join(" ")}
          >
            <Icon size={18} weight={active ? "bold" : "regular"} />
          </button>
        );
      })}
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
      <td className="text-[12.5px] text-text-2">
        {formatThaiDate(file.createdAt)}
      </td>
      <td
        className="pr-2 text-right"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <InlineDeleteButton
          itemLabel={file.name}
          question="ลบไฟล์นี้?"
          successMessage="ลบไฟล์แล้ว"
          onConfirm={() => deleteFileAction(file.id)}
        />
      </td>
    </tr>
  );
}
