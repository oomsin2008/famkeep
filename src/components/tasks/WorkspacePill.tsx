import type { Workspace } from "@/lib/types";
import { workspaceLabel } from "./presentation";

/** Ownership pill: fully rounded, context tint. Ownership only, never status. */
export function WorkspacePill({
  workspace,
  familyName,
}: {
  workspace: Workspace;
  familyName?: string;
}) {
  const tone =
    workspace === "private"
      ? "bg-private-tint text-private-press ring-private/20"
      : "bg-family-tint text-family-press ring-family/20";
  return (
    <span
      className={`inline-flex items-center rounded-pill px-3 py-1 text-[13px] font-semibold ring-1 ${tone}`}
    >
      {workspaceLabel(workspace, familyName)}
    </span>
  );
}
