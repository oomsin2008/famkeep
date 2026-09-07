"use client";

import { useLinkStatus } from "next/link";

/**
 * Pending dot for a <Link>. Render as a descendant of the Link so useLinkStatus
 * can reflect that exact navigation, then position it from the caller.
 */
export function LinkPendingHint({ className }: { className: string }) {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden
      className={`fk-link-hint ${className} ${pending ? "is-pending" : ""}`}
    />
  );
}
