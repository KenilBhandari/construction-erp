import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border border-border bg-surface rounded-lg",
        className,
      )}
    >
      {children}
    </div>
  );
}
