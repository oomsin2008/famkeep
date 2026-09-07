"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useClientNow } from "@/lib/use-client-now";

export type TaskFilter = "all" | "private" | "family";

/**
 * Client-only task UI state that must survive list <-> detail navigation:
 * the shared ownership filter and the wall-clock reference used for status
 * derivation (null until mounted, to avoid SSR/CSR drift on status badges).
 * Task data itself is fetched per-route in server components and passed as
 * props; mutations go through server actions in @/lib/task-actions.
 */
interface TasksContextValue {
  now: Date | null;
  filter: TaskFilter;
  setFilter: (filter: TaskFilter) => void;
}

const TasksContext = createContext<TasksContextValue | null>(null);

export function TasksProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<TaskFilter>("all");
  const now = useClientNow();

  const value = useMemo<TasksContextValue>(
    () => ({ now, filter, setFilter }),
    [now, filter],
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks must be used within <TasksProvider>");
  return ctx;
}

/** Non-throwing read + setter for the task filter, for shell chrome. Null off-provider. */
export function useTaskFilterControls():
  | Pick<TasksContextValue, "filter" | "setFilter">
  | null {
  const ctx = useContext(TasksContext);
  return ctx ? { filter: ctx.filter, setFilter: ctx.setFilter } : null;
}
