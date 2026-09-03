import { SignInNotice } from "@/components/auth/SignInNotice";
import { HomeView } from "@/components/home/HomeView";
import { getOwnFirstName } from "@/lib/auth/profile";
import { requireUser } from "@/lib/auth/require-user";
import { getAccessibleTasks } from "@/lib/task-repository";
import { getAccessibleFiles } from "@/lib/file-repository";

export default async function HomePage() {
  const gate = await requireUser();
  if (!gate.ok) return <SignInNotice reason={gate.reason} />;

  const [tasks, files, greetingName] = await Promise.all([
    getAccessibleTasks(gate.supabase),
    getAccessibleFiles(gate.supabase, gate.user),
    getOwnFirstName(gate.supabase, gate.user.id),
  ]);

  return <HomeView tasks={tasks} files={files} greetingName={greetingName} />;
}
