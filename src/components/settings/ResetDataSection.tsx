"use client";

import { FileX, ListChecks, WarningOctagon } from "@phosphor-icons/react";
import { DangerConfirmDialog } from "@/components/ui/DangerConfirmDialog";
import {
  resetAllAction,
  wipeFilesAction,
  wipeTasksAction,
} from "@/lib/settings/reset-actions";

/** /settings/reset: family-owner-only "danger zone" for clearing family data. */
export function ResetDataSection({
  isOwner,
  fileCount,
  taskCount,
}: {
  isOwner: boolean;
  fileCount: number;
  taskCount: number;
}) {
  if (!isOwner) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">ล้างข้อมูล</h1>
        <div className="fk-card flex items-start gap-3 p-5 text-[13.5px] text-text-2">
          <WarningOctagon size={20} className="mt-0.5 shrink-0 text-text-soft" />
          <p>
            เฉพาะเจ้าของครอบครัวเท่านั้นที่ล้างข้อมูลของครอบครัวได้
            หากต้องการล้างข้อมูล ให้เจ้าของครอบครัวเป็นผู้ทำ
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">ล้างข้อมูล</h1>
        <p className="mt-1 text-[13px] text-text-2">
          ลบข้อมูลของทั้งคลังส่วนตัวและคลังครอบครัว การลบตั้งค่าเป็น
          &quot;ลบแล้ว&quot; ในระบบ (ผู้ดูแลกู้คืนได้) ไฟล์ต้นฉบับใน Google Drive
          จะถูกย้ายไปโฟลเดอร์ที่ลบแล้ว
        </p>
      </div>

      <div className="fk-card flex flex-col divide-y divide-border/70 p-0">
        <Row
          icon={<FileX size={20} weight="duotone" className="text-danger-strong" />}
          title="ล้างคลังไฟล์"
          detail={`ไฟล์ทั้งหมด ${fileCount} รายการ`}
        >
          <DangerConfirmDialog
            triggerLabel="ล้างคลังไฟล์"
            title="ล้างคลังไฟล์ทั้งหมด"
            description={
              <>
                ไฟล์ทั้งหมด <b>{fileCount}</b>{" "}
                รายการในคลังส่วนตัวและคลังครอบครัวจะถูกลบ
                ต้นฉบับใน Google Drive จะถูกย้ายไปโฟลเดอร์ที่ลบแล้ว
              </>
            }
            phrase="ล้างไฟล์"
            confirmLabel={`ล้างไฟล์ ${fileCount} รายการ`}
            successMessage="ล้างคลังไฟล์แล้ว"
            onConfirm={wipeFilesAction}
          />
        </Row>

        <Row
          icon={<ListChecks size={20} weight="duotone" className="text-danger-strong" />}
          title="ล้างงานและปฏิทิน"
          detail={`งานทั้งหมด ${taskCount} รายการ (ทุกสถานะ)`}
        >
          <DangerConfirmDialog
            triggerLabel="ล้างงาน"
            title="ล้างงานทั้งหมด"
            description={
              <>
                งานทั้งหมด <b>{taskCount}</b> รายการ (เปิดอยู่ / เสร็จแล้ว /
                ยกเลิก) ในคลังส่วนตัวและคลังครอบครัวจะถูกลบ ปฏิทินจะว่างตามไปด้วย
              </>
            }
            phrase="ล้างงาน"
            confirmLabel={`ล้างงาน ${taskCount} รายการ`}
            successMessage="ล้างงานแล้ว"
            onConfirm={wipeTasksAction}
          />
        </Row>

        <Row
          icon={<WarningOctagon size={20} weight="fill" className="text-danger-strong" />}
          title="เริ่มใหม่ทั้งหมด"
          detail="ล้างทั้งไฟล์และงาน กลับไปเริ่มต้นใหม่"
        >
          <DangerConfirmDialog
            triggerLabel="เริ่มใหม่ทั้งหมด"
            title="เริ่มใหม่ทั้งหมด"
            description={
              <>
                ล้าง<b>ทั้งไฟล์และงาน</b>ทั้งหมด ({fileCount} ไฟล์ · {taskCount}{" "}
                งาน) ของคลังส่วนตัวและคลังครอบครัว เหมือนเริ่มใช้งานใหม่
                การเชื่อมต่อ LINE และสมาชิกครอบครัวยังอยู่เหมือนเดิม
              </>
            }
            phrase="เริ่มใหม่ทั้งหมด"
            confirmLabel="เริ่มใหม่ทั้งหมด"
            successMessage="ล้างข้อมูลทั้งหมดแล้ว เริ่มใหม่ได้เลย"
            onConfirm={resetAllAction}
          />
        </Row>
      </div>
    </section>
  );
}

function Row({
  icon,
  title,
  detail,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <span className="fk-clay flex size-10 shrink-0 items-center justify-center rounded-standard">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold">{title}</div>
        <div className="text-[12.5px] text-text-2">{detail}</div>
      </div>
      {children}
    </div>
  );
}
