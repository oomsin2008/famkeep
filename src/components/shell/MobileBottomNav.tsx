"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLockerTab } from "@/components/providers/FilesProvider";
import { NAV_ITEMS, getActiveNavHref, navAccent } from "./nav-config";

const ACTIVE_ACCENT = {
  private: "text-private",
  family: "text-family",
} as const;

/** Bottom tab bar (4 items). Shown only below the md breakpoint and only on
 *  top-level screens; AppShell omits it on detail/sub-screens. */
export function MobileBottomNav() {
  const pathname = usePathname();
  const activeHref = getActiveNavHref(pathname);
  const accent = navAccent(pathname, useLockerTab());

  return (
    <nav className="sticky bottom-0 z-40 flex border-t border-border bg-surface px-1.5 pb-[env(safe-area-inset-bottom)] md:hidden">
      {NAV_ITEMS.map((item) => {
        const active = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={[
              "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2",
              active ? ACTIVE_ACCENT[accent] : "text-text-2",
            ].join(" ")}
          >
            <item.Icon size={22} weight="duotone" />
            <span className={["text-[12px]", active ? "font-semibold" : ""].join(" ")}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
