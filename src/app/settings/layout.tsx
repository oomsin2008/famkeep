import type { ReactNode } from "react";
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";

/** Desktop: sidebar + content, section chosen by route. Mobile: content only (drill-down/back is shell-level). */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
      <SettingsSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
