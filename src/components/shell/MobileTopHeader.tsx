"use client";

import Link from "next/link";
import { MagnifyingGlass, User } from "@phosphor-icons/react";
import { BrandMark } from "./BrandMark";
import { NavAvatar } from "./NavAvatar";

/** Plain header for top-level screens on mobile: brand + search + avatar.
 *  Shown only below the md breakpoint. */
export function MobileTopHeader() {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/70 bg-surface-glass px-4 py-3.5 backdrop-blur-xl md:hidden">
      <Link href="/help" aria-label="KitiButler คู่มือการใช้งาน">
        <BrandMark size={16} />
      </Link>
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          aria-label="ค้นหา"
          className="flex size-11 items-center justify-center text-text-2"
        >
          <MagnifyingGlass size={20} />
        </button>
        <Link
          href="/settings"
          aria-label="ตั้งค่า"
          className="flex size-11 items-center justify-center"
        >
          <NavAvatar
            photoSize={32}
            fallback={
              <span className="flex size-8 items-center justify-center rounded-full bg-private-tint text-private shadow-soft ring-1 ring-white/60">
                <User size={18} />
              </span>
            }
          />
        </Link>
      </div>
    </header>
  );
}
