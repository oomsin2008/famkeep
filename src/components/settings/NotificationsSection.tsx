"use client";

import { useSettings } from "@/components/providers/SettingsProvider";
import { ToggleSwitch } from "./ToggleSwitch";

/** Global preferences only — never overrides per-task reminders (rule 10). */
export function NotificationsSection() {
  const { notifyTaskDueSoon, weeklySummary, setNotifyTaskDueSoon, setWeeklySummary } =
    useSettings();

  return (
    <section className="flex flex-col gap-5">
      <h1 className="hidden text-2xl font-semibold md:block">การแจ้งเตือน</h1>

      <div className="fk-card flex flex-col divide-y divide-border/70 p-2">
        <div className="flex min-h-11 items-center justify-between gap-4 px-3 py-3.5">
          <div className="min-w-0">
            <label
              id="notify-due-soon-label"
              htmlFor="notify-due-soon"
              className="text-sm font-semibold"
            >
              แจ้งเตือนงานใกล้กำหนด
            </label>
            <p className="mt-0.5 text-[12.5px] text-text-2">
              แจ้งเตือนภาพรวมเมื่อมีงานใกล้ครบกำหนด
            </p>
          </div>
          <ToggleSwitch
            id="notify-due-soon"
            labelledBy="notify-due-soon-label"
            checked={notifyTaskDueSoon}
            onChange={setNotifyTaskDueSoon}
          />
        </div>

        <div className="flex min-h-11 items-center justify-between gap-4 px-3 py-3.5">
          <div className="min-w-0">
            <label
              id="weekly-summary-label"
              htmlFor="weekly-summary"
              className="text-sm font-semibold"
            >
              สรุปกิจกรรมประจำสัปดาห์
            </label>
            <p className="mt-0.5 text-[12.5px] text-text-2">
              รับสรุปงานและไฟล์ที่เกิดขึ้นในรอบสัปดาห์
            </p>
          </div>
          <ToggleSwitch
            id="weekly-summary"
            labelledBy="weekly-summary-label"
            checked={weeklySummary}
            onChange={setWeeklySummary}
          />
        </div>
      </div>

      <p className="text-[12.5px] text-text-2">
        การตั้งค่านี้เป็นภาพรวมของทั้งบัญชี ไม่มีผลกับการแจ้งเตือนที่ตั้งไว้เฉพาะในแต่ละงาน
      </p>
    </section>
  );
}
