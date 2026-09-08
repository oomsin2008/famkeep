import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarBlank,
  ChatCircleText,
  FolderSimple,
  ListChecks,
} from "@phosphor-icons/react/dist/ssr";
import { ClayTile } from "@/components/ui/ClayTile";

export const metadata: Metadata = {
  title: "วิธีใช้งาน KitiButler",
  description: "คำสั่ง LINE และวิธีใช้ KitiButler สำหรับครอบครัว",
};

function Syntax({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-standard bg-surface-muted px-3.5 py-3 text-[13px] leading-relaxed text-text">
      {children}
    </pre>
  );
}

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[24px] font-semibold md:text-[28px]">
        วิธีใช้งาน KitiButler
      </h1>
      <p className="mt-1.5 text-[14px] text-text-2">
        KitiButler คือพื้นที่ของครอบครัวสำหรับเก็บงาน ไฟล์ และปฏิทินร่วมกัน
        เชื่อมกับ LINE สั่งงานบางอย่างได้จากแชทโดยตรง
      </p>

      <section className="fk-card mt-6 p-5">
        <div className="flex items-center gap-3">
          <ClayTile tone="green" size={40} radius={13}>
            <ChatCircleText size={20} weight="duotone" className="text-line" />
          </ClayTile>
          <h2 className="text-[17px] font-semibold">เริ่มใช้งาน</h2>
        </div>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[14px] text-text-2">
          <li>เพิ่มบอท KitiButler เป็นเพื่อนใน LINE</li>
          <li>
            เปิดแอปแล้วกด{" "}
            <span className="font-semibold text-text">เข้าสู่ระบบด้วย LINE</span>{" "}
            หนึ่งครั้ง
          </li>
          <li>
            งานส่วนตัวใช้ได้ทันที งานครอบครัวให้เจ้าของครอบครัวเชิญสมาชิก และ
            เพิ่มบอทเข้ากลุ่ม LINE ของครอบครัว แล้วอนุมัติที่{" "}
            <Link href="/settings/line" className="font-semibold text-primary-strong underline">
              ตั้งค่า › การเชื่อมต่อ LINE
            </Link>
          </li>
        </ol>
      </section>

      <section className="fk-card mt-4 p-5">
        <div className="flex items-center gap-3">
          <ClayTile tone="blue" size={40} radius={13}>
            <ListChecks size={20} weight="duotone" className="text-private-press" />
          </ClayTile>
          <h2 className="text-[17px] font-semibold">สร้างงานจาก LINE — #งาน</h2>
        </div>
        <p className="mt-3 text-[14px] text-text-2">
          พิมพ์ในแชทกับบอท (งานส่วนตัว) หรือในกลุ่มครอบครัวที่อนุมัติแล้ว
          บรรทัดแรกคือชื่องาน อีกสองบรรทัดใส่หรือไม่ใส่ก็ได้
        </p>
        <Syntax>
          {`#งาน ชื่องาน
กำหนด: 25/12/2026 18:00
ผู้รับผิดชอบ: ชื่อสมาชิก`}
        </Syntax>

        <div className="mt-4 space-y-3 text-[13.5px] text-text-2">
          <div>
            <div className="font-semibold text-text">กำหนด: (ไม่บังคับ)</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>
                <code className="text-text">25/12/2026 18:00</code> หรือ{" "}
                <code className="text-text">25/12 18:00</code> (ไม่ใส่ปีก็ได้)
              </li>
              <li>
                <code className="text-text">วันนี้ 15:00</code> ·{" "}
                <code className="text-text">พรุ่งนี้ 09:00</code> ·{" "}
                <code className="text-text">มะรืน</code>
              </li>
              <li>
                <code className="text-text">15:00</code> เฉย ๆ = วันนี้เวลานั้น
                (ถ้าผ่านแล้วเลื่อนเป็นพรุ่งนี้)
              </li>
              <li>ไม่ใส่บรรทัดนี้ = พรุ่งนี้ 09:00</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-text">
              ผู้รับผิดชอบ: (เฉพาะงานครอบครัว)
            </div>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>
                <code className="text-text">ฉัน</code> = ตัวเอง ·{" "}
                <code className="text-text">ทุกคน</code> = ทั้งครอบครัว
              </li>
              <li>ใส่ชื่อสมาชิก (พิมพ์บางส่วนได้ ถ้าไม่ซ้ำกับคนอื่น)</li>
              <li>งานส่วนตัวมอบหมายให้คนอื่นไม่ได้</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="fk-card mt-4 p-5">
        <div className="flex items-center gap-3">
          <ClayTile tone="peach" size={40} radius={13}>
            <FolderSimple size={20} weight="duotone" className="text-family-press" />
          </ClayTile>
          <h2 className="text-[17px] font-semibold">เก็บไฟล์และรูปจาก LINE</h2>
        </div>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] text-text-2">
          <li>
            ส่งไฟล์หรือรูปหาบอทในแชท 1:1 = เก็บเข้า{" "}
            <span className="font-semibold text-text">คลังของฉัน</span> อัตโนมัติ
          </li>
          <li>
            ส่งไฟล์ในกลุ่มครอบครัวที่อนุมัติแล้ว = เก็บเข้า{" "}
            <span className="font-semibold text-text">คลังครอบครัว</span> อัตโนมัติ
          </li>
          <li>
            ส่ง<span className="font-semibold text-text">รูป</span>ในกลุ่ม
            ต้องตอบกลับที่รูปนั้นว่า <code className="text-text">#เก็บ</code>{" "}
            เพื่อยืนยัน
          </li>
        </ul>
      </section>

      <section className="fk-card mt-4 p-5">
        <div className="flex items-center gap-3">
          <ClayTile tone="lilac" size={40} radius={13}>
            <CalendarBlank size={20} weight="duotone" className="text-private-press" />
          </ClayTile>
          <h2 className="text-[17px] font-semibold">การแจ้งเตือน</h2>
        </div>
        <p className="mt-3 text-[14px] text-text-2">
          ตั้งการแจ้งเตือนได้จากหน้ารายละเอียดงานในแอป สูงสุด 2 แบบต่องาน
          (ตอนถึงกำหนด / 10 นาทีก่อน / 1 วันก่อน / เช้าวันครบกำหนด)
          บอทจะส่งข้อความเตือนใน LINE ตามเวลาที่ตั้งไว้
        </p>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/"
          className="fk-btn-primary fk-soft-hover inline-flex min-h-11 items-center rounded-standard px-5 text-sm font-semibold"
        >
          ไปหน้าหลัก
        </Link>
        <Link
          href="/tasks/new"
          className="inline-flex min-h-11 items-center rounded-standard border border-border bg-surface-strong px-5 text-sm font-semibold"
        >
          สร้างงานใหม่
        </Link>
      </div>
    </div>
  );
}
