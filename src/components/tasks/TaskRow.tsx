import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react";
import { deriveTaskStatus } from "@/lib/tasks";
import { formatThaiDate } from "@/lib/datetime";
import type { TaskView } from "@/lib/types";
import type { TaskOrigin } from "@/components/shell/nav-config";
import { StatusBadge } from "./StatusBadge";
import { taskSubtitle, workspaceShortLabel } from "./presentation";

/** One task in a list. Divider-separated, entire row links to the detail screen.
 *  `from` is threaded into the URL so the mobile back header returns to the origin. */
export function TaskRow({
  task,
  now,
  from,
}: {
  task: TaskView;
  now: Date;
  from?: TaskOrigin;
}) {
  const status = deriveTaskStatus(task, now);
  const dueLabel = formatThaiDate(task.dueAt);
  const href = from ? `/tasks/${task.id}?from=${from}` : `/tasks/${task.id}`;

  return (
    <Link
      href={href}
      data-task-row={task.id}
      className="flex min-h-11 items-start gap-3.5 border-b border-border py-3.5 transition-colors hover:bg-surface-muted"
    >
      <div className="min-w-0 flex-1">
        <div data-task-title className="text-[15px] font-semibold leading-snug">
          {task.title}
        </div>

        <div className="mt-0.5 hidden text-xs text-text-2 md:block">
          {taskSubtitle(task)}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-2 md:hidden">
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
        <CaretRight size={15} className="text-text-2/50" />
      </div>
    </Link>
  );
}
