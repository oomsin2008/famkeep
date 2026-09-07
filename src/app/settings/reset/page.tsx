import { SignInNotice } from "@/components/auth/SignInNotice";
import { ResetDataSection } from "@/components/settings/ResetDataSection";
import { requireUser } from "@/lib/auth/require-user";

export default async function SettingsResetPage() {
  const gate = await requireUser();
  if (!gate.ok) return <SignInNotice reason={gate.reason} title="ล้างข้อมูล" />;

  const [{ data: isOwner }, files, tasks] = await Promise.all([
    gate.supabase.rpc("is_family_owner"),
    gate.supabase
      .from("files")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null),
    gate.supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null),
  ]);

  return (
    <ResetDataSection
      isOwner={isOwner === true}
      fileCount={files.count ?? 0}
      taskCount={tasks.count ?? 0}
    />
  );
}
