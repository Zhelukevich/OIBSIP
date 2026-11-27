import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from "react";

export const fieldControlClass = "block min-h-11 w-full rounded-inputs border border-control bg-white px-3 py-2 text-body-lg focus-visible:border-action focus-visible:outline-offset-1 aria-invalid:border-danger";

type FieldProps = ComponentPropsWithoutRef<"input"> & {
  label: string;
  error?: string;
  hint?: string;
  endAdornment?: ReactNode;
};

export const FormField = forwardRef<HTMLInputElement, FieldProps>(function FormField({
  label, error, hint, endAdornment, id, className = "", "aria-describedby": describedBy, ...props
}, ref) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = error || hint ? `${inputId}-message` : undefined;

  return (
    <div className="min-w-0">
      <label htmlFor={inputId} className="mb-1.5 block font-bold">{label}</label>
      <div className="relative">
        <input
          {...props}
          ref={ref}
          id={inputId}
          className={`${fieldControlClass} ${endAdornment ? "pe-17" : ""} ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={[describedBy, messageId].filter(Boolean).join(" ") || undefined}
        />
        {endAdornment}
      </div>
      {messageId && (
        <p id={messageId} role={error ? "alert" : undefined} className={`mt-1 text-sm ${error ? "text-danger" : "text-muted"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
