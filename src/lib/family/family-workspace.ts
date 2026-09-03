import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { FamilyRole } from "@/lib/types";
import type { FamilyMemberRow, FamilyOverview } from "./model";

interface FamilyMemberListRow {
  profile_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: FamilyRole | null;
  joined_at: string | null;
  blocked_reason: string | null;
}

const EMPTY: FamilyOverview = {
  workspace: null,
  myRole: null,
  members: [],
  issue: null,
};

export async function getFamilyOverview(
  supabase: SupabaseClient,
  user: User,
): Promise<FamilyOverview> {
  // MVP assumes a user belongs to at most one family workspace. If more ever
  // exist, this deterministically shows the earliest-created one rather than
  // an arbitrary row.
  const { data: workspaces, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("type", "family")
    .order("created_at", { ascending: true })
    .limit(1);

  if (workspaceError) {
    return { ...EMPTY, issue: "family_workspace_load_failed" };
  }

  const workspace = workspaces?.[0];
  if (!workspace) {
    return EMPTY;
  }

  const found = { id: workspace.id as string, name: workspace.name as string };

  const { data, error: listError } = await supabase.rpc("family_member_list", {
    p_workspace_id: found.id,
  });

  if (listError) {
    return { workspace: found, myRole: null, members: [], issue: "family_member_list_failed" };
  }

  const rows: FamilyMemberListRow[] = Array.isArray(data) ? data : [];
  const blocked = rows.find((row) => row.blocked_reason);
  if (blocked?.blocked_reason) {
    return { workspace: found, myRole: null, members: [], issue: blocked.blocked_reason };
  }

  const members: FamilyMemberRow[] = rows
    .filter((row): row is FamilyMemberListRow & { profile_id: string; role: FamilyRole } =>
      Boolean(row.profile_id) && (row.role === "owner" || row.role === "member"),
    )
    .map((row) => ({
      profileId: row.profile_id,
      displayName: row.display_name?.trim() || "สมาชิกครอบครัว",
      avatarUrl: row.avatar_url ?? null,
      role: row.role,
      joinedAt: row.joined_at ?? "",
      isSelf: row.profile_id === user.id,
    }));

  const myRole = members.find((member) => member.isSelf)?.role ?? null;

  return { workspace: found, myRole, members, issue: null };
}
