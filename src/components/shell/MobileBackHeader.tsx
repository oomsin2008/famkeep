"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";
import { getDetailScreen, resolveBackHref, type DetailScreen } from "./nav-config";

function BackHeaderChrome({
  title,
  backHref,
}: {
  title: string;
  backHref: string;
}) {
  return (
    <header className="sticky top-0 z-40 flex items-center gap-1 border-b border-border bg-surface px-2 py-2 md:hidden">
      <Link
        href={backHref}
        aria-label="ย้อนกลับ"
        className="flex size-11 items-center justify-center text-text"
      >
        <ArrowLeft size={20} />
      </Link>
      <span className="text-base font-semibold">{title}</span>
    </header>
  );
}

function OriginAwareBackHeader({
  detail,
  pathname,
}: {
  detail: DetailScreen;
  pathname: string;
}) {
  const from = useSearchParams().get("from");
  return (
    <BackHeaderChrome
      title={detail.title}
      backHref={resolveBackHref(pathname, from) ?? detail.backHref}
    />
  );
}

/**
 * Back-arrow header for detail / sub-screens on mobile. Shown only below md.
 * Task detail resolves its back target from a validated `?from=` (home / tasks /
 * calendar); the Suspense fallback renders the fixed default while search params
 * hydrate, so there is no layout shift.
 */
export function MobileBackHeader() {
  const pathname = usePathname();
  const detail = getDetailScreen(pathname);
  if (!detail) return null;

  return (
    <Suspense
      fallback={
        <BackHeaderChrome title={detail.title} backHref={detail.backHref} />
      }
    >
      <OriginAwareBackHeader detail={detail} pathname={pathname} />
    </Suspense>
  );
}
