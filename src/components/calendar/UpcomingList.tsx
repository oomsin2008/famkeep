import type { TaskView } from "@/lib/types";
import { TaskRow } from "@/components/tasks/TaskRow";

interface UpcomingListProps {
  tasks: TaskView[];
  now: Date;
}

/** Mobile-only "กำลังจะถึง": the next open tasks still ahead of now. */
export function UpcomingList({ tasks, now }: UpcomingListProps) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-[17px] font-semibold">กำลังจะถึง</h2>

      {tasks.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} now={now} from="calendar" />
          ))}
        </div>
      ) : (
        <p className="fk-card px-5 py-6 text-sm text-text-2">
          ยังไม่มีงานที่กำลังจะถึง
        </p>
      )}
    </section>
  );
}
