import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { FileKind, FileView, Workspace } from "@/lib/types";

const DEPARTED_SAVER_LABEL = "สมาชิกที่ออกจากครอบครัวแล้ว";

const FILE_SELECT =
  "id, name, kind, size_bytes, saved_by_profile_id, saved_via_line, created_at, " +
  "workspace_id, workspaces!inner(type, name)";

interface RawFile {
  id: string;
  name: string;
  kind: FileKind;
  size_bytes: number | string | null;
  saved_by_profile_id: string;
  saved_via_line: boolean | null;
  created_at: string;
  workspace_id: string;
  workspaces: { type: Workspace; name: string } | null;
}

interface FamilyMemberListRow {
  profile_id: string | null;
  display_name: string | null;
  blocked_reason: string | null;
}

async function loadFamilyMemberNames(
  supabase: SupabaseClient,
  workspaceIds: string[],
): Promise<Map<string, Map<string, string>>> {
  const byWorkspace = new Map<string, Map<string, string>>();
  await Promise.all(
    workspaceIds.map(async (workspaceId) => {
      const { data } = await supabase.rpc("family_member_list", {
        p_workspace_id: workspaceId,
      });
      const names = new Map<string, string>();
      for (const row of (data as FamilyMemberListRow[] | null) ?? []) {
        if (row.profile_id && !row.blocked_reason) {
          names.set(row.profile_id, row.display_name?.trim() || "สมาชิกครอบครัว");
        }
      }
      byWorkspace.set(workspaceId, names);
    }),
  );
  return byWorkspace;
}

function toFileView(
  raw: RawFile,
  currentUserId: string,
  memberNames: Map<string, Map<string, string>>,
): FileView {
  const workspace: Workspace = raw.workspaces?.type ?? "private";
  const workspaceName =
    workspace === "family" ? (raw.workspaces?.name ?? "ครอบครัว") : "ของฉัน";

  let savedByName: string;
  if (workspace === "private" || raw.saved_by_profile_id === currentUserId) {
    savedByName = "คุณ";
  } else {
    savedByName =
      memberNames.get(raw.workspace_id)?.get(raw.saved_by_profile_id) ??
      DEPARTED_SAVER_LABEL;
  }

  return {
    id: raw.id,
    name: raw.name,
    kind: raw.kind,
    workspace,
    sizeBytes: Number(raw.size_bytes ?? 0),
    savedById: raw.saved_by_profile_id,
    savedViaLine: raw.saved_via_line === true,
    createdAt: raw.created_at,
    downloadUrl: null,
    savedByName,
    workspaceName,
  };
}

async function fetchFiles(
  supabase: SupabaseClient,
  user: User,
  limit?: number,
): Promise<FileView[]> {
  let query = supabase
    .from("files")
    .select(FILE_SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error || !data) return [];

  const rows = data as unknown as RawFile[];
  const familyWorkspaceIds = [
    ...new Set(
      rows
        .filter((r) => r.workspaces?.type === "family")
        .map((r) => r.workspace_id),
    ),
  ];
  const memberNames = await loadFamilyMemberNames(supabase, familyWorkspaceIds);
  return rows.map((row) => toFileView(row, user.id, memberNames));
}

/** Every file the current user can see (RLS-filtered), newest first. */
export function getAccessibleFiles(
  supabase: SupabaseClient,
  user: User,
): Promise<FileView[]> {
  return fetchFiles(supabase, user);
}

/** One file by id, RLS-filtered. `null` when it does not exist or the user
 *  cannot access it (indistinguishable, on purpose). */
export async function getFileById(
  supabase: SupabaseClient,
  user: User,
  id: string,
): Promise<FileView | null> {
  const { data, error } = await supabase
    .from("files")
    .select(FILE_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;

  const raw = data as unknown as RawFile;
  const memberNames = raw.workspaces?.type === "family"
    ? await loadFamilyMemberNames(supabase, [raw.workspace_id])
    : new Map<string, Map<string, string>>();
  return toFileView(raw, user.id, memberNames);
}

/** The most recently saved files across all accessible workspaces. */
export function getRecentFiles(
  supabase: SupabaseClient,
  user: User,
  limit: number,
): Promise<FileView[]> {
  return fetchFiles(supabase, user, limit);
}
