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
        <label htmlFor={textareaId} className="text-sm font-medium text-text">
          {label}
          {props.required && <span className="text-danger"> *</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={3}
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
