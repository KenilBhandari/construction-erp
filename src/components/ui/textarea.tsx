import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, id, className, ...props }: TextareaProps) {
  const textareaId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={textareaId} className="text-[13px] font-medium text-text sm:text-sm">
          {label}
          {props.required && <span className="text-danger"> *</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={3}
        className={cn(
          "w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-base text-text",
          "placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30",
          "sm:px-3 sm:py-2 sm:text-sm",
          error && "border-danger",
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
