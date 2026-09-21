import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({ label, error, id, className, children, ...props }: SelectProps) {
  const selectId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-text">
          {label}
          {props.required && <span className="text-danger"> *</span>}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          "rounded-md border border-border bg-surface px-3 py-2 text-sm text-text",
          "focus:border-primary focus:outline-none",
          error && "border-danger",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
