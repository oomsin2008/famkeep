"use client";

import { useState, type ReactNode } from "react";
import { useCurrentUser } from "@/components/providers/CurrentUserProvider";

/** Top-nav profile picture: the user's LINE avatar, or `fallback` when there
 *  is no picture or it fails to load. */
export function NavAvatar({
  photoSize,
  fallback,
}: {
  photoSize: number;
  fallback: ReactNode;
}) {
  const { avatarUrl } = useCurrentUser();
  const [failed, setFailed] = useState(false);

  if (!avatarUrl || failed) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{ width: photoSize, height: photoSize }}
      className="rounded-full object-cover shadow-soft ring-1 ring-white/60"
    />
  );
}
