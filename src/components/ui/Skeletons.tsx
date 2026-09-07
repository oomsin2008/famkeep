/*
  Route-level loading skeletons.

  Used in two places on purpose:
  - `loading.tsx` per route segment, so a client navigation to a dynamic route
    paints immediately instead of blocking on the server response.
  - the `now === null` hydration gate inside the views, so the initial page load
    does not collapse from a full-page skeleton into a small pulse box.

  No "use client": plain markup, valid in both server and client trees.
*/

function Block({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-standard bg-surface-muted ${className}`} />
  );
}

function Rows({ count, height }: { count: number; height: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: count }, (_, i) => (
        <Block key={i} className={height} />
      ))}
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-7">
      <section className="fk-panel p-6 md:p-8">
        <div className="flex items-center gap-4">
          <Block className="size-16 shrink-0 rounded-card" />
          <div className="min-w-0 flex-1">
            <Block className="h-7 w-48 max-w-full" />
            <Block className="mt-2 h-4 w-36 max-w-full" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3.5 md:grid-cols-4 md:gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="fk-stat flex items-center gap-3.5 p-4">
            <Block className="size-12 shrink-0" />
            <div className="min-w-0 flex-1">
              <Block className="h-6 w-9" />
              <Block className="mt-1.5 h-3.5 w-20 max-w-full" />
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-6 md:grid-cols-[1.35fr_1fr] md:gap-7">
        <section className="fk-card p-5 md:p-6">
          <Block className="mb-3 h-5 w-36" />
          <Rows count={4} height="h-[72px]" />
        </section>

        <section className="flex flex-col gap-6">
          <div className="fk-card p-5 md:p-6">
            <Block className="mb-3 h-5 w-28" />
            <Rows count={3} height="h-[64px]" />
          </div>
          <div className="fk-clay fk-clay-green h-28 rounded-card" />
        </section>
      </div>
    </div>
  );
}

export function TasksSkeleton() {
  return (
    <div className="pb-24 md:pb-0">
      <div className="mb-5">
        <Block className="h-11 w-60 max-w-full rounded-pill" />
        <Block className="mt-3.5 h-8 w-40" />
        <Block className="mt-2 h-4 w-64 max-w-full" />
      </div>
      <Rows count={6} height="h-[84px]" />
    </div>
  );
}

export function LockerSkeleton() {
  return (
    <div>
      <Block className="h-12 w-52 rounded-pill" />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Block className="h-8 w-36" />
          <Block className="mt-1.5 h-4 w-56 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Block className="h-12 w-36 rounded-pill" />
          <Block className="h-12 w-24 rounded-pill" />
        </div>
      </div>

      <div className="fk-card mt-5 hidden p-4 md:block">
        <Rows count={7} height="h-11" />
      </div>
      <div className="mt-5 md:hidden">
        <Rows count={5} height="h-[68px]" />
      </div>
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div>
      <Block className="h-9 w-32" />

      <div className="mt-6 md:grid md:grid-cols-[1.6fr_1fr] md:items-start md:gap-7">
        <div className="fk-panel hidden p-6 md:block">
          <Block className="h-7 w-44" />
          <div className="mt-5 grid grid-cols-7 gap-2">
            {Array.from({ length: 42 }, (_, i) => (
              <Block key={i} className="aspect-square" />
            ))}
          </div>
        </div>

        <div className="fk-card p-4 md:hidden">
          <Block className="h-7 w-40" />
          <div className="mt-4 grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }, (_, i) => (
              <Block key={i} className="h-14" />
            ))}
          </div>
        </div>

        <div className="mt-6 md:mt-0 md:fk-glass md:sticky md:top-24 md:rounded-panel md:p-5">
          <Block className="h-6 w-40" />
          <div className="mt-4">
            <Rows count={3} height="h-[72px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="fk-card p-5 md:p-6">
        <Block className="h-6 w-32" />
        <div className="mt-4">
          <Rows count={3} height="h-14" />
        </div>
      </div>
      <div className="fk-card p-5 md:p-6">
        <Block className="h-6 w-40" />
        <div className="mt-4">
          <Rows count={2} height="h-14" />
        </div>
      </div>
    </div>
  );
}
