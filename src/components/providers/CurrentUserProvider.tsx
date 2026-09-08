"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

interface CurrentUser {
  displayName: string | null;
  avatarUrl: string | null;
}

const CurrentUserContext = createContext<CurrentUser>({
  displayName: null,
  avatarUrl: null,
});

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}

/** Loads the signed-in user's own name + LINE avatar for the app chrome.
 *  Stays null when unconfigured or signed out; never throws. */
export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser>({
    displayName: null,
    avatarUrl: null,
  });

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;

    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (cancelled || !authUser) return;

        const { data } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", authUser.id)
          .maybeSingle();
        if (cancelled) return;

        setUser({
          displayName: (data?.display_name as string | null) ?? null,
          avatarUrl: (data?.avatar_url as string | null) ?? null,
        });
      } catch {
        // keep nulls; the chrome falls back to the generic icon
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CurrentUserContext.Provider value={user}>
      {children}
    </CurrentUserContext.Provider>
  );
}
