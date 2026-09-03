"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";

type ToastKind = "success" | "error";

interface ToastState {
  kind: ToastKind;
  text: string;
  key: number;
}

interface ToastContextValue {
  show: (kind: ToastKind, text: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DISMISS_MS = 2200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((kind: ToastKind, text: string) => {
    clearTimeout(timer.current);
    setToast({ kind, text, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), DISMISS_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? (
        <div
          key={toast.key}
          role="status"
          aria-live="polite"
          className={[
            "fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-1/2 z-[200] flex -translate-x-1/2 items-center gap-2",
            "rounded-pill border px-4 py-2.5 text-[13px] font-semibold shadow-fab md:bottom-6",
            toast.kind === "success"
              ? "border-status-done-border bg-status-done-bg text-status-done-text"
              : "border-status-overdue-border bg-status-overdue-bg text-status-overdue-text",
          ].join(" ")}
        >
          {toast.kind === "success" ? (
            <CheckCircle size={16} />
          ) : (
            <WarningCircle size={16} />
          )}
          {toast.text}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
