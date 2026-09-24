"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
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
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

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
      <Modal open={confirming === "delete"} onClose={() => { setConfirming(null); setDeleteConfirmText(""); setError(null); }} title={`Delete ${labourName}?`}>
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-6 text-text-muted">This cannot be undone.</p>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-900">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm.
            </p>
            <p className="mt-1 text-xs text-amber-800">
              Deleting <span className="font-medium">{labourName}</span> is permanent.
            </p>
          </div>
          <Input
            aria-label="Type DELETE to confirm"
            placeholder="DELETE"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setConfirming(null); setDeleteConfirmText(""); setError(null); }} disabled={pending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={pending || deleteConfirmText !== "DELETE"}>
              {pending ? "Please wait…" : "Delete"}
            </Button>
          </div>
          {deleteConfirmText.length > 0 && deleteConfirmText !== "DELETE" && (
            <p className="text-xs text-text-muted">Type exactly DELETE (case-sensitive) to enable delete.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
