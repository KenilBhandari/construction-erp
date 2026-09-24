"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  ProjectForm,
  isoToDateInput,
  toProjectPayload,
  type ProjectFormValues,
} from "@/components/projects/project-form";
import type { ProjectDTO } from "@/types/project";

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [initial, setInitial] = useState<ProjectFormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const res = await fetch(`/api/projects/${id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load project.");
        const p = json as ProjectDTO;
        setInitial({
          name: p.name,
          clientName: p.clientName,
          clientPhone: p.clientPhone ?? "",
          location: p.location,
          startDate: isoToDateInput(p.startDate),
          expectedEndDate: isoToDateInput(p.expectedEndDate),
          budget: String(p.budget),
          contractValue: String(p.contractValue),
          status: p.status,
          progress: String(p.progress),
          description: p.description ?? "",
        });
      } catch (err) {
        setLoadError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleSubmit(values: ProjectFormValues) {
    if (!id) return;
    setPending(true);
    setServerError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toProjectPayload(values)),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update project.");
      router.push(`/dashboard/projects/${id}`);
    } catch (err) {
      setServerError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Edit Project" />
      {loading && <TableSkeleton rows={6} />}
      {loadError && (
        <p role="alert" className="text-sm text-danger">{loadError}</p>
      )}
      {!loading && !loadError && initial && (
        <ProjectForm
          initial={initial}
          pending={pending}
          serverError={serverError}
          submitLabel="Save Changes"
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
