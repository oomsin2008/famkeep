import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  getVerifiedLineSubPath,
  provisionCurrentLineProfile,
  type SafeProfileProvisioningStatus,
} from "@/lib/auth/line-profile-provisioning";

export interface SafeAuthStatus extends SafeProfileProvisioningStatus {
  supabaseConfigured: boolean;
  authenticated: boolean;
  userId: string | null;
  providerName: string | null;
  lineOidcSubFound: boolean;
  lineOidcSubPath: string | null;
  error: string | null;
}

const NOT_PROVISIONED: SafeProfileProvisioningStatus = {
  profileProvisioned: false,
  profileIdMatchesAuthUser: false,
  profileLineUserIdMatchesLineSub: false,
  profileProvisioningIssue: null,
};

function getProviderName(user: User): string | null {
  const identityProvider = user.identities?.find((identity) =>
    identity.provider.toLowerCase().includes("line"),
  )?.provider;

  if (identityProvider) {
    return identityProvider;
  }

  const metadataProvider = user.app_metadata?.provider;
  return typeof metadataProvider === "string" ? metadataProvider : null;
}

export async function getSafeAuthStatus(): Promise<SafeAuthStatus> {
  if (!isSupabaseConfigured()) {
    return {
      supabaseConfigured: false,
      authenticated: false,
      userId: null,
      providerName: null,
      lineOidcSubFound: false,
      lineOidcSubPath: null,
      error: null,
      ...NOT_PROVISIONED,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser().catch(() => ({
    data: { user: null },
    error: new Error("Auth status check failed"),
  }));

  if (error) {
    return {
      supabaseConfigured: true,
      authenticated: false,
      userId: null,
      providerName: null,
      lineOidcSubFound: false,
      lineOidcSubPath: null,
      error: "ไม่สามารถตรวจสอบสถานะเข้าสู่ระบบได้",
      ...NOT_PROVISIONED,
    };
  }

  if (!user) {
    return {
      supabaseConfigured: true,
      authenticated: false,
      userId: null,
      providerName: null,
      lineOidcSubFound: false,
      lineOidcSubPath: null,
      error: null,
      ...NOT_PROVISIONED,
    };
  }

  const lineOidcSubPath = getVerifiedLineSubPath(user);
  const profileProvisioning = await provisionCurrentLineProfile(supabase, user);

  return {
    supabaseConfigured: true,
    authenticated: true,
    userId: user.id,
    providerName: getProviderName(user),
    lineOidcSubFound: lineOidcSubPath !== null,
    lineOidcSubPath,
    error: null,
    ...profileProvisioning,
  };
}
