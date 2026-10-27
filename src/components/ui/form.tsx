import type { ComponentProps, ReactNode } from "react";

export const controlClass =
  "block w-full min-h-10 rounded-md border border-charcoal/30 bg-paper px-3 py-2 text-[15px] text-charcoal placeholder:text-muted/70 aria-[invalid=true]:border-oxblood";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-charcoal">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-oxblood">
          {error}
        </p>
      )}
    </div>
  );
}

export function describedBy(id: string, hint?: string, error?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export function Input({ className = "", ...rest }: ComponentProps<"input">) {
  return <input className={`${controlClass} ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }: ComponentProps<"select">) {
  return (
    <select className={`${controlClass} ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className = "", ...rest }: ComponentProps<"textarea">) {
  return <textarea className={`${controlClass} ${className}`} {...rest} />;
}

export function Checkbox({ id, label, error, ...rest }: ComponentProps<"input"> & { id: string; label: ReactNode; error?: string }) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <input id={id} type="checkbox" className="mt-1 h-4 w-4 accent-forest" aria-invalid={!!error} {...rest} />
        <label htmlFor={id} className="text-sm leading-snug text-charcoal">
          {label}
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-oxblood">
          {error}
        </p>
      )}
    </div>
  );
}
