"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { useProject } from "@/context/ProjectContext";

export function ProjectActions({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const router = useRouter();
  // const { selectedProjectId, setSelectedProjectId } = useProject();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // const isCurrent = selectedProjectId === projectId;

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed.");
      router.push("/dashboard/projects");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/dashboard/projects/${projectId}/edit`}>
        <Button variant="outline" size="sm">Edit</Button>
      </Link>
      <Button variant="danger" size="sm" onClick={() => { setConfirming(true); setError(null); }}>
        Delete
      </Button>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={handleDelete}
        title={`Delete ${projectName}?`}
        description={error ?? "This cannot be undone. Projects with sites cannot be deleted."}
        pending={pending}
      />
    </div>
  );
}
