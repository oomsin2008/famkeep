import type { SupabaseClient } from "@supabase/supabase-js";

export interface LineWorkspaceConnection {
  workspaceId: string;
  workspaceName: string | null;
  isOwner: boolean;
  groupBound: boolean;
  groupLabel: string | null;
  boundConversationId: string | null;
  pendingConversationId: string | null;
  pendingGroupLabel: string | null;
}

export interface LineConnectionStatus {
  oneToOneLinked: boolean;
  workspaces: LineWorkspaceConnection[];
}

interface StatusRow {
  one_to_one_linked: boolean | null;
  workspace_id: string | null;
  workspace_name: string | null;
  is_owner: boolean | null;
  group_bound: boolean | null;
  group_label: string | null;
  bound_conversation_id: string | null;
  pending_conversation_id: string | null;
  pending_group_label: string | null;
}

export async function getLineConnectionStatus(
  supabase: SupabaseClient,
): Promise<LineConnectionStatus> {
  const { data, error } = await supabase.rpc("get_line_connection_status");

  if (error || !Array.isArray(data) || data.length === 0) {
    return { oneToOneLinked: false, workspaces: [] };
  }

  const rows = data as StatusRow[];
  return {
    oneToOneLinked: rows.some((r) => r.one_to_one_linked === true),
    workspaces: rows
      .filter((r): r is StatusRow & { workspace_id: string } => Boolean(r.workspace_id))
      .map((r) => ({
        workspaceId: r.workspace_id,
        workspaceName: r.workspace_name,
        isOwner: r.is_owner === true,
        groupBound: r.group_bound === true,
        groupLabel: r.group_label,
        boundConversationId: r.bound_conversation_id,
        pendingConversationId: r.pending_conversation_id,
        pendingGroupLabel: r.pending_group_label,
      })),
  };
}
