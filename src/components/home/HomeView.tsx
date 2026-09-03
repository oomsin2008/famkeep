"use client";

import Link from "next/link";
import {
  CalendarCheck,
  ChatCircleText,
  ClockCountdown,
  FolderSimpleStar,
  Plus,
  WarningOctagon,
} from "@phosphor-icons/react";
import { useTasks } from "@/components/providers/TasksProvider";
import { deriveTaskStatus, selectHomeTasks } from "@/lib/tasks";
import type { FileView, TaskView } from "@/lib/types";
import { ClayTile, type ClayTone } from "@/components/ui/ClayTile";
import { TaskRow } from "@/components/tasks/TaskRow";
import { FileRow } from "@/components/files/FileRow";

function Stat({
  tone,
  icon,
  value,
  label,
  href,
}: {
  tone: ClayTone;
  icon: React.ReactNode;
  value: number;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="fk-stat fk-soft-hover flex items-center gap-3.5 p-4"
    >
      <ClayTile tone={tone} size={48} radius={16}>
        {icon}
      </ClayTile>
      <div className="min-w-0">
        <div className="text-[26px] font-bold leading-none tabular-nums">
          {value}
        </div>
        <div className="mt-1.5 text-[12.5px] font-medium text-text-2">{label}</div>
      </div>
    </Link>
  );
}

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
    return <div className="fk-card h-56 animate-pulse" />;
  }

  const open = tasks.filter((t) => t.lifecycleStatus === "open");
  const overdue = open.filter((t) => deriveTaskStatus(t, now) === "overdue").length;
  const dueSoon = open.filter((t) => deriveTaskStatus(t, now) === "duesoon").length;
  const homeTasks = selectHomeTasks(tasks, now, 4);
  const recentFiles = files.slice(0, 4);

  return (
    <div className="flex flex-col gap-7">
      {/* Hero */}
      <section className="fk-panel relative overflow-hidden p-6 md:p-8">
        <span className="fk-blob -right-16 -top-16 size-56 bg-brand-peach opacity-60" />
        <span className="fk-blob -bottom-20 right-24 size-48 bg-[#c7dbfb] opacity-50" />
        <div className="relative flex items-center gap-4">
          <ClayTile tone="yellow" size={64} radius={22}>
            <CalendarCheck size={30} weight="duotone" className="text-brand-coral" />
          </ClayTile>
          <div className="min-w-0">
            <h1 className="text-[24px] font-bold leading-tight md:text-[32px]">
              สวัสดี{greetingName ? `, ${greetingName}` : ""}
            </h1>
            <p className="mt-1 text-[13px] text-text-2 md:text-sm">
              วันนี้มีงาน {homeTasks.length} รายการที่ต้องจัดการ
            </p>
          </div>
          <Link
            href="/tasks/new"
            className="fk-btn-primary fk-soft-hover ml-auto hidden shrink-0 items-center gap-1.5 rounded-standard px-4 py-2.5 text-sm font-semibold md:inline-flex"
          >
            <Plus size={16} weight="bold" />
            สร้างงานใหม่
          </Link>
        </div>
      </section>

      {/* Stat cards */}
      <section className="grid grid-cols-2 gap-3.5 md:grid-cols-4 md:gap-4">
        <Stat
          tone="blue"
          href="/tasks"
          value={open.length}
          label="งานที่เปิดอยู่"
          icon={
            <CalendarCheck size={22} weight="duotone" className="text-private-press" />
          }
        />
        <Stat
          tone="peach"
          href="/tasks"
          value={overdue}
          label="เลยกำหนด"
          icon={
            <WarningOctagon
              size={22}
              weight="duotone"
              className="text-status-overdue-text"
            />
          }
        />
        <Stat
          tone="yellow"
          href="/tasks"
          value={dueSoon}
          label="ใกล้กำหนด"
          icon={
            <ClockCountdown
              size={22}
              weight="duotone"
              className="text-status-duesoon-text"
            />
          }
        />
        <Stat
          tone="mint"
          href="/locker"
          value={files.length}
          label="ไฟล์ในคลัง"
          icon={
            <FolderSimpleStar
              size={22}
              weight="duotone"
              className="text-status-done-text"
            />
          }
        />
      </section>

      {/* Content */}
      <div className="grid gap-6 md:grid-cols-[1.35fr_1fr] md:gap-7">
        <section className="fk-card p-5 md:p-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[17px] font-semibold">งานที่ต้องจัดการ</h2>
            <Link href="/tasks" className="text-xs font-semibold text-primary-strong">
              ดูทั้งหมด
            </Link>
          </div>

          {homeTasks.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {homeTasks.map((task) => (
                <TaskRow key={task.id} task={task} now={now} from="home" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-card bg-surface-muted/60 px-5 py-9 text-center">
              <ClayTile tone="blue" size={52} radius={18}>
                <CalendarCheck size={24} weight="duotone" className="text-private-press" />
              </ClayTile>
              <p className="text-sm text-text-2">
                ยังไม่มีงานที่ต้องจัดการ สร้างงานใหม่ หรือส่ง{" "}
                <strong className="font-semibold text-text">#งาน</strong> ผ่าน LINE
              </p>
            </div>
          )}

          <Link
            href="/tasks/new"
            className="fk-btn-primary fk-soft-hover mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-standard px-4 text-sm font-semibold md:hidden"
          >
            <Plus size={16} weight="bold" />
            สร้างงานใหม่
          </Link>
        </section>

        <section className="flex flex-col gap-6">
          <div className="fk-card p-5 md:p-6">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[17px] font-semibold">บันทึกล่าสุด</h2>
              <Link
                href="/locker"
                className="text-xs font-semibold text-primary-strong"
              >
                ดูคลังไฟล์
              </Link>
            </div>

            {recentFiles.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {recentFiles.map((file) => (
                  <FileRow key={file.id} file={file} />
                ))}
              </div>
            ) : (
              <p className="py-4 text-sm text-text-2">ยังไม่มีไฟล์ที่บันทึกไว้</p>
            )}
          </div>

          <div className="fk-clay fk-clay-green relative overflow-hidden rounded-card p-5">
            <span className="fk-blob -right-10 -top-10 size-32 bg-white opacity-40" />
            <div className="relative flex items-start gap-3">
              <ClayTile tone="green" size={44} radius={16}>
                <ChatCircleText size={22} weight="fill" className="text-line" />
              </ClayTile>
              <div className="min-w-0">
                <p className="text-sm font-bold text-status-done-text">
                  บันทึกจาก LINE
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-text-2">
                  เอกสารในกลุ่มที่อนุมัติแล้วบันทึกอัตโนมัติ · รูปภาพ ตอบกลับด้วย{" "}
                  <strong className="font-semibold text-text">#เก็บ</strong> ·
                  สร้างงานด้วย{" "}
                  <strong className="font-semibold text-text">#งาน</strong>
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
