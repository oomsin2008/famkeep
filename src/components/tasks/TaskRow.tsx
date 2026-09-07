import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react";
import { InlineDeleteButton } from "@/components/ui/InlineDeleteButton";
import { deleteTaskAction } from "@/lib/task-actions";
import { deriveTaskStatus } from "@/lib/tasks";
import { formatThaiDateTime } from "@/lib/datetime";
import type { TaskView } from "@/lib/types";
import type { TaskOrigin } from "@/components/shell/nav-config";
import { StatusBadge } from "./StatusBadge";
import {
  STATUS_DOT_CLASSES,
  STATUS_LABELS,
  taskSubtitle,
  workspaceShortLabel,
} from "./presentation";

/** One task as a floating rounded row (mini card). Most of the row links to
 *  detail; `from` is threaded into the URL so the mobile back header returns to
 *  origin. `deletable` (Tasks list only) appends an inline delete. */
export function TaskRow({
  task,
  now,
  from,
  deletable = false,
}: {
  task: TaskView;
  now: Date;
  from?: TaskOrigin;
  deletable?: boolean;
}) {
  const status = deriveTaskStatus(task, now);
  const dueLabel = task.dueAt ? formatThaiDateTime(task.dueAt) : "ไม่ระบุกำหนด";
  const href = from ? `/tasks/${task.id}?from=${from}` : `/tasks/${task.id}`;
  const ariaLabel = task.dueAt
    ? `${task.title} · ${STATUS_LABELS[status]} · กำหนด ${dueLabel}`
    : `${task.title} · ${STATUS_LABELS[status]}`;

  return (
    <div className="fk-row flex min-h-11 items-start gap-2 p-3.5">
      <Link
        href={href}
        data-task-row={task.id}
        aria-label={ariaLabel}
        className="flex min-w-0 flex-1 items-start gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span
          aria-hidden
          className={`mt-1 size-3 shrink-0 rounded-full shadow-[0_2px_5px_rgba(120,86,54,0.25),inset_0_1px_1px_rgba(255,255,255,0.6)] ${STATUS_DOT_CLASSES[status]}`}
        />
        <div className="min-w-0 flex-1">
          <div data-task-title className="text-[15px] font-semibold leading-snug">
            {task.title}
          </div>

          <div className="mt-0.5 hidden text-[13px] text-text-2 md:block">
            {taskSubtitle(task)}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 md:hidden">
            <StatusBadge status={status} />
            <span className="text-xs text-text-2">
              {dueLabel} · {workspaceShortLabel(task.workspace)}
            </span>
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-3 md:flex">
          <StatusBadge status={status}>
            <span className="font-normal"> · {dueLabel}</span>
          </StatusBadge>
          <CaretRight size={15} className="text-text-soft" />
        </div>
      </Link>

      {deletable ? (
        <InlineDeleteButton
          itemLabel={task.title}
          question="ลบงานนี้?"
          successMessage="ลบงานแล้ว"
          onConfirm={deleteTaskAction.bind(null, task.id)}
        />
      ) : null}
    </div>
  );
}
