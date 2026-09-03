import type { ReactNode } from "react";
import type { TaskDisplayStatus } from "@/lib/types";
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from "./presentation";

interface StatusBadgeProps {
  status: TaskDisplayStatus;
  /** Optional suffix rendered inside the pill after the label (e.g. "· 3 ก.ย."). */
  children?: ReactNode;
}

/** Semantic status pill: 6px radius, always shows a word (color is never the only signal). */
export function StatusBadge({ status, children }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-badge border px-2.5 py-[3px] text-xs font-semibold ${STATUS_BADGE_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
      {children}
    </span>
  );
}
