"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useLockerTabControls } from "@/components/providers/FilesProvider";
import { useTaskFilterControls } from "@/components/providers/TasksProvider";
import type { TaskFilter } from "@/components/providers/TasksProvider";
import type { Workspace } from "@/lib/types";

const LOCKER_TABS: { key: Workspace; label: string; tone: string }[] = [
  { key: "private", label: "ของฉัน", tone: "bg-private-tint text-private-press" },
  { key: "family", label: "ครอบครัว", tone: "bg-family-tint text-family-press" },
];

const TASK_TABS: { key: TaskFilter; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "private", label: "ของฉัน" },
  { key: "family", label: "ครอบครัว" },
];

const BTN =
  "min-h-9 rounded-pill px-4 text-[13px] font-semibold transition-colors";

function shell(children: ReactNode) {
  return (
    <div className="hidden items-center rounded-pill border border-border/70 bg-surface-glass p-1 shadow-soft lg:inline-flex">
      {children}
    </div>
  );
}

/**
 * Ownership tabs shown inside the desktop top nav: the Locker workspace tab on
 * /locker, the task filter on /tasks. State lives in the layout-level providers,
 * so this only relocates the control. Renders nothing on other routes, off its
 * provider, or below the lg breakpoint (smaller screens keep the tabs in-page).
 */
export function TopNavContextTabs() {
  const pathname = usePathname();
  const locker = useLockerTabControls();
  const tasks = useTaskFilterControls();

  const inLocker = pathname === "/locker" || pathname.startsWith("/locker/");
  if (inLocker && locker) {
    return shell(
      LOCKER_TABS.map((tab) => {
        const active = tab.key === locker.lockerTab;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => locker.setLockerTab(tab.key)}
            aria-pressed={active}
            className={[
              BTN,
              active ? tab.tone : "text-text-2 hover:text-text",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      }),
    );
  }

  if (pathname === "/tasks" && tasks) {
    return shell(
      TASK_TABS.map((tab) => {
        const active = tab.key === tasks.filter;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => tasks.setFilter(tab.key)}
            aria-pressed={active}
            className={[
              BTN,
              active
                ? "bg-primary-soft text-primary-strong"
                : "text-text-2 hover:text-text",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      }),
    );
  }

  return null;
}
