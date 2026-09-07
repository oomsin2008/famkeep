"use client";

import { useState, useTransition } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Trash } from "@phosphor-icons/react";
import { useToast } from "@/components/providers/ToastProvider";

interface InlineDeleteButtonProps {
  /** For the button's accessible name, e.g. the file or task title. */
  itemLabel: string;
  question?: string;
  successMessage?: string;
  onConfirm: () => Promise<{ ok: boolean; error: string | null }>;
  /** Extra classes for the trigger button (e.g. a background over a photo). */
  className?: string;
  /** Trigger size in Tailwind units. */
  size?: 8 | 9;
}

/**
 * Trash-icon button that asks for a one-tap confirm in a small popover before
 * running `onConfirm`. Single-item delete only — bulk delete uses
 * <DeleteAllDialog> with a typed phrase.
 */
export function InlineDeleteButton({
  itemLabel,
  question = "ลบรายการนี้?",
  successMessage = "ลบแล้ว",
  onConfirm,
  className = "",
  size = 9,
}: InlineDeleteButtonProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function confirm() {
    start(async () => {
      const result = await onConfirm();
      if (result.ok) {
        toast.show("success", successMessage);
        setOpen(false);
      } else {
        toast.show("error", result.error ?? "ลบไม่สำเร็จ");
      }
    });
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next);
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`ลบ ${itemLabel}`}
          title="ลบ"
          className={[
            size === 8 ? "size-8" : "size-9",
            "flex items-center justify-center rounded-full text-text-2 transition-colors hover:bg-danger-soft hover:text-danger-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40",
            className,
          ].join(" ")}
        >
          <Trash size={size === 8 ? 15 : 16} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="fk-glass z-50 w-56 rounded-standard p-3"
        >
          <p className="text-[13px] font-semibold">{question}</p>
          <p className="mt-1 text-[12px] text-text-2">กู้คืนเองไม่ได้</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              className="fk-btn-danger fk-soft-hover min-h-9 flex-1 rounded-standard px-3 text-[13px] font-semibold disabled:opacity-60"
            >
              {pending ? "กำลังลบ..." : "ยืนยันลบ"}
            </button>
            <Popover.Close
              disabled={pending}
              className="min-h-9 rounded-standard border border-border bg-surface-strong px-3 text-[13px] font-semibold disabled:opacity-60"
            >
              ยกเลิก
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
