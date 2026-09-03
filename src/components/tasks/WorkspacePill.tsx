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
      ? "bg-private-tint text-private-press"
      : "bg-family-tint text-family-press";
  return (
    <span
      className={`inline-flex items-center rounded-pill px-3 py-1.5 text-xs font-semibold ${tone}`}
    >
      {workspaceLabel(workspace, familyName)}
    </span>
  );
}
