import type { ReactNode } from "react";
import { Card } from "./card";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center px-6 py-12 text-center">
      <h2 className="text-base font-semibold text-text">{title}</h2>
      {description && (
        <p className="mt-1 max-w-sm text-sm leading-6 text-text-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}
