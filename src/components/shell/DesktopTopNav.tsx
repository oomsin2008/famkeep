"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MagnifyingGlass, User } from "@phosphor-icons/react";
import { useLockerTab } from "@/components/providers/FilesProvider";
import { LinkPendingHint } from "@/components/ui/LinkPendingHint";
import { BrandMark } from "./BrandMark";
import { NavAvatar } from "./NavAvatar";
import { TopNavContextTabs } from "./TopNavContextTabs";
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
        <Link href="/help" aria-label="KitiButler คู่มือการใช้งาน" className="mr-4">
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
                "relative flex min-h-10 items-center rounded-pill px-4 text-sm transition-colors",
                active
                  ? ACTIVE_ACCENT[accent]
                  : "text-text-2 hover:bg-surface-muted/70 hover:text-text",
              ].join(" ")}
            >
              {item.label}
              <LinkPendingHint className="absolute bottom-1 left-1/2 -translate-x-1/2" />
            </Link>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          <TopNavContextTabs />

          <button
            type="button"
            aria-label="ค้นหา"
            className="flex size-10 items-center justify-center rounded-full border border-white/60 bg-white/70 text-text-2 shadow-soft transition-colors hover:text-text"
          >
            <MagnifyingGlass size={18} />
          </button>

          <Link
            href="/settings"
            aria-label="ตั้งค่า"
            className="flex size-10 items-center justify-center rounded-full"
          >
            <NavAvatar
              photoSize={40}
              fallback={
                <span className="fk-clay fk-clay-blue flex size-10 items-center justify-center rounded-full text-primary-strong">
                  <User size={18} weight="duotone" />
                </span>
              }
            />
          </Link>
        </div>
      </nav>
    </header>
  );
}
