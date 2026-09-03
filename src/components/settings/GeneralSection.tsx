"use client";

import { PencilSimple } from "@phosphor-icons/react";
import {
  MOCK_CURRENT_USER_EMAIL,
  MOCK_CURRENT_USER_ID,
  MOCK_MEMBERS,
} from "@/lib/mock/data";

/** Shown as-is on the /settings root (mobile: profile summary at top; desktop: the ทั่วไป section). */
export function GeneralSection() {
  const user = MOCK_MEMBERS.find((m) => m.id === MOCK_CURRENT_USER_ID);
  if (!user) return null;

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">ทั่วไป</h1>

      <div className="flex items-center gap-4 border-b border-border pb-5">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-private-tint text-lg font-semibold text-private">
          {user.initials}
        </div>
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">{user.displayName}</div>
          <div className="truncate text-[13px] text-text-2">{MOCK_CURRENT_USER_EMAIL}</div>
        </div>
      </div>

      <button
        type="button"
        disabled
        title="พร้อมใช้งานเมื่อเชื่อมต่อระบบยืนยันตัวตน"
        className="flex min-h-11 w-fit items-center gap-2 rounded-standard bg-border px-4 text-sm font-semibold text-text-2 disabled:cursor-not-allowed"
      >
        <PencilSimple size={16} />
        แก้ไขโปรไฟล์
      </button>
    </section>
  );
}
