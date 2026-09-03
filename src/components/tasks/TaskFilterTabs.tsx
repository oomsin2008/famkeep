"use client";

import type { TaskFilter } from "@/components/providers/TasksProvider";

const TABS: { key: TaskFilter; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "private", label: "ของฉัน" },
  { key: "family", label: "ครอบครัว" },
];

interface TaskFilterTabsProps {
  value: TaskFilter;
  onChange: (filter: TaskFilter) => void;
}

/** 3-way ownership filter. Active state is neutral (dark), not a context color. */
export function TaskFilterTabs({ value, onChange }: TaskFilterTabsProps) {
  return (
    <div className="inline-flex gap-1 rounded-pill border border-border/70 bg-surface-glass p-1 shadow-soft">
      {TABS.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            aria-pressed={active}
            className={[
              "min-h-10 whitespace-nowrap rounded-pill px-4 text-[14px] font-semibold transition-colors",
              active
                ? "bg-primary-soft text-primary-strong"
                : "text-text-2 hover:text-text",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
