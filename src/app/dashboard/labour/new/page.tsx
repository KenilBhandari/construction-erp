"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  LabourForm,
  emptyLabourForm,
  toLabourCreatePayload,
  type LabourFormValues,
  type SiteOption,
} from "@/components/labour/labour-form";

export default function NewLabourPage() {
  const router = useRouter();
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sites?limit=100")
      .then(async (res) => {
        const json = await res.json();
        if (res.ok && Array.isArray(json.data)) setSites(json.data);
      })
      .catch(() => {})
      .finally(() => setLoadingSites(false));
  }, []);

  async function handleSubmit(values: LabourFormValues) {
    setPending(true);
    setServerError(null);
    try {
      const res = await fetch("/api/labour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toLabourCreatePayload(values)),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to register labour.");
      router.push(`/dashboard/labour/${json._id}`);
    } catch (err) {
      setServerError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Add Labour" />
      {loadingSites ? (
        <TableSkeleton rows={4} />
      ) : (
        <LabourForm
          initial={emptyLabourForm()}
          sites={sites}
          mode="create"
          pending={pending}
          serverError={serverError}
          submitLabel="Add Labour"
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
