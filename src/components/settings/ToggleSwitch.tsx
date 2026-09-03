"use client";

/** Accessible on/off switch: native <button role="switch">, Space/Enter work for free. */
export function ToggleSwitch({
  id,
  labelledBy,
  checked,
  onChange,
}: {
  id?: string;
  /** id of the visible <label> naming this switch (buttons get no accessible name from content alone). */
  labelledBy: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 min-w-11 shrink-0 items-center justify-center"
    >
      <span
        className={[
          "relative inline-flex h-6 w-10 items-center rounded-pill transition-colors",
          checked ? "bg-private" : "bg-border",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block size-[18px] rounded-full bg-surface transition-transform",
            checked ? "translate-x-[19px]" : "translate-x-[3px]",
          ].join(" ")}
        />
      </span>
    </button>
  );
}
