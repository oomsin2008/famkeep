"use client";

import { type ReactNode, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Warning, X } from "@phosphor-icons/react";
import { useToast } from "@/components/providers/ToastProvider";

interface DangerConfirmDialogProps {
  /** Text on the trigger button. */
  triggerLabel: string;
  title: string;
  description: ReactNode;
  /** Exact phrase the user must type before the action button enables. */
  phrase: string;
  confirmLabel: string;
  successMessage: string;
  onConfirm: () => Promise<{ ok: boolean; error: string | null }>;
}

/**
 * A destructive action guarded by a typed-phrase confirmation. The action
 * button stays disabled until the input matches `phrase` exactly.
 */
export function DangerConfirmDialog({
  triggerLabel,
  title,
  description,
  phrase,
  confirmLabel,
  successMessage,
  onConfirm,
}: DangerConfirmDialogProps) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  const matched = text.trim() === phrase;

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
        toast.show("success", successMessage);
        setText("");
        setOpen(false);
      } else {
        toast.show("error", result.error ?? "ทำรายการไม่สำเร็จ");
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="fk-soft-hover inline-flex min-h-11 items-center gap-1.5 rounded-standard border border-danger/40 bg-surface-glass px-4 text-[13.5px] font-semibold text-danger-strong shadow-soft transition-colors hover:bg-danger-soft"
        >
          <Warning size={15} weight="bold" />
          {triggerLabel}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-[rgba(58,42,26,0.4)] backdrop-blur-sm" />
        <Dialog.Content className="fk-glass fixed left-1/2 top-1/2 z-[100] flex w-[calc(100%-32px)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-panel p-6 shadow-floating">
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-[16px] font-semibold text-danger-strong">
              {title}
            </Dialog.Title>
            <Dialog.Close
              aria-label="ปิด"
              disabled={pending}
              className="-mr-2 -mt-2 flex size-10 shrink-0 items-center justify-center rounded-full text-text-2 hover:bg-surface-muted/70 disabled:opacity-40"
            >
              <X size={17} />
            </Dialog.Close>
          </div>

          <Dialog.Description asChild>
            <div className="text-[13px] leading-relaxed text-text-2">
              {description}
            </div>
          </Dialog.Description>

          <p className="text-[13px] text-text-2">
            พิมพ์คำว่า{" "}
            <span className="font-semibold text-text">“{phrase}”</span>{" "}
            เพื่อยืนยัน
          </p>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") run();
            }}
            disabled={pending}
            placeholder={phrase}
            aria-label={`พิมพ์ ${phrase} เพื่อยืนยัน`}
            autoFocus
            className="min-h-11 rounded-standard border border-border bg-surface px-3 text-sm outline-none focus:border-danger disabled:opacity-60"
          />

          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={run}
              disabled={!matched || pending}
              className="fk-btn-danger fk-soft-hover min-h-11 flex-1 rounded-standard px-4 text-sm font-semibold disabled:opacity-50"
            >
              {pending ? "กำลังล้าง..." : confirmLabel}
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
