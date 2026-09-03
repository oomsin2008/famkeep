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
            className="inline-flex items-center gap-1.5 rounded-pill bg-primary-soft py-1.5 pl-3.5 pr-2.5 text-[12.5px] font-semibold text-primary-strong shadow-[0_4px_10px_rgba(63,127,216,0.15),inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-primary/25"
          >
            {label}
            <button
              type="button"
              onClick={() => onRemove(preset)}
              aria-label={`ลบการแจ้งเตือน ${label}`}
              className="relative -mr-1 flex items-center justify-center text-primary-strong/70"
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
              className="inline-flex min-h-11 items-center rounded-pill border border-dashed border-border bg-surface px-3.5 text-[12.5px] font-semibold text-text-2 hover:text-text"
            >
              + เพิ่มการแจ้งเตือน
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={6}
              className="fk-glass z-50 flex w-64 flex-col rounded-standard p-2"
            >
              {available.map((preset) => (
                <Popover.Close asChild key={preset}>
                  <button
                    type="button"
                    onClick={() => onAdd(preset)}
                    className="min-h-11 rounded-standard px-2.5 text-left text-[13px] hover:bg-surface-muted/70"
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
