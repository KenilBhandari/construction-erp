"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { MaterialDTO } from "@/types/inventory";

/** Low-stock items as one compact card with divided rows. Silent when all stocked. */
export function LowStockAlerts({ limit = 5 }: { limit?: number }) {
  const [items, setItems] = useState<MaterialDTO[] | null>(null);

  useEffect(() => {
    fetch(`/api/materials?lowStock=true&limit=${limit}&sort=stock`)
      .then(async (r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setItems(j.data);
      })
      .catch(() => setItems([]));
  }, [limit]);

  if (items === null) {
    return (
      <Card className="max-w-sm p-3">
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </Card>
    );
  }
  if (items.length === 0) return null;

  return (
    <Card className="max-w-sm">
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
        <p className="text-[13px] font-medium text-text sm:text-sm">Low stock</p>
        <Badge tone="warning" className="tnum shrink-0">
          {items.length}
        </Badge>
      </div>
      <ul className="mt-1 divide-y divide-border">
        {items.map((m) => (
          <li key={m._id} className="flex items-center justify-between gap-2 px-3 py-2">
            <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">
              {m.name}
            </p>
            <p className="shrink-0 text-[13px] font-semibold tnum text-warning">
              {m.currentStock}
              <span className="font-normal text-text-muted">
                {" "}
                / {m.minimumStock}
                {m.unit ? ` ${m.unit}` : ""}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
