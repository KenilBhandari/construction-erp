"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import {
  ProjectForm,
  emptyProjectForm,
  toProjectPayload,
  type ProjectFormValues,
} from "@/components/projects/project-form";

export default function NewProjectPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(values: ProjectFormValues) {
    setPending(true);
    setServerError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toProjectPayload(values)),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create project.");
      router.push(`/dashboard/projects/${json._id}`);
    } catch (err) {
      setServerError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="New Project"
        description="Create a project, then add its sites."
      />
      <ProjectForm
        initial={emptyProjectForm()}
        pending={pending}
        serverError={serverError}
        submitLabel="Create Project"
        onSubmit={handleSubmit}
      />
    </div>
  );
}
