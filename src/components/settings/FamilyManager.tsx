"use client";

import { useActionState, useEffect, useRef } from "react";
import { Trash } from "@phosphor-icons/react";
import {
  addFamilyMemberAction,
  createFamilyWorkspaceAction,
  removeFamilyMemberAction,
} from "@/lib/family/family-actions";
import {
  FAMILY_ACTION_IDLE,
  memberInitials,
  type FamilyMemberRow,
} from "@/lib/family/model";
import type { FamilyRole } from "@/lib/types";

const ROLE_LABEL: Record<FamilyRole, string> = {
  owner: "เจ้าของ",
  member: "สมาชิก",
};

const inputClass =
  "w-full rounded-standard border border-border bg-surface px-3.5 py-2.5 text-sm shadow-soft outline-none focus:border-primary";
const primaryButtonClass =
  "fk-btn-primary fk-soft-hover inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-standard px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60";

export function CreateFamilyForm() {
  const [state, action, pending] = useActionState(
    createFamilyWorkspaceAction,
    FAMILY_ACTION_IDLE,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="family-name" className="text-sm font-semibold">
        ชื่อพื้นที่ครอบครัว
      </label>
      <input
        id="family-name"
        name="name"
        type="text"
        required
        maxLength={120}
        defaultValue="ครอบครัวสุขใจ"
        className={inputClass}
      />
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "กำลังสร้าง..." : "สร้างพื้นที่ครอบครัว"}
      </button>
      {state.error ? (
        <p className="text-[12.5px] text-danger-strong">{state.error}</p>
      ) : null}
    </form>
  );
}

export function AddMemberForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState(
    addFamilyMemberAction,
    FAMILY_ACTION_IDLE,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
    }
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <label htmlFor="member-line-id" className="text-sm font-semibold">
        เพิ่มสมาชิกด้วย LINE user ID
      </label>
      <p className="text-[12.5px] text-text-2">
        ผู้ใช้ต้องเคยเข้าสู่ระบบ KitiButler ด้วย LINE มาก่อน ให้เขาพิมพ์{" "}
        <span className="font-mono">ไอดี</span> หาบอทในแชท 1:1 เพื่อดู LINE user ID
        แล้วส่งมาให้คุณ
      </p>
      <input
        id="member-line-id"
        name="lineUserId"
        type="text"
        required
        autoComplete="off"
        spellCheck={false}
        className={`${inputClass} font-mono`}
      />
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "กำลังเพิ่ม..." : "เพิ่มสมาชิก"}
      </button>
      {state.error ? (
        <p className="text-[12.5px] text-danger-strong">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-[12.5px] text-text-2">เพิ่มสมาชิกแล้ว</p>
      ) : null}
    </form>
  );
}

function MemberRow({
  member,
  workspaceId,
  canManage,
}: {
  member: FamilyMemberRow;
  workspaceId: string;
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(
    removeFamilyMemberAction,
    FAMILY_ACTION_IDLE,
  );

  return (
    <div className="py-3">
      <div className="flex min-h-11 items-center gap-3">
        <div className="fk-clay flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-family-press">
          {memberInitials(member.displayName)}
        </div>
        <div className="min-w-0 flex-1 truncate text-[15px] font-semibold">
          {member.displayName}
          {member.isSelf ? (
            <span className="ml-1 text-[12px] font-normal text-text-2">(คุณ)</span>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded-pill px-2.5 py-0.5 text-[12px] font-semibold ${
            member.role === "owner"
              ? "bg-family-tint text-family-press"
              : "bg-surface-muted text-text-2"
          }`}
        >
          {ROLE_LABEL[member.role]}
        </span>
        {canManage && !member.isSelf ? (
          <form action={action} className="flex shrink-0 items-center">
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="profileId" value={member.profileId} />
            <button
              type="submit"
              disabled={pending}
              aria-label={`นำ ${member.displayName} ออกจากครอบครัว`}
              className="flex size-11 items-center justify-center rounded-full text-text-2 hover:bg-danger-soft hover:text-danger-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash size={16} />
            </button>
          </form>
        ) : null}
      </div>
      {state.error ? (
        <p className="mt-1 text-[12.5px] text-danger-strong">{state.error}</p>
      ) : null}
    </div>
  );
}

export function FamilyMemberList({
  members,
  workspaceId,
  canManage,
}: {
  members: FamilyMemberRow[];
  workspaceId: string;
  canManage: boolean;
}) {
  return (
    <div className="fk-card flex flex-col divide-y divide-border/70 px-4 py-1">
      {members.map((member) => (
        <MemberRow
          key={member.profileId}
          member={member}
          workspaceId={workspaceId}
          canManage={canManage}
        />
      ))}
    </div>
  );
}
