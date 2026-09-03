import Link from "next/link";
import { UsersThree } from "@phosphor-icons/react/dist/ssr";
import { ClayTile } from "@/components/ui/ClayTile";
import { memberInitials } from "@/lib/family/model";
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
          className="fk-btn-primary fk-soft-hover inline-flex min-h-11 w-fit items-center rounded-standard px-4 text-[13px] font-semibold"
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
      <div className="fk-card relative flex items-center gap-4 overflow-hidden p-5 md:p-6">
        <span className="fk-blob -right-12 -top-12 size-40 bg-brand-peach opacity-50" />
        <ClayTile tone="peach" size={60} radius={20}>
          <UsersThree size={28} weight="duotone" className="text-family-press" />
        </ClayTile>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[20px] font-bold md:text-[22px]">
            {workspace.name}
          </h1>
          <p className="mt-0.5 text-[12.5px] text-text-2">
            สมาชิก {members.length} คน · เข้าถึงไฟล์และงานร่วมกัน
          </p>
        </div>
        <div className="hidden -space-x-2 sm:flex">
          {members.slice(0, 4).map((m) => (
            <span
              key={m.profileId}
              className="fk-clay fk-clay-blue flex size-8 items-center justify-center rounded-full text-[11px] font-bold text-primary-strong ring-2 ring-white"
              title={m.displayName}
            >
              {memberInitials(m.displayName)}
            </span>
          ))}
        </div>
      </div>

      {issue ? (
        <p className="text-[12.5px] text-danger-strong">
          โหลดรายชื่อสมาชิกไม่สำเร็จ ({issue})
        </p>
      ) : null}

      <FamilyMemberList
        members={members}
        workspaceId={workspace.id}
        canManage={isOwner}
      />

      {isOwner ? (
        <div className="fk-card p-5">
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
