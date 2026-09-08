import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type RequireUserResult =
  | { ok: true; supabase: SupabaseClient; user: User }
  | { ok: false; reason: "unconfigured" | "signed_out" };

/** Server-only gate for pages that need an authenticated KitiButler user. */
export async function requireUser(): Promise<RequireUserResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, reason: "unconfigured" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  if (!user) {
    return { ok: false, reason: "signed_out" };
  }

  return { ok: true, supabase, user };
}
