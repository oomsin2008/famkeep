/*
  Sample identity data for Settings > General only (real profile arrives with a
  later Settings phase). Tasks, Files/Locker and LINE all use real data now.
*/
import type { FamilyMember } from "../types";

export const MOCK_MEMBERS: FamilyMember[] = [
  { id: "m1", displayName: "สมลักษณ์ ใจดี", initials: "สม", role: "owner" },
  { id: "m2", displayName: "สมชาย ใจดี", initials: "ชา", role: "member" },
  { id: "m3", displayName: "ใหม่ ใจดี", initials: "ใหม่", role: "member" },
  { id: "m4", displayName: "เก็บ ใจดี", initials: "เก็บ", role: "member" },
];

/** The signed-in member (auth arrives in Phase 7). */
export const MOCK_CURRENT_USER_ID = "m1";

/** Sample identity shown in Settings; replaced by the LINE Login profile later. */
export const MOCK_CURRENT_USER_EMAIL = "somlak.jaidee@example.com";
