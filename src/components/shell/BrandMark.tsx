interface BrandMarkProps {
  /** Wordmark font size in px (defaults to 17, the desktop top-nav size). */
  size?: number;
}

/**
 * FamKeep logo lockup: a small claymorphic warm tile + wordmark.
 */
export function BrandMark({ size = 17 }: BrandMarkProps) {
  return (
    <span className="inline-flex items-center gap-2 text-text">
      <span
        aria-hidden
        className="bg-warm-gradient rounded-[11px] shadow-[0_8px_18px_-4px_rgba(120,86,54,0.4),inset_0_2px_3px_rgba(255,255,255,0.9),inset_0_-4px_8px_rgba(150,100,50,0.25)]"
        style={{ width: 24, height: 24 }}
      />
      <span className="font-bold tracking-tight" style={{ fontSize: size + 1 }}>
        FamKeep
      </span>
    </span>
  );
}
