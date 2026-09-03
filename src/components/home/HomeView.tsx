"use client";

import Link from "next/link";
import { ChatCircleText, Plus } from "@phosphor-icons/react";
import { useTasks } from "@/components/providers/TasksProvider";
import { selectHomeTasks } from "@/lib/tasks";
import type { FileView, TaskView } from "@/lib/types";
import { TaskRow } from "@/components/tasks/TaskRow";
import { FileRow } from "@/components/files/FileRow";

export function HomeView({
  tasks,
  files,
  greetingName,
}: {
  tasks: TaskView[];
  files: FileView[];
  greetingName: string;
}) {
  const { now } = useTasks();

  if (!now) {
    return <div className="h-40 animate-pulse rounded-standard bg-surface-muted" />;
  }

  const homeTasks = selectHomeTasks(tasks, now, 3);

  return (
    <div>
      <h1 className="text-[28px] font-semibold md:text-[32px]">
        สวัสดี{greetingName ? `, ${greetingName}` : ""}
      </h1>
      <p className="mt-1 text-sm text-text-2">
        วันนี้มีงาน {homeTasks.length} รายการที่ต้องจัดการ
      </p>

      <div className="mt-8 grid gap-8 md:grid-cols-[1.25fr_1fr] md:gap-11">
        {/* Tasks */}
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">งานที่ต้องจัดการ</h2>
            <Link href="/tasks" className="text-xs text-private">
              ดูทั้งหมด
            </Link>
          </div>

          {homeTasks.length > 0 ? (
            <div className="mt-3 flex flex-col border-t border-border">
              {homeTasks.map((task) => (
                <TaskRow key={task.id} task={task} now={now} from="home" />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-text-2">ไม่มีงานที่ต้องจัดการ</p>
          )}

          <Link
            href="/tasks/new"
            className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-standard bg-brand-gradient px-4 text-sm font-semibold text-white"
          >
            <Plus size={16} />
            สร้างงานใหม่
          </Link>
        </section>

        {/* Files + LINE tip */}
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">บันทึกล่าสุด</h2>
            <Link href="/locker" className="text-xs text-private">
              ดูคลังไฟล์
            </Link>
          </div>

          {files.length > 0 ? (
            <div className="mt-3 flex flex-col border-t border-border">
              {files.map((file) => (
                <FileRow key={file.id} file={file} />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-text-2">ยังไม่มีไฟล์ที่บันทึกไว้</p>
          )}

          <div className="mt-6 flex flex-col gap-2 rounded-standard bg-family-tint p-4">
            <div className="flex items-center gap-2">
              <ChatCircleText size={17} className="text-family" />
              <span className="text-[13.5px] font-semibold">บันทึกจาก LINE</span>
            </div>
            <p className="text-[12.5px] leading-relaxed text-text-2">
              เอกสารในกลุ่มที่อนุมัติแล้วจะถูกบันทึกอัตโนมัติ · รูปภาพให้ตอบกลับรูปนั้นด้วย{" "}
              <strong className="font-semibold text-text">#เก็บ</strong> ·
              สร้างงานด้วย{" "}
              <strong className="font-semibold text-text">#งาน</strong>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
