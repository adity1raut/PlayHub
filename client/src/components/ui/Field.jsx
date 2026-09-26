import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "../../lib/cn";

export const inputClass =
  "h-10 w-full border border-input bg-background/60 px-3 text-xs text-foreground placeholder:text-faint transition-[border-color,box-shadow] outline-none focus:border-primary/70 focus:shadow-[0_0_0_1px_var(--primary)] disabled:opacity-50 aria-invalid:border-destructive/70";

export function Label({ htmlFor, className, children }) {
  return (
    <label htmlFor={htmlFor} className={cn("eyebrow mb-2 block text-muted-foreground", className)}>
      {children}
    </label>
  );
}

function FieldShell({ id, label, hint, error, className, children }) {
  return (
    <div className={className}>
      {label && <Label htmlFor={id}>{label}</Label>}
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[11px] text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-[11px] text-faint">{hint}</p>
      )}
    </div>
  );
}

/** Labelled text input with optional leading icon and trailing slot. */
export const Input = forwardRef(function Input(
  { label, hint, error, icon: Icon, trailing, className, inputClassName, id, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={className}>
      <div className="relative flex items-center">
        {Icon && (
          <Icon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
          />
        )}
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className={cn(inputClass, Icon && "pl-9", trailing && "pr-10", inputClassName)}
          {...props}
        />
        {trailing && <div className="absolute top-1/2 right-1.5 -translate-y-1/2">{trailing}</div>}
      </div>
    </FieldShell>
  );
});

export function PasswordInput({ label = "Password", icon = Lock, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      label={label}
      icon={icon}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="flex size-8 items-center justify-center text-faint transition-colors hover:bg-accent hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
      {...props}
    />
  );
}

export const Textarea = forwardRef(function Textarea(
  { label, hint, error, className, inputClassName, id, rows = 4, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={className}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={cn(inputClass, "h-auto resize-y py-2.5 leading-relaxed", inputClassName)}
        {...props}
      />
    </FieldShell>
  );
});

export const Select = forwardRef(function Select(
  { label, hint, error, className, inputClassName, id, children, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={className}>
      <select
        ref={ref}
        id={fieldId}
        className={cn(inputClass, "appearance-none bg-background pr-8", inputClassName)}
        style={{
          backgroundImage:
            "linear-gradient(45deg, transparent 50%, var(--faint) 50%), linear-gradient(135deg, var(--faint) 50%, transparent 50%)",
          backgroundPosition: "calc(100% - 16px) 50%, calc(100% - 11px) 50%",
          backgroundSize: "5px 5px",
          backgroundRepeat: "no-repeat",
        }}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
});
