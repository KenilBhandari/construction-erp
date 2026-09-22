import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Professional business table: sticky header, hover rows, right-align numbers with .tnum. */
export function Table({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("table-scroll overflow-x-auto border border-border rounded-lg bg-surface", className)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-background">{children}</thead>;
}

export function TH({
  children,
  className,
  numeric,
}: {
  children: ReactNode;
  className?: string;
  numeric?: boolean;
}) {
  return (
    <th
      className={cn(
        "sticky top-0 border-b border-border px-4 py-2.5 font-medium text-text-muted",
        numeric ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  className,
  numeric,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  numeric?: boolean;
  onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void;
}) {
  return (
    <td
      onClick={onClick}
      className={cn(
        "border-b border-border px-4 py-2.5 text-text last:border-b-0",
        numeric && "text-right tnum",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function TR({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLTableRowElement>) => void;
}) {
  return (
    <tr onClick={onClick} className={cn("hover:bg-background/70", className)}>
      {children}
    </tr>
  );
}
