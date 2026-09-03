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
          "relative inline-flex h-6 w-10 items-center rounded-pill shadow-[inset_0_1px_3px_rgba(96,72,48,0.18)] transition-colors",
          checked ? "bg-primary" : "bg-border",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block size-[18px] rounded-full bg-white shadow-[0_2px_6px_rgba(96,72,48,0.25)] transition-transform",
            checked ? "translate-x-[19px]" : "translate-x-[3px]",
          ].join(" ")}
        />
      </span>
    </button>
  );
}
