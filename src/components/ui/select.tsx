import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
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
        <label htmlFor={selectId} className="text-[13px] font-medium text-text sm:text-sm">
          {label}
          {props.required && <span className="text-danger"> *</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            "h-11 w-full min-w-0 appearance-none rounded-md border border-border bg-surface pl-3.5 pr-10 text-base text-text",
            "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30",
            "sm:h-auto sm:w-auto sm:appearance-auto sm:py-2 sm:pl-3 sm:pr-3 sm:text-sm",
            error && "border-danger",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted sm:hidden"
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
