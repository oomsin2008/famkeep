import { SignInNotice } from "@/components/auth/SignInNotice";
import { TasksView } from "@/components/tasks/TasksView";
import { requireUser } from "@/lib/auth/require-user";
import { getAccessibleTasks } from "@/lib/task-repository";

export default async function TasksPage() {
  const gate = await requireUser();
  if (!gate.ok) return <SignInNotice reason={gate.reason} title="งาน" />;

  const tasks = await getAccessibleTasks(gate.supabase);
  return <TasksView tasks={tasks} />;
}
