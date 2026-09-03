"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/settings", label: "ทั่วไป" },
  { href: "/settings/family", label: "ครอบครัว" },
  { href: "/settings/line", label: "การเชื่อมต่อ LINE" },
  { href: "/settings/notifications", label: "การแจ้งเตือน" },
] as const;

/** Desktop-only section nav for /settings and its sub-routes. Mobile uses the drill-down list instead. */
export function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="ตั้งค่า"
      className="fk-glass sticky top-24 hidden shrink-0 flex-col gap-1 rounded-panel p-2.5 md:flex md:w-56"
    >
      {SECTIONS.map((section) => {
        const active = pathname === section.href;
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={[
              "min-h-11 rounded-standard px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-primary-soft font-semibold text-primary-strong"
                : "text-text-2 hover:bg-surface-muted hover:text-text",
            ].join(" ")}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
