"use client";

import * as Popover from "@radix-ui/react-popover";
import { X } from "@phosphor-icons/react";
import { MAX_TASK_REMINDERS } from "@/lib/tasks";
import { REMINDER_PRESETS, REMINDER_PRESET_LABELS } from "@/lib/reminders";
import type { ReminderPreset } from "@/lib/types";

interface ReminderPickerProps {
  value: ReminderPreset[];
  onAdd: (preset: ReminderPreset) => void;
  onRemove: (preset: ReminderPreset) => void;
}

/**
 * Reminder chips + add control. Hard cap of 2 (rule 10): the add affordance is
 * removed once two are set. The Radix popover closes on outside click / Escape.
 */
export function ReminderPicker({ value, onAdd, onRemove }: ReminderPickerProps) {
  const available = REMINDER_PRESETS.filter((p) => !value.includes(p));
  const atCap = value.length >= MAX_TASK_REMINDERS;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {value.map((preset) => {
        const label = REMINDER_PRESET_LABELS[preset];
        return (
          <span
            key={preset}
            className="inline-flex items-center gap-1.5 rounded-pill bg-private-tint py-1.5 pl-3 pr-2.5 text-xs font-semibold text-private-press"
          >
            {label}
            <button
              type="button"
              onClick={() => onRemove(preset)}
              aria-label={`ลบการแจ้งเตือน ${label}`}
              className="relative -mr-1 flex items-center justify-center text-private-press/75"
            >
              <span aria-hidden className="absolute -inset-4" />
              <X size={13} />
            </button>
          </span>
        );
      })}

      {!atCap && available.length > 0 ? (
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-pill border border-dashed border-border px-3 text-xs font-semibold text-text-2"
            >
              + เพิ่มการแจ้งเตือน
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={6}
              className="z-50 flex w-64 flex-col rounded-standard border border-border bg-surface-muted p-2 shadow-frame"
            >
              {available.map((preset) => (
                <Popover.Close asChild key={preset}>
                  <button
                    type="button"
                    onClick={() => onAdd(preset)}
                    className="min-h-11 rounded-[6px] px-2.5 text-left text-[13px] hover:bg-black/5"
                  >
                    {REMINDER_PRESET_LABELS[preset]}
                  </button>
                </Popover.Close>
              ))}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      ) : null}
    </div>
  );
}
