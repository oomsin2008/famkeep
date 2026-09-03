import { useMemo, useSyncExternalStore } from "react";

/*
  Current time as a client-only value. The server snapshot is `null` so nothing
  time-dependent is prerendered (no hydration mismatch on status badges); once
  mounted it returns a Date that advances about once a minute.
*/

const TICK_MS = 20_000;

function subscribe(onChange: () => void): () => void {
  const id = setInterval(onChange, TICK_MS);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onChange);
  }
  return () => {
    clearInterval(id);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onChange);
    }
  };
}

// Minute bucket — stable between renders within the same minute.
const getClientSnapshot = () => Math.floor(Date.now() / 60_000);
const getServerSnapshot = () => null;

export function useClientNow(): Date | null {
  const minute = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  return useMemo(
    () => (minute === null ? null : new Date(minute * 60_000)),
    [minute],
  );
}
