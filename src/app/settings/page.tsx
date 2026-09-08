import { SignInNotice } from "@/components/auth/SignInNotice";
import { GeneralSection } from "@/components/settings/GeneralSection";
import { SettingsDrilldownList } from "@/components/settings/SettingsDrilldownList";
import { getOwnProfile } from "@/lib/auth/profile";
import { requireUser } from "@/lib/auth/require-user";

export default async function SettingsPage() {
  const gate = await requireUser();
  if (!gate.ok) return <SignInNotice reason={gate.reason} title="ตั้งค่า" />;

  const profile = await getOwnProfile(gate.supabase, gate.user.id);

  return (
    <div className="flex flex-col gap-6">
      <GeneralSection
        displayName={profile.displayName}
        avatarUrl={profile.avatarUrl}
      />
      <SettingsDrilldownList />
    </div>
  );
}
