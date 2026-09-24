"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  SiteForm,
  toSitePayload,
  type ProjectOption,
  type SiteFormValues,
} from "@/components/sites/site-form";
import { isoToDateInput } from "@/components/projects/project-form";
import type { SiteDTO } from "@/types/site";
import { siteProjectId } from "@/types/site";

export default function EditSitePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [initial, setInitial] = useState<SiteFormValues | null>(null);
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
        const [siteRes, projRes] = await Promise.all([
          fetch(`/api/sites/${id}`),
          fetch("/api/projects?limit=100"),
        ]);
        const siteJson = await siteRes.json();
        if (!siteRes.ok) throw new Error(siteJson.error ?? "Failed to load site.");
        const projJson = await projRes.json();
        if (projRes.ok && Array.isArray(projJson.data)) setProjects(projJson.data);
        const s = siteJson as SiteDTO;
        setInitial({
          name: s.name,
          project: siteProjectId(s),
          location: s.location ?? "",
          supervisor: s.supervisor ?? "",
          startDate: isoToDateInput(s.startDate),
          expectedEndDate: isoToDateInput(s.expectedEndDate),
          status: s.status,
          progress: String(s.progress),
          notes: s.notes ?? "",
        });
      } catch (err) {
        setLoadError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleSubmit(values: SiteFormValues) {
    if (!id) return;
    setPending(true);
    setServerError(null);
    try {
      const res = await fetch(`/api/sites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSitePayload(values)),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update site.");
      router.push(`/dashboard/sites/${id}`);
    } catch (err) {
      setServerError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Edit Site" />
      {loading && <TableSkeleton rows={5} />}
      {loadError && (
        <p role="alert" className="text-sm text-danger">{loadError}</p>
      )}
      {!loading && !loadError && initial && (
        <SiteForm
          initial={initial}
          projects={projects}
          pending={pending}
          serverError={serverError}
          submitLabel="Save Changes"
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
