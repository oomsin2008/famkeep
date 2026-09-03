"use client";

import Link from "next/link";
import { Bell, CaretRight, ChatCircleDots, UsersThree, type Icon } from "@phosphor-icons/react";

interface Row {
  href: string;
  label: string;
  Icon: Icon;
}

const ROWS: readonly Row[] = [
  { href: "/settings/family", label: "ครอบครัว", Icon: UsersThree },
  { href: "/settings/line", label: "การเชื่อมต่อ LINE", Icon: ChatCircleDots },
  { href: "/settings/notifications", label: "การแจ้งเตือน", Icon: Bell },
];

/** Mobile-only drill-down menu on the /settings root; desktop uses SettingsSidebar instead. */
export function SettingsDrilldownList() {
  return (
    <nav aria-label="ตั้งค่า" className="flex flex-col md:hidden">
      {ROWS.map((row) => (
        <Link
          key={row.href}
          href={row.href}
          className="flex min-h-11 items-center gap-3 border-b border-border py-3"
        >
          <row.Icon size={20} className="shrink-0 text-text-2" />
          <span className="flex-1 text-sm">{row.label}</span>
          <CaretRight size={16} className="shrink-0 text-text-2" />
        </Link>
      ))}
    </nav>
  );
}
