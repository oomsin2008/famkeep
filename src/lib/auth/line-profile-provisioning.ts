import type { SupabaseClient, User } from "@supabase/supabase-js";

export interface SafeProfileProvisioningStatus {
  profileProvisioned: boolean;
  profileIdMatchesAuthUser: boolean;
  profileLineUserIdMatchesLineSub: boolean;
  profileProvisioningIssue: string | null;
}

interface ProvisionCurrentLineProfileRow {
  profile_provisioned: boolean | null;
  profile_id_matches_auth_user: boolean | null;
  profile_line_user_id_matches_line_sub: boolean | null;
  blocked_reason: string | null;
}

const NOT_PROVISIONED: SafeProfileProvisioningStatus = {
  profileProvisioned: false,
  profileIdMatchesAuthUser: false,
  profileLineUserIdMatchesLineSub: false,
  profileProvisioningIssue: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function getVerifiedLineSubPath(user: User) {
  const identityData = user.identities?.[0]?.identity_data;

  if (!isRecord(identityData)) {
    return null;
  }

  return safeString(identityData.sub)
    ? "user.identities[0].identity_data.sub"
    : null;
}

function getSafeRpcIssue(error: { code?: string; message?: string } | null) {
  if (!error) {
    return null;
  }

  const message = error.message?.toLowerCase() ?? "";

  if (error.code === "42501" || message.includes("permission")) {
    return "profile_permission_denied";
  }

  if (error.code === "PGRST202" || message.includes("function")) {
    return "profile_provisioning_rpc_missing";
  }

  return "profile_provisioning_failed";
}

function normalizeProvisioningRow(
  row: ProvisionCurrentLineProfileRow | null | undefined,
): SafeProfileProvisioningStatus {
  if (!row) {
    return {
      ...NOT_PROVISIONED,
      profileProvisioningIssue: "profile_provisioning_no_result",
    };
  }

  return {
    profileProvisioned: row.profile_provisioned === true,
    profileIdMatchesAuthUser: row.profile_id_matches_auth_user === true,
    profileLineUserIdMatchesLineSub:
      row.profile_line_user_id_matches_line_sub === true,
    profileProvisioningIssue: row.blocked_reason,
  };
}

export async function provisionCurrentLineProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<SafeProfileProvisioningStatus> {
  if (!getVerifiedLineSubPath(user)) {
    return {
      ...NOT_PROVISIONED,
      profileProvisioningIssue: "missing_line_sub",
    };
  }

  let response:
    | Awaited<ReturnType<typeof supabase.rpc>>
    | {
        data: null;
        error: { message: string };
      };

  try {
    response = await supabase.rpc("provision_current_line_profile");
  } catch {
    response = {
      data: null,
      error: { message: "Profile provisioning RPC failed" },
    };
  }

  const { data, error } = response;

  const safeIssue = getSafeRpcIssue(error);

  if (safeIssue) {
    return {
      ...NOT_PROVISIONED,
      profileProvisioningIssue: safeIssue,
    };
  }

  const row = Array.isArray(data)
    ? (data[0] as ProvisionCurrentLineProfileRow | undefined)
    : (data as ProvisionCurrentLineProfileRow | null);

  return normalizeProvisioningRow(row);
}
