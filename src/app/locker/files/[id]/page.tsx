import Link from "next/link";
import { SignInNotice } from "@/components/auth/SignInNotice";
import { DeepLinkFileOpener } from "@/components/files/DeepLinkFileOpener";
import { LockerView } from "@/components/files/LockerView";
import { getFamilyOverview } from "@/lib/family/family-workspace";
import { getAccessibleFiles, getFileById } from "@/lib/file-repository";
import { requireUser } from "@/lib/auth/require-user";

/**
 * Deep link target for LINE save replies: /locker/files/<id>.
 * Requires login; access is RLS-checked. Renders the Locker with that file's
 * detail modal open, or a safe not-found message.
 */
export default async function LockerFilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const gate = await requireUser();
  if (!gate.ok) return <SignInNotice reason={gate.reason} />;

  const { id } = await params;
  const file = await getFileById(gate.supabase, gate.user, id);

  if (!file) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">คลังไฟล์</h1>
        <p className="rounded-standard border border-border bg-surface-muted p-4 text-sm text-text-2">
          ไม่พบไฟล์ หรือคุณไม่มีสิทธิ์เข้าถึง
        </p>
        <Link
          href="/locker"
          className="w-fit rounded-standard border border-border px-4 py-2 text-sm"
        >
          ไปที่คลังไฟล์
        </Link>
      </div>
    );
  }

  const [files, family] = await Promise.all([
    getAccessibleFiles(gate.supabase, gate.user),
    getFamilyOverview(gate.supabase, gate.user),
  ]);

  return (
    <>
      <DeepLinkFileOpener file={file} />
      <LockerView
        files={files}
        familyName={family.workspace?.name ?? null}
        familyMemberCount={family.members.length}
      />
    </>
  );
}
