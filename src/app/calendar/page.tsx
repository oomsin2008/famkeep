import { SignInNotice } from "@/components/auth/SignInNotice";
import { CalendarView } from "@/components/calendar/CalendarView";
import { requireUser } from "@/lib/auth/require-user";
import { getAccessibleTasks } from "@/lib/task-repository";

export default async function CalendarPage() {
  const gate = await requireUser();
  if (!gate.ok) return <SignInNotice reason={gate.reason} title="ปฏิทิน" />;

  const tasks = await getAccessibleTasks(gate.supabase);
  return <CalendarView tasks={tasks} />;
}
