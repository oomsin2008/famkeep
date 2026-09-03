/** Fixed decorative pastel blobs behind all content. Pure CSS, no image assets. */
export function BackdropBlobs() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <span className="fk-blob left-[-12%] top-[-10%] size-[46vw] bg-brand-peach" />
      <span className="fk-blob right-[-14%] top-[4%] size-[38vw] bg-[#c7dbfb]" />
      <span className="fk-blob bottom-[-16%] left-[26%] size-[48vw] bg-brand-mint" />
      <span className="fk-blob right-[8%] bottom-[6%] size-[26vw] bg-brand-lilac opacity-40" />
    </div>
  );
}
