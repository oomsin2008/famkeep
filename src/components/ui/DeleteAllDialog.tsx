"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Trash, X } from "@phosphor-icons/react";
import { useToast } from "@/components/providers/ToastProvider";

const PHRASE = "ลบทั้งหมด";

interface DeleteAllDialogProps {
  /** "ไฟล์" | "งาน" — used in the copy. */
  noun: string;
  count: number;
  onConfirm: () => Promise<{ ok: boolean; count: number; error: string | null }>;
}

/**
 * "ลบทั้งหมด" for the caller's own (private) locker/tasks. Requires typing the
 * exact phrase before the delete button enables. Shown only on the private tab.
 */
export function DeleteAllDialog({ noun, count, onConfirm }: DeleteAllDialogProps) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  const matched = text.trim() === PHRASE;

  function onOpenChange(next: boolean) {
    if (pending) return;
    if (!next) setText("");
    setOpen(next);
  }

  function run() {
    if (!matched || pending) return;
    start(async () => {
      const result = await onConfirm();
      router.refresh();
      if (result.ok) {
        toast.show("success", `ลบ${noun} ${result.count} รายการแล้ว`);
        setText("");
        setOpen(false);
      } else {
        toast.show("error", result.error ?? "ลบไม่สำเร็จ");
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          disabled={count === 0}
          className="inline-flex min-h-12 items-center gap-1.5 rounded-pill border border-danger/40 bg-surface-glass px-4 text-[13px] font-semibold text-danger-strong shadow-soft transition-colors hover:bg-danger-soft disabled:opacity-40"
        >
          <Trash size={15} />
          ลบทั้งหมด
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-[rgba(58,42,26,0.4)] backdrop-blur-sm" />
        <Dialog.Content className="fk-glass fixed left-1/2 top-1/2 z-[100] flex w-[calc(100%-32px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-panel p-6 shadow-floating">
          <div className="flex items-start justify-between">
            <Dialog.Title className="text-[16px] font-semibold text-danger-strong">
              ลบ{noun}ทั้งหมดในคลังของฉัน
            </Dialog.Title>
            <Dialog.Close
              aria-label="ปิด"
              disabled={pending}
              className="-mr-2 -mt-2 flex size-10 shrink-0 items-center justify-center rounded-full text-text-2 hover:bg-surface-muted/70 disabled:opacity-40"
            >
              <X size={17} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-[13px] text-text-2">
            {noun}ทั้งหมด {count} รายการในคลังของฉันจะถูกลบ กู้คืนเองไม่ได้
            พิมพ์คำว่า “{PHRASE}” เพื่อยืนยัน
          </Dialog.Description>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") run();
            }}
            disabled={pending}
            placeholder={PHRASE}
            aria-label={`พิมพ์ ${PHRASE} เพื่อยืนยัน`}
            autoFocus
            className="min-h-11 rounded-standard border border-border bg-surface px-3 text-sm outline-none focus:border-danger disabled:opacity-60"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={run}
              disabled={!matched || pending}
              className="fk-btn-danger fk-soft-hover min-h-11 flex-1 rounded-standard px-4 text-sm font-semibold disabled:opacity-50"
            >
              {pending ? "กำลังลบ..." : `ลบทั้งหมด ${count} รายการ`}
            </button>
            <Dialog.Close
              disabled={pending}
              className="min-h-11 rounded-standard border border-border bg-surface-strong px-4 text-sm font-semibold disabled:opacity-60"
            >
              ยกเลิก
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
