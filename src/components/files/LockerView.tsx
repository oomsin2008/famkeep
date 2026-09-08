"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import {
  ArrowsDownUp,
  CaretDown,
  Check,
  CheckSquare,
  DownloadSimple,
  FileArrowUp,
  ListBullets,
  SquaresFour,
  Trash,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { useFiles } from "@/components/providers/FilesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { InlineDeleteButton } from "@/components/ui/InlineDeleteButton";
import { deleteFileAction, deleteFilesAction } from "@/lib/files/file-actions";
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

function triggerDownload(file: FileView) {
  const a = document.createElement("a");
  a.href = `/api/files/${file.id}/content?disposition=attachment`;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
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
  const toast = useToast();
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("grid");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [deleting, startDelete] = useTransition();

  // Switching lockers drops the selection (adjust state during render).
  const [seenTab, setSeenTab] = useState(lockerTab);
  if (seenTab !== lockerTab) {
    setSeenTab(lockerTab);
    setSelectMode(false);
    setSelected(new Set());
  }

  const visible = sortFiles(
    files.filter((f) => f.workspace === lockerTab),
    sortField,
    sortDir,
  );

  const selectedFiles = visible.filter((f) => selected.has(f.id));
  const selectedCount = selectedFiles.length;
  const allSelected = visible.length > 0 && selectedCount === visible.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function downloadSelected() {
    if (selectedCount === 0) return;
    selectedFiles.forEach((file, i) => {
      window.setTimeout(() => triggerDownload(file), i * 400);
    });
    toast.show("success", `กำลังดาวน์โหลด ${selectedCount} ไฟล์`);
  }

  function deleteSelected() {
    if (selectedCount === 0 || deleting) return;
    const ids = selectedFiles.map((f) => f.id);
    startDelete(async () => {
      const res = await deleteFilesAction(ids);
      router.refresh();
      if (res.ok) {
        toast.show("success", `ลบ ${res.count} ไฟล์แล้ว`);
        exitSelect();
      } else {
        toast.show("error", res.error ?? "ลบไม่สำเร็จ");
      }
    });
  }

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
          {!selectMode && visible.length > 0 ? (
            <button
              type="button"
              onClick={() => setSelectMode(true)}
              className="inline-flex min-h-12 items-center gap-1.5 rounded-pill border border-border/70 bg-surface-glass px-4 text-[13px] font-semibold text-text-2 shadow-soft hover:text-text"
            >
              <CheckSquare size={16} />
              เลือก
            </button>
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

      {selectMode ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-standard border border-primary/25 bg-primary-soft px-3 py-2">
          <button
            type="button"
            onClick={() =>
              setSelected(
                allSelected ? new Set() : new Set(visible.map((f) => f.id)),
              )
            }
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-primary-strong"
          >
            <span
              aria-hidden
              className={[
                "flex size-5 items-center justify-center rounded-md border",
                allSelected
                  ? "border-primary bg-primary text-white"
                  : "border-primary/50 bg-surface",
              ].join(" ")}
            >
              {allSelected ? <Check size={13} weight="bold" /> : null}
            </span>
            {allSelected ? "ล้างการเลือก" : "เลือกทั้งหมด"}
          </button>

          <span className="text-[13px] text-primary-strong/80">
            เลือกแล้ว {selectedCount}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={downloadSelected}
              disabled={selectedCount === 0}
              className="fk-btn-primary fk-soft-hover inline-flex min-h-10 items-center gap-1.5 rounded-standard px-3 text-[13px] font-semibold disabled:opacity-45"
            >
              <DownloadSimple size={15} weight="bold" />
              ดาวน์โหลด
              {selectedCount > 0 ? ` (${selectedCount})` : ""}
            </button>

            <BulkDeletePopover
              count={selectedCount}
              pending={deleting}
              onConfirm={deleteSelected}
            />

            <button
              type="button"
              onClick={exitSelect}
              className="inline-flex min-h-10 items-center gap-1 rounded-standard border border-border bg-surface-strong px-3 text-[13px] font-semibold"
            >
              <X size={14} />
              เสร็จ
            </button>
          </div>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="fk-card mt-5 flex flex-col items-center gap-3 px-6 py-14 text-center">
          <ClayTile tone="blue" size={60} radius={20}>
            <FileArrowUp size={26} weight="duotone" className="text-private-press" />
          </ClayTile>
          <p className="max-w-sm text-sm text-text-2">
            {lockerTab === "family"
              ? "ยังไม่มีไฟล์ในคลังครอบครัว ส่งเอกสารในกลุ่ม LINE ที่อนุมัติแล้ว หรือตอบกลับรูปด้วย #เก็บ"
              : "ยังไม่มีไฟล์ในคลังนี้ ส่งไฟล์หรือรูปหาบอท KitiButler ใน LINE เพื่อบันทึก"}
          </p>
        </div>
      ) : view === "grid" ? (
        <div className="mt-5 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              selectMode={selectMode}
              selected={selected.has(file.id)}
              onToggleSelect={() => toggle(file.id)}
            />
          ))}
        </div>
      ) : (
        <>
          <div className="fk-card mt-5 hidden p-4 md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-2">
                  {selectMode ? <th className="w-8 pb-2" /> : null}
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
                    selectMode={selectMode}
                    selected={selected.has(file.id)}
                    onToggle={() => toggle(file.id)}
                    onOpen={() => openFile(file)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-col gap-2.5 md:hidden">
            {visible.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                deletable
                selectMode={selectMode}
                selected={selected.has(file.id)}
                onToggleSelect={() => toggle(file.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** "ลบ (N)" in the selection bar, guarded by a one-tap Popover confirm. */
function BulkDeletePopover({
  count,
  pending,
  onConfirm,
}: {
  count: number;
  pending: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={(n) => !pending && setOpen(n)}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={count === 0}
          className="fk-btn-danger fk-soft-hover inline-flex min-h-10 items-center gap-1.5 rounded-standard px-3 text-[13px] font-semibold disabled:opacity-45"
        >
          <Trash size={15} weight="bold" />
          ลบ{count > 0 ? ` (${count})` : ""}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="fk-glass z-50 w-60 rounded-standard p-3"
        >
          <p className="text-[13px] font-semibold">ลบ {count} ไฟล์ที่เลือก?</p>
          <p className="mt-1 text-[12px] text-text-2">
            กู้คืนเองไม่ได้ ต้นฉบับใน Drive ถูกย้ายไปโฟลเดอร์ที่ลบแล้ว
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className="fk-btn-danger fk-soft-hover min-h-9 flex-1 rounded-standard px-3 text-[13px] font-semibold disabled:opacity-60"
            >
              {pending ? "กำลังลบ..." : "ยืนยันลบ"}
            </button>
            <Popover.Close
              disabled={pending}
              className="min-h-9 rounded-standard border border-border bg-surface-strong px-3 text-[13px] font-semibold disabled:opacity-60"
            >
              ยกเลิก
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
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
  selectMode,
  selected,
  onToggle,
  onOpen,
}: {
  file: FileView;
  selectMode: boolean;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const Icon = FILE_KIND_ICON[file.kind];
  const activate = selectMode ? onToggle : onOpen;
  return (
    <tr
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      }}
      aria-selected={selectMode ? selected : undefined}
      className={[
        "cursor-pointer outline-none transition-colors hover:bg-surface-muted/60 focus-visible:bg-surface-muted/60 [&>td]:border-b [&>td]:border-border/60",
        selected ? "bg-primary-soft/60" : "",
      ].join(" ")}
    >
      {selectMode ? (
        <td className="pl-1">
          <span
            aria-hidden
            className={[
              "flex size-5 items-center justify-center rounded-md border",
              selected
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface",
            ].join(" ")}
          >
            {selected ? <Check size={13} weight="bold" /> : null}
          </span>
        </td>
      ) : null}
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
        {selectMode ? null : (
          <InlineDeleteButton
            itemLabel={file.name}
            question="ลบไฟล์นี้?"
            successMessage="ลบไฟล์แล้ว"
            onConfirm={() => deleteFileAction(file.id)}
          />
        )}
      </td>
    </tr>
  );
}
