import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  className,
}: {
  value: number; // 0-100
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("h-2 w-full rounded-full bg-border/70", className)}>
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
