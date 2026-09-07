import type { SupabaseClient } from "@supabase/supabase-js";

export interface OwnProfile {
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
}

/** The current user's own profile row (RLS: profiles_select_own). */
export async function getOwnProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<OwnProfile> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name, email, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  return {
    displayName: (data?.display_name as string | null | undefined)?.trim() || "",
    email: (data?.email as string | null | undefined) ?? null,
    avatarUrl: (data?.avatar_url as string | null | undefined) ?? null,
  };
}

/** The current user's own display name (RLS: profiles_select_own). First word only. */
export async function getOwnFirstName(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  const displayName = (data?.display_name as string | null | undefined)?.trim();
  return displayName ? displayName.split(/\s+/)[0] : "";
}
