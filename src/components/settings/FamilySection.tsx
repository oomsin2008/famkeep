import Link from "next/link";
import type { FamilyOverview } from "@/lib/family/model";
import {
  AddMemberForm,
  CreateFamilyForm,
  FamilyMemberList,
} from "./FamilyManager";

interface FamilySectionProps {
  overview: FamilyOverview | null;
  configured: boolean;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <section className="flex flex-col gap-5">{children}</section>;
}

/** Same content on desktop (inside the Settings sidebar layout) and mobile (drill-down sub-screen). */
export function FamilySection({ overview, configured }: FamilySectionProps) {
  if (!configured) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">ครอบครัว</h1>
        <p className="text-[13px] text-text-2">
          ยังไม่ได้ตั้งค่า Supabase สำหรับเครื่องนี้
        </p>
      </Shell>
    );
  }

  if (!overview) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">ครอบครัว</h1>
        <p className="text-[13px] text-text-2">
          เข้าสู่ระบบด้วย LINE ก่อนเพื่อสร้างหรือจัดการพื้นที่ครอบครัว
        </p>
        <Link
          href="/settings/line"
          className="text-[13px] font-semibold text-private"
        >
          ไปที่การเชื่อมต่อ LINE
        </Link>
      </Shell>
    );
  }

  if (!overview.workspace) {
    return (
      <Shell>
        <div>
          <h1 className="text-2xl font-semibold">ครอบครัว</h1>
          <p className="mt-1 text-[13px] text-text-2">
            สร้างพื้นที่ครอบครัวเพื่อแชร์ไฟล์และงานกับสมาชิกที่ได้รับอนุมัติ
          </p>
        </div>
        <CreateFamilyForm />
      </Shell>
    );
  }

  const { workspace, members, myRole, issue } = overview;
  const isOwner = myRole === "owner";

  return (
    <Shell>
      <div>
        <h1 className="text-2xl font-semibold">{workspace.name}</h1>
        <p className="mt-1 text-[13px] text-text-2">
          สมาชิกที่ได้รับอนุมัติสามารถเข้าถึงไฟล์และงานในพื้นที่ครอบครัวนี้ได้
        </p>
      </div>

      {issue ? (
        <p className="text-[12.5px] text-status-overdue-text">
          โหลดรายชื่อสมาชิกไม่สำเร็จ ({issue})
        </p>
      ) : null}

      <FamilyMemberList
        members={members}
        workspaceId={workspace.id}
        canManage={isOwner}
      />

      {isOwner ? (
        <div className="rounded-standard border border-border bg-surface-muted p-4">
          <AddMemberForm workspaceId={workspace.id} />
        </div>
      ) : (
        <p className="text-[12.5px] text-text-2">
          เฉพาะเจ้าของพื้นที่ครอบครัวเท่านั้นที่เพิ่มหรือนำสมาชิกออกได้
        </p>
      )}
    </Shell>
  );
}
