import { FamilySection } from "@/components/settings/FamilySection";
import { getFamilyOverview } from "@/lib/family/family-workspace";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsFamilyPage() {
  if (!isSupabaseConfigured()) {
    return <FamilySection overview={null} configured={false} />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth
    .getUser()
    .catch(() => ({ data: { user: null } }));

  if (!user) {
    return <FamilySection overview={null} configured />;
  }

  const overview = await getFamilyOverview(supabase, user);

  return <FamilySection overview={overview} configured />;
}
