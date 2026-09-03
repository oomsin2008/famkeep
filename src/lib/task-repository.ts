import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getFamilyOverview } from "@/lib/family/family-workspace";
import type {
  ReminderPreset,
  TaskLifecycleStatus,
  TaskReminder,
  TaskView,
  Workspace,
} from "@/lib/types";

const DEPARTED_ASSIGNEE_LABEL = "สมาชิกที่ออกจากครอบครัวแล้ว";

const TASK_SELECT =
  "id, title, notes, assignee_profile_id, due_at, lifecycle_status, created_at, updated_at, " +
  "workspace_id, workspaces!inner(type, name), " +
  "task_reminders(id, slot, preset, scheduled_at, sent_at)";

interface RawReminder {
  id: string;
  slot: number | null;
  preset: ReminderPreset;
  scheduled_at: string;
  sent_at: string | null;
}

interface RawTask {
  id: string;
  title: string;
  notes: string | null;
  assignee_profile_id: string | null;
  due_at: string;
  lifecycle_status: TaskLifecycleStatus;
  created_at: string;
  updated_at: string;
  workspace_id: string;
  workspaces: { type: Workspace; name: string } | null;
  task_reminders: RawReminder[] | null;
}

interface FamilyMemberListRow {
  profile_id: string | null;
  display_name: string | null;
  blocked_reason: string | null;
}

export interface TaskFamilyMember {
  profileId: string;
  displayName: string;
}

export interface TaskWorkspaceOptions {
  privateWorkspaceId: string | null;
  family: { id: string; name: string; members: TaskFamilyMember[] } | null;
}

function toReminders(raw: RawReminder[] | null): TaskReminder[] {
  return [...(raw ?? [])]
    .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
    .map((r) => ({
      id: r.id,
      preset: r.preset,
      scheduledAt: r.scheduled_at,
      sentAt: r.sent_at,
    }));
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

function toTaskView(
  raw: RawTask,
  memberNames: Map<string, Map<string, string>>,
): TaskView {
  const workspace: Workspace = raw.workspaces?.type ?? "private";
  const workspaceName =
    workspace === "family" ? (raw.workspaces?.name ?? "ครอบครัว") : "ของฉัน";

  let assigneeName: string | null = null;
  if (workspace === "family" && raw.assignee_profile_id) {
    assigneeName =
      memberNames.get(raw.workspace_id)?.get(raw.assignee_profile_id) ??
      DEPARTED_ASSIGNEE_LABEL;
  }

  return {
    id: raw.id,
    title: raw.title,
    notes: raw.notes ?? "",
    workspace,
    assigneeId: raw.assignee_profile_id,
    dueAt: raw.due_at,
    lifecycleStatus: raw.lifecycle_status,
    reminders: toReminders(raw.task_reminders),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    assigneeName,
    workspaceName,
  };
}

/** Every task the current user can see (RLS-filtered), oldest due first. */
export async function getAccessibleTasks(
  supabase: SupabaseClient,
): Promise<TaskView[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .is("deleted_at", null)
    .order("due_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  const rows = data as unknown as RawTask[];
  const familyWorkspaceIds = [
    ...new Set(
      rows
        .filter((r) => r.workspaces?.type === "family" && r.assignee_profile_id)
        .map((r) => r.workspace_id),
    ),
  ];
  const memberNames = await loadFamilyMemberNames(supabase, familyWorkspaceIds);

  return rows.map((row) => toTaskView(row, memberNames));
}

export interface TaskDetail {
  task: TaskView;
  familyMembers: TaskFamilyMember[];
}

/** One task plus, for family tasks, its workspace's member list (assignee picker). */
export async function getTaskDetail(
  supabase: SupabaseClient,
  taskId: string,
): Promise<TaskDetail | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const raw = data as unknown as RawTask;
  const isFamily = raw.workspaces?.type === "family";

  const memberNames = isFamily
    ? await loadFamilyMemberNames(supabase, [raw.workspace_id])
    : new Map<string, Map<string, string>>();

  const familyMembers: TaskFamilyMember[] = isFamily
    ? [...(memberNames.get(raw.workspace_id)?.entries() ?? [])].map(
        ([profileId, displayName]) => ({ profileId, displayName }),
      )
    : [];

  return { task: toTaskView(raw, memberNames), familyMembers };
}

/** Workspaces the user can create a task in: their private one, and their family (if any). */
export async function getTaskWorkspaceOptions(
  supabase: SupabaseClient,
  user: User,
): Promise<TaskWorkspaceOptions> {
  const [{ data: privateRows }, family] = await Promise.all([
    supabase.from("workspaces").select("id").eq("type", "private").limit(1),
    getFamilyOverview(supabase, user),
  ]);

  return {
    privateWorkspaceId: (privateRows?.[0]?.id as string | undefined) ?? null,
    family: family.workspace
      ? {
          id: family.workspace.id,
          name: family.workspace.name,
          members: family.members.map((m) => ({
            profileId: m.profileId,
            displayName: m.displayName,
          })),
        }
      : null,
  };
}
