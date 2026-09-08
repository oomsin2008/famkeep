"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { CheckSquare, Plus, Trash, X } from "@phosphor-icons/react";
import { useTasks } from "@/components/providers/TasksProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { DeleteAllDialog } from "@/components/ui/DeleteAllDialog";
import { deleteAllMyTasksAction, deleteTasksAction } from "@/lib/task-actions";
import { deriveTaskStatus } from "@/lib/tasks";
import type { TaskView } from "@/lib/types";
import { ClayTile } from "@/components/ui/ClayTile";
import { TasksSkeleton } from "@/components/ui/Skeletons";
import { TaskFilterTabs } from "./TaskFilterTabs";
import { TaskRow } from "./TaskRow";

export function TasksView({ tasks }: { tasks: TaskView[] }) {
  const { now, filter, setFilter } = useTasks();
  const toast = useToast();
  const router = useRouter();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [deleting, startDelete] = useTransition();

  // Changing the filter drops the selection (adjust state during render).
  const [seenFilter, setSeenFilter] = useState(filter);
  if (seenFilter !== filter) {
    setSeenFilter(filter);
    setSelectMode(false);
    setSelected(new Set());
  }

  if (!now) {
    return <TasksSkeleton />;
  }

  const visible = tasks.filter(
    (t) => filter === "all" || t.workspace === filter,
  );
  const overdue = visible.filter((t) => deriveTaskStatus(t, now) === "overdue").length;
  const dueSoon = visible.filter((t) => deriveTaskStatus(t, now) === "duesoon").length;
  const summary = `${visible.length} รายการ · ${overdue} เลยกำหนด · ${dueSoon} ใกล้กำหนด`;

  const selectedIds = visible.filter((t) => selected.has(t.id)).map((t) => t.id);
  const selectedCount = selectedIds.length;
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

  function deleteSelected() {
    if (selectedCount === 0 || deleting) return;
    const ids = selectedIds;
    startDelete(async () => {
      const res = await deleteTasksAction(ids);
      router.refresh();
      if (res.ok) {
        toast.show("success", `ลบ ${res.count} งานแล้ว`);
        exitSelect();
      } else {
        toast.show("error", res.error ?? "ลบไม่สำเร็จ");
      }
    });
  }

  return (
    <div className="pb-24 md:pb-0">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="lg:hidden">
            <TaskFilterTabs value={filter} onChange={setFilter} />
          </div>
          <h1 className="mt-3.5 text-[26px] font-semibold lg:mt-0 md:text-[30px]">งานทั้งหมด</h1>
          <p className="mt-1 text-[13px] text-text-2">{summary}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
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
          {!selectMode && filter === "private" ? (
            <DeleteAllDialog
              noun="งาน"
              count={visible.length}
              onConfirm={deleteAllMyTasksAction}
            />
          ) : null}
          <Link
            href="/tasks/new"
            className="fk-btn-primary fk-soft-hover hidden items-center gap-1.5 rounded-standard px-4 py-2.5 text-sm font-semibold md:inline-flex"
          >
            <Plus size={16} weight="bold" />
            สร้างงานใหม่
          </Link>
        </div>
      </div>

      {selectMode ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-standard border border-primary/25 bg-primary-soft px-3 py-2">
          <button
            type="button"
            onClick={() =>
              setSelected(
                allSelected ? new Set() : new Set(visible.map((t) => t.id)),
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
              {allSelected ? <CheckSquare size={13} weight="bold" /> : null}
            </span>
            {allSelected ? "ล้างการเลือก" : "เลือกทั้งหมด"}
          </button>

          <span className="text-[13px] text-primary-strong/80">
            เลือกแล้ว {selectedCount}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <BulkDeleteTasksPopover
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

      {visible.length > 0 ? (
        <div className="flex flex-col gap-3">
          {visible.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              now={now}
              from="tasks"
              deletable
              selectMode={selectMode}
              selected={selected.has(task.id)}
              onToggleSelect={() => toggle(task.id)}
            />
          ))}
        </div>
      ) : (
        <div className="fk-card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <ClayTile tone="blue" size={60} radius={20}>
            <Plus size={26} weight="duotone" className="text-private-press" />
          </ClayTile>
          <p className="text-sm text-text-2">
            ไม่มีงานในหมวดนี้ สร้างงานใหม่ หรือส่ง{" "}
            <strong className="font-semibold text-text">#งาน</strong> ผ่าน LINE
          </p>
        </div>
      )}

      <Link
        href="/tasks/new"
        aria-label="สร้างงานใหม่"
        className="fk-btn-primary fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-30 flex size-14 items-center justify-center rounded-full shadow-floating md:hidden"
      >
        <Plus size={24} weight="bold" />
      </Link>
    </div>
  );
}

/** "ลบ (N)" in the selection bar, guarded by a one-tap Popover confirm. */
function BulkDeleteTasksPopover({
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
          <p className="text-[13px] font-semibold">ลบ {count} งานที่เลือก?</p>
          <p className="mt-1 text-[12px] text-text-2">
            กู้คืนเองไม่ได้ การแจ้งเตือนที่ตั้งไว้จะหยุดด้วย
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
