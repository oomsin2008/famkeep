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
    <div className="flex gap-6 overflow-x-auto">
      {TABS.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            aria-pressed={active}
            className={[
              "min-h-11 whitespace-nowrap border-b-2 pb-2 text-[15px] font-semibold transition-colors",
              active
                ? "border-text text-text"
                : "border-transparent text-text-2 hover:text-text",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
