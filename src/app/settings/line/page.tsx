import { LineSection } from "@/components/settings/LineSection";
import { getSafeAuthStatus } from "@/lib/auth/safe-auth-status";
import {
  getLineConnectionStatus,
  type LineConnectionStatus,
} from "@/lib/line/line-connection";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsLinePage() {
  const authStatus = await getSafeAuthStatus();

  let lineConnection: LineConnectionStatus = {
    oneToOneLinked: false,
    workspaces: [],
  };
  if (isSupabaseConfigured() && authStatus.authenticated) {
    const supabase = await createClient();
    lineConnection = await getLineConnectionStatus(supabase);
  }

  return <LineSection authStatus={authStatus} lineConnection={lineConnection} />;
}
