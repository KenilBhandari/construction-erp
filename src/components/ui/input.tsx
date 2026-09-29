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
        <label htmlFor={inputId} className="text-[13px] font-medium text-text sm:text-sm">
          {label}
          {props.required && <span className="text-danger"> *</span>}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3.5 text-base text-text",
          "placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30",
          "sm:h-auto sm:px-3 sm:py-2 sm:text-sm",
          error && "border-danger",
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
