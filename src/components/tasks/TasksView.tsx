"use client";

import Link from "next/link";
import { Plus } from "@phosphor-icons/react";
import { useTasks } from "@/components/providers/TasksProvider";
import { DeleteAllDialog } from "@/components/ui/DeleteAllDialog";
import { deleteAllMyTasksAction } from "@/lib/task-actions";
import { deriveTaskStatus } from "@/lib/tasks";
import type { TaskView } from "@/lib/types";
import { ClayTile } from "@/components/ui/ClayTile";
import { TasksSkeleton } from "@/components/ui/Skeletons";
import { TaskFilterTabs } from "./TaskFilterTabs";
import { TaskRow } from "./TaskRow";

export function TasksView({ tasks }: { tasks: TaskView[] }) {
  const { now, filter, setFilter } = useTasks();

  if (!now) {
    return <TasksSkeleton />;
  }

  const visible = tasks.filter(
    (t) => filter === "all" || t.workspace === filter,
  );
  const overdue = visible.filter((t) => deriveTaskStatus(t, now) === "overdue").length;
  const dueSoon = visible.filter((t) => deriveTaskStatus(t, now) === "duesoon").length;
  const summary = `${visible.length} รายการ · ${overdue} เลยกำหนด · ${dueSoon} ใกล้กำหนด`;

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
        <div className="flex shrink-0 items-center gap-2">
          {filter === "private" ? (
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

      {visible.length > 0 ? (
        <div className="flex flex-col gap-3">
          {visible.map((task) => (
            <TaskRow key={task.id} task={task} now={now} from="tasks" deletable />
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
