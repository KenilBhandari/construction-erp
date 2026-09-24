"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  SiteForm,
  toSitePayload,
  type ProjectOption,
  type SiteFormValues,
} from "@/components/sites/site-form";
import { toDateInputValue } from "@/lib/utils";

function NewSiteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProject = searchParams.get("project") ?? "";

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch("/api/projects?limit=100");
        const json = await res.json();
        if (res.ok && Array.isArray(json.data)) setProjects(json.data);
      } catch {
        // Error shown on submit if no projects available.
      } finally {
        setLoadingProjects(false);
      }
    }
    loadProjects();
  }, []);

  async function handleSubmit(values: SiteFormValues) {
    setPending(true);
    setServerError(null);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSitePayload(values)),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create site.");
      const newId = json._id ?? json.data?._id ?? json.data?.insertedId;
      router.push(newId ? `/dashboard/sites/${newId}` : "/dashboard/sites");
    } catch (err) {
      setServerError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="New Site" />
      {loadingProjects ? (
        <TableSkeleton rows={4} />
      ) : projects.length === 0 ? (
        <p role="alert" className="text-sm text-danger">
          Create a project first — a site must belong to a project.
        </p>
      ) : (
        <SiteForm
          initial={{
            name: "",
            project: preselectedProject,
            location: "",
            supervisor: "",
            startDate: toDateInputValue(new Date()),
            expectedEndDate: "",
            status: "active",
            progress: "0",
            notes: "",
          }}
          projects={projects}
          pending={pending}
          serverError={serverError}
          submitLabel="Create Site"
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

export default function NewSitePage() {
  return (
    <Suspense fallback={<TableSkeleton rows={4} />}>
      <NewSiteContent />
    </Suspense>
  );
}
