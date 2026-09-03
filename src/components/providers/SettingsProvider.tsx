"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Global notification preferences (rule 10): separate from per-task reminders,
 * never disables or alters them. In-memory only; shape stays easy to swap for
 * a Supabase-backed read/update later.
 */
interface SettingsContextValue {
  notifyTaskDueSoon: boolean;
  weeklySummary: boolean;
  setNotifyTaskDueSoon: (value: boolean) => void;
  setWeeklySummary: (value: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [notifyTaskDueSoon, setNotifyTaskDueSoon] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(true);

  const value = useMemo<SettingsContextValue>(
    () => ({
      notifyTaskDueSoon,
      weeklySummary,
      setNotifyTaskDueSoon,
      setWeeklySummary,
    }),
    [notifyTaskDueSoon, weeklySummary],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within <SettingsProvider>");
  return ctx;
}
