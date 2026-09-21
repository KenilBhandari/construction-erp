"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { MaterialDTO } from "@/types/inventory";

/** Compact low-stock watchlist for the Stock page and dashboard. */
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

  if (items === null) return <Skeleton className="h-28 w-full" />;
  if (items.length === 0) {
    return (
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">Low Stock</h2>
          <Badge tone="success">All stocked</Badge>
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Every material is above its minimum level.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text">Low Stock</h2>
        <Badge tone="warning">{items.length} item(s)</Badge>
      </div>
      <ul className="mt-3 divide-y divide-border">
        {items.map((m) => (
          <li key={m._id} className="flex items-center justify-between py-2 text-sm">
            <span className="font-medium text-text">{m.name}</span>
            <span className="tnum text-text-muted">
              {m.currentStock} / min {m.minimumStock} {m.unit}
            </span>
          </li>
        ))}
      </ul>
      <Link href="/dashboard/materials" className="mt-3 inline-block text-sm text-primary hover:underline">
        Manage materials
      </Link>
    </Card>
  );
}
