import type { SupabaseClient } from "@supabase/supabase-js";

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
