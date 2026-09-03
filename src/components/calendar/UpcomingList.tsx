import type { TaskView } from "@/lib/types";
import { TaskRow } from "@/components/tasks/TaskRow";

interface UpcomingListProps {
  tasks: TaskView[];
  now: Date;
}

/** Mobile-only "กำลังจะถึง": the next open tasks still ahead of now. */
export function UpcomingList({ tasks, now }: UpcomingListProps) {
  return (
    <section className="mt-8 border-t border-border pt-5">
      <h2 className="text-base font-semibold">กำลังจะถึง</h2>

      {tasks.length > 0 ? (
        <div className="mt-2 flex flex-col border-t border-border">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} now={now} from="calendar" />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-text-2">ยังไม่มีงานที่กำลังจะถึง</p>
      )}
    </section>
  );
}
