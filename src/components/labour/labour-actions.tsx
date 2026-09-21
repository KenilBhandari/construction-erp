"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { AssignSiteDialog } from "@/components/labour/assign-dialog";

export function LabourActions({
  labourId,
  labourName,
  status,
  currentSiteId,
}: {
  labourId: string;
  labourName: string;
  status: "active" | "inactive";
  currentSiteId: string | null;
}) {
  const router = useRouter();
  const [assignOpen, setAssignOpen] = useState(false);
  const [confirming, setConfirming] = useState<"toggle" | "delete" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/labour/${labourId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: status === "active" ? "inactive" : "active" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed.");
      setConfirming(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/labour/${labourId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed.");
      router.push("/dashboard/labour");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
        Assign Site
      </Button>
      <Link href={`/dashboard/labour/${labourId}/edit`}>
        <Button variant="outline" size="sm">Edit</Button>
      </Link>
      <Button
        variant="outline"
        size="sm"
        onClick={() => { setConfirming("toggle"); setError(null); }}
      >
        {status === "active" ? "Deactivate" : "Activate"}
      </Button>
      <Button
        variant="danger"
        size="sm"
        onClick={() => { setConfirming("delete"); setError(null); }}
      >
        Delete
      </Button>

      {assignOpen && (
        <AssignSiteDialog
          labourId={labourId}
          labourName={labourName}
          currentSiteId={currentSiteId}
          open
          onClose={() => setAssignOpen(false)}
          onAssigned={() => router.refresh()}
        />
      )}

      <ConfirmDialog
        open={confirming === "toggle"}
        onClose={() => setConfirming(null)}
        onConfirm={handleToggle}
        title={status === "active" ? `Deactivate ${labourName}?` : `Activate ${labourName}?`}
        description={error ?? "History is always kept."}
        confirmLabel={status === "active" ? "Deactivate" : "Activate"}
        pending={pending}
      />
      <ConfirmDialog
        open={confirming === "delete"}
        onClose={() => setConfirming(null)}
        onConfirm={handleDelete}
        title={`Delete ${labourName}?`}
        description={error ?? "Permanent delete works only when no site history exists — otherwise deactivate."}
        pending={pending}
      />
    </div>
  );
}
