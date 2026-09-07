interface BrandMarkProps {
  /** Wordmark font size in px (defaults to 17, the desktop top-nav size). */
  size?: number;
}

/**
 * FamKeep logo lockup: the app icon + wordmark.
 */
export function BrandMark({ size = 17 }: BrandMarkProps) {
  const mark = size + 9;
  return (
    <span className="inline-flex items-center gap-2 text-text">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/famkeep-logo.jpg"
        alt=""
        aria-hidden
        width={mark}
        height={mark}
        className="rounded-[8px] shadow-soft ring-1 ring-black/5"
        style={{ width: mark, height: mark }}
      />
      <span className="font-bold tracking-tight" style={{ fontSize: size + 1 }}>
        FamKeep
      </span>
    </span>
  );
}
