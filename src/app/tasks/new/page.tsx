import { SignInNotice } from "@/components/auth/SignInNotice";
import { CreateTaskForm } from "@/components/tasks/CreateTaskForm";
import { requireUser } from "@/lib/auth/require-user";
import { getTaskWorkspaceOptions } from "@/lib/task-repository";

export default async function CreateTaskPage() {
  const gate = await requireUser();
  if (!gate.ok) return <SignInNotice reason={gate.reason} title="สร้างงานใหม่" />;

  const workspaces = await getTaskWorkspaceOptions(gate.supabase, gate.user);
  return <CreateTaskForm workspaces={workspaces} />;
}
