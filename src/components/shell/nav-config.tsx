import {
  CalendarBlank,
  CheckSquare,
  Folders,
  House,
  type Icon,
} from "@phosphor-icons/react";
import type { Workspace } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  Icon: Icon;
}

/** The four primary areas, in display order (desktop top nav + mobile bottom nav). */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "หน้าหลัก", Icon: House },
  { href: "/locker", label: "คลังไฟล์", Icon: Folders },
  { href: "/tasks", label: "งาน", Icon: CheckSquare },
  { href: "/calendar", label: "ปฏิทิน", Icon: CalendarBlank },
];

/**
 * Nav accent colour. Inside Locker it follows the active workspace tab
 * (Private = blue, Family = coral); everywhere else it is Private blue.
 */
export function navAccent(
  pathname: string,
  lockerTab: Workspace,
): "private" | "family" {
  const inLocker = pathname === "/locker" || pathname.startsWith("/locker/");
  return inLocker && lockerTab === "family" ? "family" : "private";
}

/** Which primary nav item (if any) is active for a given pathname. */
export function getActiveNavHref(pathname: string): string | null {
  if (pathname === "/") return "/";
  if (pathname === "/locker" || pathname.startsWith("/locker/")) return "/locker";
  if (pathname === "/tasks" || pathname.startsWith("/tasks/")) return "/tasks";
  if (pathname === "/calendar" || pathname.startsWith("/calendar/")) return "/calendar";
  // /settings and its sub-screens have no primary nav item active.
  return null;
}

export interface DetailScreen {
  title: string;
  backHref: string;
}

/** Screens a task detail can be opened from. */
export type TaskOrigin = "home" | "tasks" | "calendar";

const TASK_ORIGIN_HREF: Record<TaskOrigin, string> = {
  home: "/",
  tasks: "/tasks",
  calendar: "/calendar",
};

const TASK_ORIGINS = Object.keys(TASK_ORIGIN_HREF) as TaskOrigin[];

/** Validate a `?from=` value; anything unknown or missing falls back to "tasks". */
export function resolveTaskOrigin(from: string | null | undefined): TaskOrigin {
  return TASK_ORIGINS.includes(from as TaskOrigin) ? (from as TaskOrigin) : "tasks";
}

/**
 * Back-arrow target for a detail / sub-screen. On task detail it honours a
 * validated `?from=`; elsewhere it uses the screen's fixed back target.
 */
export function resolveBackHref(
  pathname: string,
  from: string | null,
): string | null {
  if (pathname === "/tasks/new") return "/tasks";
  if (/^\/tasks\/[^/]+$/.test(pathname)) {
    return TASK_ORIGIN_HREF[resolveTaskOrigin(from)];
  }
  return getDetailScreen(pathname)?.backHref ?? null;
}

/**
 * Detail / sub-screen routes: mobile hides the bottom nav and shows a back-arrow
 * header; desktop keeps the normal top nav. Returns null for top-level screens.
 */
export function getDetailScreen(pathname: string): DetailScreen | null {
  if (pathname === "/tasks/new") {
    return { title: "สร้างงานใหม่", backHref: "/tasks" };
  }
  if (/^\/tasks\/[^/]+$/.test(pathname)) {
    // Any /tasks/<id>; origin-aware back (tasks vs calendar) comes with Task state later.
    return { title: "รายละเอียดงาน", backHref: "/tasks" };
  }
  if (pathname === "/settings/family") {
    return { title: "ครอบครัว", backHref: "/settings" };
  }
  if (pathname === "/settings/line") {
    return { title: "การเชื่อมต่อ LINE", backHref: "/settings" };
  }
  if (pathname === "/settings/notifications") {
    return { title: "การแจ้งเตือน", backHref: "/settings" };
  }
  if (pathname === "/settings/reset") {
    return { title: "ล้างข้อมูล", backHref: "/settings" };
  }
  return null;
}
