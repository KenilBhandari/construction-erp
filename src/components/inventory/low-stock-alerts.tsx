"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { MaterialDTO } from "@/types/inventory";

/** Low-stock items as narrow compact cards. Silent when all stocked. */
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
      <div className="grid max-w-sm grid-cols-2 gap-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-[68px] w-full" />
        ))}
      </div>
    );
  }
  if (items.length === 0) return null;

  return (
    <div className="flex max-w-sm flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-muted">Low stock — reorder soon</p>
        <Badge tone="warning" className="tnum">
          {items.length}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((m) => (
          <Card key={m._id} className="p-3">
            <p className="truncate text-xs text-text-muted">{m.name}</p>
            <p className="mt-0.5 text-lg font-semibold tnum text-warning">
              {m.currentStock}
              <span className="text-xs font-normal text-text-muted">
                {" "}
                / {m.minimumStock}
                {m.unit ? ` ${m.unit}` : ""}
              </span>
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
