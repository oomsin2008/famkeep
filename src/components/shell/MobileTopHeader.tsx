"use client";

import Link from "next/link";
import { MagnifyingGlass, User } from "@phosphor-icons/react";
import { BrandMark } from "./BrandMark";

/** Plain header for top-level screens on mobile: brand + search + avatar.
 *  Shown only below the md breakpoint. */
export function MobileTopHeader() {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-surface px-4 py-3.5 md:hidden">
      <Link href="/" aria-label="FamKeep หน้าหลัก">
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
          <span className="flex size-8 items-center justify-center rounded-full bg-private-tint text-private">
            <User size={18} />
          </span>
        </Link>
      </div>
    </header>
  );
}
