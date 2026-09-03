import type { FamilyRole } from "@/lib/types";

export interface FamilyMemberRow {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  role: FamilyRole;
  joinedAt: string;
  isSelf: boolean;
}

export interface FamilyOverview {
  workspace: { id: string; name: string } | null;
  myRole: FamilyRole | null;
  members: FamilyMemberRow[];
  issue: string | null;
}

export interface FamilyActionState {
  ok: boolean;
  error: string | null;
}

export const FAMILY_ACTION_IDLE: FamilyActionState = { ok: false, error: null };

export function memberInitials(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return "?";
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return trimmed.slice(0, 2);
}
