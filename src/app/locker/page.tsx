import { SignInNotice } from "@/components/auth/SignInNotice";
import { LockerView } from "@/components/files/LockerView";
import { getFamilyOverview } from "@/lib/family/family-workspace";
import { getAccessibleFiles } from "@/lib/file-repository";
import { requireUser } from "@/lib/auth/require-user";

export default async function LockerPage() {
  const gate = await requireUser();
  if (!gate.ok) return <SignInNotice reason={gate.reason} />;

  const [files, family] = await Promise.all([
    getAccessibleFiles(gate.supabase, gate.user),
    getFamilyOverview(gate.supabase, gate.user),
  ]);

  return (
    <LockerView
      files={files}
      familyName={family.workspace?.name ?? null}
      familyMemberCount={family.members.length}
    />
  );
}
