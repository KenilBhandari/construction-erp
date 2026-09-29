import { Card } from "./card";

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="min-w-0 p-3 sm:p-4">
      <p className="truncate text-xs text-text-muted sm:text-sm">{label}</p>
      <p className="mt-0.5 truncate text-lg font-semibold tnum text-text sm:mt-1 sm:text-2xl">{value}</p>
      {hint && <p className="mt-0.5 hidden truncate text-[11px] text-text-muted sm:mt-1 sm:block sm:text-xs">{hint}</p>}
    </Card>
  );
}
