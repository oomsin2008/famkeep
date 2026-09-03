import type { ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react";

interface FormFieldProps {
  /** When set, renders a real <label htmlFor> and an id'd error message — pass the same id to the field. */
  id?: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}

/** Label + control + inline field-specific error (readme §4: errors are per-field, not a banner). */
export function FormField({ id, label, required, error, children }: FormFieldProps) {
  const errorId = id ? `${id}-error` : undefined;
  const labelText = (
    <>
      {label}
      {required ? " *" : ""}
    </>
  );

  return (
    <div>
      {id ? (
        <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-text-2">
          {labelText}
        </label>
      ) : (
        <div className="mb-1.5 text-xs font-semibold text-text-2">{labelText}</div>
      )}
      {children}
      {error ? (
        <div
          id={errorId}
          role="alert"
          className="mt-1.5 flex items-center gap-1.5 text-xs text-status-overdue-text"
        >
          <WarningCircle size={13} />
          {error}
        </div>
      ) : null}
    </div>
  );
}
