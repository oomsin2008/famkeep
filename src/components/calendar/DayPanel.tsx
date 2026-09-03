import { Coffee } from "@phosphor-icons/react";
import { formatThaiFullDate } from "@/lib/datetime";
import { dateKeyToInstant } from "@/lib/calendar";
import type { TaskView } from "@/lib/types";
import { TaskRow } from "@/components/tasks/TaskRow";

interface DayPanelProps {
  selectedDate: string;
  tasks: TaskView[];
  now: Date;
}

export function DayPanel({ selectedDate, tasks, now }: DayPanelProps) {
  const heading = formatThaiFullDate(dateKeyToInstant(selectedDate));

  return (
    <section className="mt-6 border-t border-border pt-5 md:mt-8">
      <h2 className="text-base font-semibold">{heading}</h2>

      {tasks.length > 0 ? (
        <div className="mt-2 flex flex-col border-t border-border">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} now={now} from="calendar" />
          ))}
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-2 py-8 text-text-2">
          <Coffee size={28} />
          <p className="text-sm">ไม่มีงานในวันนี้</p>
        </div>
      )}
    </section>
  );
}
