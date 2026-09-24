"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { formatINR } from "@/lib/utils";
import type { ProjectDTO } from "@/types/project";
import { statusLabel, statusTone } from "./project-status";
import { Pencil, Trash2 } from "lucide-react";

interface ListResponse {
  data: ProjectDTO[];
  page: number;
  limit: number;
  total: number;
}

export default function ProjectsList() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ProjectDTO | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fetch from the API when filters change. All state updates live in
  // the promise callbacks, keeping the effect body free of synchronous
  // setState (per hooks lint). No data-fetching library, per README.
  useEffect(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
    });
    if (appliedQ) params.set("q", appliedQ);
    if (status) params.set("status", status);
    fetch(`/api/projects?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load projects.");
        setData(json);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [appliedQ, status, page, reloadKey]);

  function refresh() {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  // Debounce search input so typing doesn't spam the API.
  useEffect(() => {
    const t = setTimeout(() => {
      setAppliedQ(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  function closeDelete() {
    setDeleting(null);
    setDeleteConfirmText("");
    setDeleteError(null);
  }

  async function handleDelete() {
    if (!deleting) return;
    if (deleteConfirmText !== "DELETE") return;
    setDeletePending(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/projects/${deleting._id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed.");
      closeDelete();
      refresh();
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setDeletePending(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const canDelete = deleteConfirmText === "DELETE" && !deletePending;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Projects"
        action={
          <Link href="/dashboard/projects/new">
            <Button>Create Project</Button>
          </Link>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Input
            aria-label="Search projects"
            placeholder="Search name, client, location…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="planning">Planning</option>
          <option value="active">Active</option>
          <option value="on-hold">On Hold</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>

      {loading && <TableSkeleton rows={6} />}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error} <button type="button" className="underline" onClick={refresh}>Retry</button>
        </p>
      )}

      {!loading && !error && data && data.data.length === 0 && (
        <EmptyState
          title="No projects yet"
          description="Create your first project to start tracking sites, labour, expenses and payments."
          action={
            <Link href="/dashboard/projects/new">
              <Button>Create Project</Button>
            </Link>
          }
        />
      )}

      {!loading && !error && data && data.data.length > 0 && (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Project</TH>
                <TH>Client</TH>
                <TH>Progress</TH>
                <TH numeric>Budget</TH>
                <TH>Status</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <tbody>
              {data.data.map((p) => (
                <TR
                  key={p._id}
                  className="cursor-pointer hover:bg-background/70"
                  onClick={() => router.push(`/dashboard/projects/${p._id}`)}
                >
                  <TD>
                    <span className="font-medium text-primary">{p.name}</span>
                    <p className="text-xs text-text-muted">{p.location}</p>
                  </TD>
                  <TD>{p.clientName}</TD>
                  <TD className="tnum">{p.progress}%</TD>
                  <TD numeric>{formatINR(p.budget)}</TD>
                  <TD>
                    <Badge tone={statusTone(p.status)}>{statusLabel(p.status)}</Badge>
                  </TD>
                  <TD>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/dashboard/projects/${p._id}/edit`}
                        aria-label={`Edit ${p.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        aria-label={`Delete ${p.name}`}
                        onClick={() => {
                          setDeleting(p);
                          setDeleteConfirmText("");
                          setDeleteError(null);
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>

          <div className="flex items-center justify-between text-sm text-text-muted">
            <p className="tnum">
              {data.total} project(s) · Page {data.page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <Modal open={deleting !== null} onClose={closeDelete} title={`Delete ${deleting?.name ?? "project"}?`}>
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-6 text-text-muted">
            This cannot be undone. Projects with sites cannot be deleted.
          </p>
          {deleteError && (
            <p role="alert" className="text-sm text-danger">
              {deleteError}
            </p>
          )}
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-900">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm.
            </p>
            <p className="mt-1 text-xs text-amber-800">
              Deleting <span className="font-medium">{deleting?.name}</span> is permanent.
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
            <Button variant="outline" onClick={closeDelete} disabled={deletePending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={!canDelete}>
              {deletePending ? "Please wait…" : "Delete"}
            </Button>
          </div>
          {!canDelete && deleteConfirmText.length > 0 && deleteConfirmText !== "DELETE" && (
            <p className="text-xs text-text-muted">Type exactly DELETE (case-sensitive) to enable delete.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
