"use client";

import "react-datepicker/dist/react-datepicker.css";

import DatePicker from "react-datepicker";
import { Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function parseLocalDate(value: string): Date | null {
  if (!value) return null;

  const parts = value.split("-").map(Number);

  if (
    parts.length !== 3 ||
    parts.some((n) => Number.isNaN(n))
  ) {
    return null;
  }

  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(value: string): string {
  const date = parseLocalDate(value);

  if (!date) return "";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${day}/${month}/${date.getFullYear()}`;
}

type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;

  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;

  minDate?: string;
  maxDate?: string;

  placeholder?: string;

  variant?: "input" | "button";

  allowClear?: boolean;

  id?: string;
  name?: string;
  className?: string;

  "aria-label"?: string;
};

export function DateField({
  value,
  onChange,
  label,
  error,
  required,
  disabled,
  minDate,
  maxDate,
  placeholder = "Select date",
  variant = "input",
  allowClear,
  id,
  name,
  className,
  "aria-label": ariaLabel,
}: DateFieldProps) {
  const selected = parseLocalDate(value);

  const clearable =
    allowClear ?? (!required && Boolean(value));

  const handleChange = (date: Date | null) => {
    onChange(date ? formatLocalDate(date) : "");
  };

  /*
   * Old-project style:
   *
   * button/chip variant:
   * DatePicker -> customInput -> small button
   *
   * input variant:
   * DatePicker -> its normal input
   */
  const customButton =
    variant === "button" ? (
      <button
        type="button"
        className={cn(
          "flex items-center gap-2 rounded-md border border-slate-300",
          "bg-white px-3 py-1.5",
          "transition-colors hover:bg-slate-50",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
      >
        <Calendar
          size={12}
          className="shrink-0 text-slate-400"
        />

        <span className="text-[11px] font-bold tracking-wide text-slate-600 sm:text-xs">
          {value ? formatDisplayDate(value) : placeholder}
        </span>
      </button>
    ) : undefined;

  return (
    <div
      className={
        variant === "button"
          ? "relative inline-flex"
          : "relative flex flex-col gap-1"
      }
    >
      {label && variant === "input" && (
        <label
          htmlFor={id ?? name}
          className="text-[13px] font-medium text-text sm:text-sm"
        >
          {label}

          {required && (
            <span className="text-danger"> *</span>
          )}
        </label>
      )}

      <div className="relative">
<DatePicker
  id={id}
  name={name}
  selected={selected}
  onChange={handleChange}
  minDate={minDate ? parseLocalDate(minDate) ?? undefined : undefined}
  maxDate={maxDate ? parseLocalDate(maxDate) ?? undefined : undefined}
  dateFormat="dd/MM/yyyy"
  placeholderText={placeholder}
  disabled={disabled}
  calendarStartDay={1}
  popperPlacement="bottom-start"
  wrapperClassName={variant === "input" ? "w-full" : undefined}
  customInput={customButton}
  className={
    variant === "input"
      ? cn(
          "h-11 w-full rounded-md border border-border",
          "bg-surface px-3.5 text-base text-text outline-none",
          "focus:border-primary focus:ring-2 focus:ring-primary/30",
          "sm:h-auto sm:py-2 sm:text-sm",
          error && "border-danger",
          className,
        )
      : undefined
  }
/>

        {clearable && value && !disabled && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onChange("");
            }}
            aria-label={`Clear ${
              ariaLabel ?? label ?? "date"
            }`}
            className={
              variant === "button"
                ? [
                    "absolute -right-2 -top-2",
                    "flex h-4 w-4 items-center justify-center",
                    "rounded-full border border-border",
                    "bg-surface text-text-muted",
                    "shadow-sm",
                    "hover:bg-background hover:text-text",
                  ].join(" ")
                : [
                    "absolute right-2 top-1/2",
                    "-translate-y-1/2",
                    "rounded p-0.5",
                    "text-text-muted",
                    "hover:bg-background hover:text-text",
                  ].join(" ")
            }
          >
            <X size={variant === "button" ? 10 : 14} />
          </button>
        )}
      </div>

      {error && variant === "input" && (
        <p className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}