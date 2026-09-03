import type { CSSProperties, ReactNode } from "react";

export type ClayTone =
  | "beige"
  | "blue"
  | "peach"
  | "mint"
  | "green"
  | "lilac"
  | "yellow";

const TONE_CLASS: Record<ClayTone, string> = {
  beige: "fk-clay",
  blue: "fk-clay fk-clay-blue",
  peach: "fk-clay fk-clay-peach",
  mint: "fk-clay fk-clay-mint",
  green: "fk-clay fk-clay-green",
  lilac: "fk-clay fk-clay-lilac",
  yellow: "fk-clay fk-clay-yellow",
};

/**
 * A 3D clay object tile: rounded pastel square with a soft inner highlight and
 * a warm bottom-right shadow. Pure CSS — wraps a Phosphor icon or short text.
 */
export function ClayTile({
  tone = "beige",
  size = 48,
  radius = 18,
  className = "",
  style,
  children,
}: {
  tone?: ClayTone;
  size?: number;
  radius?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${TONE_CLASS[tone]} ${className}`}
      style={{ width: size, height: size, borderRadius: radius, ...style }}
    >
      {children}
    </span>
  );
}
