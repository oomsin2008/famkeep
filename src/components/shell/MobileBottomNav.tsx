"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLockerTab } from "@/components/providers/FilesProvider";
import { LinkPendingHint } from "@/components/ui/LinkPendingHint";
import { NAV_ITEMS, getActiveNavHref, navAccent } from "./nav-config";

const ACTIVE_ACCENT = {
  private: "text-primary-strong",
  family: "text-family-press",
} as const;

const ACTIVE_PILL = {
  private: "bg-primary-soft",
  family: "bg-family-tint",
} as const;

/** Bottom tab bar (4 items). Shown only below the md breakpoint and only on
 *  top-level screens; AppShell omits it on detail/sub-screens. */
export function MobileBottomNav() {
  const pathname = usePathname();
  const activeHref = getActiveNavHref(pathname);
  const accent = navAccent(pathname, useLockerTab());

  return (
    <nav className="sticky bottom-0 z-40 flex border-t border-border/70 bg-surface-glass px-1.5 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      {NAV_ITEMS.map((item) => {
        const active = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={[
              "relative flex min-h-11 flex-1 flex-col items-center justify-center gap-1 py-2",
              active ? ACTIVE_ACCENT[accent] : "text-text-2",
            ].join(" ")}
          >
            <span
              className={[
                "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                active ? ACTIVE_PILL[accent] : "",
              ].join(" ")}
            >
              <item.Icon size={21} weight={active ? "fill" : "duotone"} />
            </span>
            <span className={["text-[12px]", active ? "font-semibold" : ""].join(" ")}>
              {item.label}
            </span>
            <LinkPendingHint className="absolute bottom-0.5 left-1/2 -translate-x-1/2" />
          </Link>
        );
      })}
    </nav>
  );
}
