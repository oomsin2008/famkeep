import { SignInNotice } from "@/components/auth/SignInNotice";
import { TaskDetailView } from "@/components/tasks/TaskDetailView";
import { requireUser } from "@/lib/auth/require-user";
import { getTaskDetail } from "@/lib/task-repository";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const gate = await requireUser();
  if (!gate.ok) return <SignInNotice reason={gate.reason} title="รายละเอียดงาน" />;

  const detail = await getTaskDetail(gate.supabase, id);
  if (!detail) {
    return <p className="py-10 text-sm text-text-2">ไม่พบงานนี้</p>;
  }

  return (
    <TaskDetailView
      key={detail.task.id}
      task={detail.task}
      familyMembers={detail.familyMembers}
    />
  );
}
