"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MagnifyingGlass, User } from "@phosphor-icons/react";
import { useLockerTab } from "@/components/providers/FilesProvider";
import { BrandMark } from "./BrandMark";
import { NAV_ITEMS, getActiveNavHref, navAccent } from "./nav-config";

const ACTIVE_ACCENT = {
  private: "bg-primary-soft font-semibold text-primary-strong ring-1 ring-primary/20",
  family: "bg-family-tint font-semibold text-family-press ring-1 ring-family/25",
} as const;

/** Persistent top navigation. Hidden below the md breakpoint. */
export function DesktopTopNav() {
  const pathname = usePathname();
  const activeHref = getActiveNavHref(pathname);
  const accent = navAccent(pathname, useLockerTab());

  return (
    <header className="sticky top-0 z-40 hidden border-b border-white/40 bg-surface-glass shadow-soft backdrop-blur-xl md:block">
      <nav className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-2 px-8">
        <Link href="/" aria-label="FamKeep หน้าหลัก" className="mr-4">
          <BrandMark />
        </Link>

        {NAV_ITEMS.map((item) => {
          const active = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex min-h-10 items-center rounded-pill px-4 text-sm transition-colors",
                active
                  ? ACTIVE_ACCENT[accent]
                  : "text-text-2 hover:bg-surface-muted/70 hover:text-text",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}

        <button
          type="button"
          aria-label="ค้นหา"
          className="ml-auto flex size-10 items-center justify-center rounded-full border border-white/60 bg-white/70 text-text-2 shadow-soft transition-colors hover:text-text"
        >
          <MagnifyingGlass size={18} />
        </button>

        <Link
          href="/settings"
          aria-label="ตั้งค่า"
          className="fk-clay fk-clay-blue flex size-10 items-center justify-center rounded-full text-primary-strong"
        >
          <User size={18} weight="duotone" />
        </Link>
      </nav>
    </header>
  );
}
