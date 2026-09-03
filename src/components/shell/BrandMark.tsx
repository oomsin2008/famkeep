interface BrandMarkProps {
  /** Wordmark font size in px (defaults to 17, the desktop top-nav size). */
  size?: number;
}

/**
 * FamKeep logo lockup: brand-yellow tile + wordmark.
 * Note: the brand gradient is reserved for the Create Task CTA only, so the
 * tile uses the flat brand yellow (readme §2).
 */
export function BrandMark({ size = 17 }: BrandMarkProps) {
  return (
    <span className="inline-flex items-center gap-2 text-text">
      <span
        aria-hidden
        className="rounded-[6px] bg-brand-yellow"
        style={{ width: 18, height: 18 }}
      />
      <span className="font-semibold" style={{ fontSize: size }}>
        FamKeep
      </span>
    </span>
  );
}
