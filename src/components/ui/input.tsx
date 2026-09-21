import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, className, ...props }: InputProps) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text">
          {label}
          {props.required && <span className="text-danger"> *</span>}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "rounded-md border border-border bg-surface px-3 py-2 text-sm text-text",
          "placeholder:text-text-muted focus:border-primary focus:outline-none",
          error && "border-danger",
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
