"use client";

import Link from "next/link";
import { Plus } from "@phosphor-icons/react";
import { useTasks } from "@/components/providers/TasksProvider";
import { deriveTaskStatus } from "@/lib/tasks";
import type { TaskView } from "@/lib/types";
import { TaskFilterTabs } from "./TaskFilterTabs";
import { TaskRow } from "./TaskRow";

export function TasksView({ tasks }: { tasks: TaskView[] }) {
  const { now, filter, setFilter } = useTasks();

  if (!now) {
    return <div className="h-40 animate-pulse rounded-standard bg-surface-muted" />;
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
          <TaskFilterTabs value={filter} onChange={setFilter} />
          <h1 className="mt-3.5 text-[28px] font-semibold">งานทั้งหมด</h1>
          <p className="mt-1 text-[13px] text-text-2">{summary}</p>
        </div>
        <Link
          href="/tasks/new"
          className="hidden shrink-0 items-center gap-1.5 rounded-standard bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white md:inline-flex"
        >
          <Plus size={16} />
          สร้างงานใหม่
        </Link>
      </div>

      {visible.length > 0 ? (
        <div className="flex flex-col border-t border-border">
          {visible.map((task) => (
            <TaskRow key={task.id} task={task} now={now} from="tasks" />
          ))}
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-text-2">ไม่มีงานในหมวดนี้</p>
      )}

      <Link
        href="/tasks/new"
        aria-label="สร้างงานใหม่"
        className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-30 flex size-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-fab md:hidden"
      >
        <Plus size={24} />
      </Link>
    </div>
  );
}
