"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { IconContext } from "@phosphor-icons/react";
import { DesktopTopNav } from "./DesktopTopNav";
import { MobileBackHeader } from "./MobileBackHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileTopHeader } from "./MobileTopHeader";
import { getDetailScreen } from "./nav-config";

/**
 * App chrome shared by every route.
 * - Desktop (md+): persistent top nav on all screens.
 * - Mobile: plain brand header + bottom tab bar on top-level screens; on detail
 *   / sub-screens the bottom nav is hidden and a back-arrow header is shown.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const detail = getDetailScreen(pathname);

  return (
    <IconContext.Provider value={{ weight: "duotone" }}>
      <DesktopTopNav />
      {detail ? <MobileBackHeader /> : <MobileTopHeader />}

      <main className="mx-auto w-full max-w-[1080px] flex-1 px-4 py-6 md:px-7 md:py-8">
        {children}
      </main>

      {detail ? null : <MobileBottomNav />}
    </IconContext.Provider>
  );
}
