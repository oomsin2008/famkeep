"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MagnifyingGlass, User } from "@phosphor-icons/react";
import { useLockerTab } from "@/components/providers/FilesProvider";
import { BrandMark } from "./BrandMark";
import { NAV_ITEMS, getActiveNavHref, navAccent } from "./nav-config";

const ACTIVE_ACCENT = {
  private: "border-private font-semibold text-private",
  family: "border-family font-semibold text-family",
} as const;

/** Persistent top navigation. Hidden below the md breakpoint. */
export function DesktopTopNav() {
  const pathname = usePathname();
  const activeHref = getActiveNavHref(pathname);
  const accent = navAccent(pathname, useLockerTab());

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border bg-surface md:block">
      <nav className="mx-auto flex h-16 w-full max-w-[1080px] items-center gap-7 px-7">
        <Link href="/" aria-label="FamKeep หน้าหลัก" className="mr-auto">
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
                "flex h-16 items-center border-b-2 text-sm transition-colors",
                active
                  ? ACTIVE_ACCENT[accent]
                  : "border-transparent text-text-2 hover:text-text",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}

        <button
          type="button"
          aria-label="ค้นหา"
          className="flex size-9 items-center justify-center text-text-2"
        >
          <MagnifyingGlass size={18} />
        </button>

        <Link
          href="/settings"
          aria-label="ตั้งค่า"
          className="flex size-8 items-center justify-center rounded-full bg-private-tint text-private"
        >
          <User size={17} />
        </Link>
      </nav>
    </header>
  );
}
