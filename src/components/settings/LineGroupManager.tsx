"use client";

import { useActionState } from "react";
import {
  approveLineGroupAction,
  unbindLineGroupAction,
} from "@/lib/line/line-actions";
import { LINE_ACTION_IDLE } from "@/lib/line/model";
import type { LineWorkspaceConnection } from "@/lib/line/line-connection";

const buttonBase =
  "inline-flex min-h-11 w-fit items-center justify-center rounded-standard px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60";

export function LineGroupManager({ ws }: { ws: LineWorkspaceConnection }) {
  const [approveState, approve, approving] = useActionState(
    approveLineGroupAction,
    LINE_ACTION_IDLE,
  );
  const [unbindState, unbind, unbinding] = useActionState(
    unbindLineGroupAction,
    LINE_ACTION_IDLE,
  );

  return (
    <div className="flex flex-col gap-2 rounded-standard border border-border/70 bg-surface-muted/60 p-4">
      <div className="text-sm font-semibold">
        กลุ่ม LINE ของ {ws.workspaceName ?? "ครอบครัว"}
      </div>

      {ws.groupBound ? (
        <>
          <p className="text-[12.5px] text-text-2">
            สถานะ: อนุมัติแล้ว
            {ws.groupLabel ? ` · ${ws.groupLabel}` : ""}
          </p>
          {ws.isOwner && ws.boundConversationId ? (
            <form action={unbind}>
              <input type="hidden" name="conversationId" value={ws.boundConversationId} />
              <button
                type="submit"
                disabled={unbinding}
                className={`${buttonBase} border border-border bg-surface-strong text-text-2 shadow-soft`}
              >
                {unbinding ? "กำลังยกเลิก..." : "ยกเลิกการเชื่อมกลุ่ม"}
              </button>
              {unbindState.error ? (
                <p className="mt-1 text-[12.5px] text-danger-strong">{unbindState.error}</p>
              ) : null}
            </form>
          ) : null}
        </>
      ) : ws.pendingConversationId && ws.isOwner ? (
        <form action={approve} className="flex flex-col gap-1.5">
          <p className="text-[12.5px] text-text-2">
            มีกลุ่มรออนุมัติ: {ws.pendingGroupLabel ?? "กลุ่ม LINE ใหม่"}
          </p>
          <input type="hidden" name="workspaceId" value={ws.workspaceId} />
          <input type="hidden" name="conversationId" value={ws.pendingConversationId} />
          <button type="submit" disabled={approving} className={`${buttonBase} fk-btn-primary fk-soft-hover`}>
            {approving ? "กำลังอนุมัติ..." : "อนุมัติกลุ่มนี้"}
          </button>
          {approveState.error ? (
            <p className="text-[12.5px] text-danger-strong">{approveState.error}</p>
          ) : null}
        </form>
      ) : (
        <p className="text-[12.5px] text-text-2">
          {ws.isOwner
            ? "ยังไม่มีกลุ่ม LINE เพิ่ม FamKeep เข้ากลุ่มครอบครัวใน LINE แล้วกลับมาอนุมัติที่นี่"
            : "ยังไม่ได้เชื่อมกลุ่ม LINE (เจ้าของครอบครัวเป็นผู้อนุมัติ)"}
        </p>
      )}
    </div>
  );
}
