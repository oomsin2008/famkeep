"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, PencilSimple, X } from "@phosphor-icons/react";
import { useToast } from "@/components/providers/ToastProvider";
import { updateDisplayNameAction } from "@/lib/auth/profile-actions";

/** First letters of the first two words; first two chars for a single word. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return [...parts[0]].slice(0, 2).join("");
  return ([...parts[0]][0] ?? "") + ([...parts[1]][0] ?? "");
}

/** /settings root: the current user's profile card with inline name editing. */
export function GeneralSection({
  displayName,
  email,
  avatarUrl,
}: {
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
  const [pending, start] = useTransition();

  const shownName = displayName || "ยังไม่ได้ตั้งชื่อ";
  const canSave =
    draft.trim().length > 0 && draft.trim() !== displayName && !pending;

  function beginEdit() {
    setDraft(displayName);
    setEditing(true);
  }

  function save() {
    if (!canSave) return;
    start(async () => {
      const res = await updateDisplayNameAction(draft);
      if (res.ok) {
        toast.show("success", "บันทึกชื่อแล้ว");
        setEditing(false);
        router.refresh();
      } else {
        toast.show("error", res.error ?? "บันทึกไม่สำเร็จ");
      }
    });
  }

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">ทั่วไป</h1>

      <div className="fk-card flex items-center gap-4 p-5">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="size-14 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="fk-clay flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-private-press">
            {initialsOf(shownName)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") setEditing(false);
                }}
                disabled={pending}
                autoFocus
                maxLength={60}
                aria-label="ชื่อที่แสดง"
                className="min-h-9 min-w-0 flex-1 rounded-standard border border-border bg-surface px-2.5 text-[15px] outline-none focus:border-primary disabled:opacity-60"
              />
              <button
                type="button"
                onClick={save}
                disabled={!canSave}
                aria-label="บันทึกชื่อ"
                className="fk-btn-primary grid size-9 shrink-0 place-items-center rounded-full disabled:opacity-50"
              >
                <Check size={16} weight="bold" />
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={pending}
                aria-label="ยกเลิก"
                className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-surface-strong text-text-2 disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="truncate text-[16px] font-semibold">{shownName}</div>
          )}
          <div className="mt-0.5 truncate text-[13px] text-text-2">
            {email ?? "ไม่มีอีเมล"}
          </div>
        </div>

        {!editing ? (
          <button
            type="button"
            onClick={beginEdit}
            aria-label="แก้ไขโปรไฟล์"
            title="แก้ไขชื่อที่แสดง"
            className="grid size-9 shrink-0 place-items-center rounded-full text-text-2 transition-colors hover:bg-surface-muted/70 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <PencilSimple size={17} />
          </button>
        ) : null}
      </div>
    </section>
  );
}
