import { Coffee } from "@phosphor-icons/react";
import { formatThaiFullDate } from "@/lib/datetime";
import { dateKeyToInstant } from "@/lib/calendar";
import type { TaskView } from "@/lib/types";
import { ClayTile } from "@/components/ui/ClayTile";
import { TaskRow } from "@/components/tasks/TaskRow";

interface DayPanelProps {
  selectedDate: string;
  tasks: TaskView[];
  now: Date;
}

export function DayPanel({ selectedDate, tasks, now }: DayPanelProps) {
  const heading = formatThaiFullDate(dateKeyToInstant(selectedDate));

  return (
    <section className="mt-6 md:mt-0">
      <h2 className="mb-3 text-[17px] font-semibold">{heading}</h2>

      {tasks.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} now={now} from="calendar" />
          ))}
        </div>
      ) : (
        <div className="fk-card flex flex-col items-center gap-3 px-6 py-10 text-center">
          <ClayTile tone="peach" size={52} radius={18}>
            <Coffee size={22} weight="duotone" className="text-brand-coral" />
          </ClayTile>
          <p className="text-sm text-text-2">ไม่มีงานในวันนี้</p>
        </div>
      )}
    </section>
  );
}
