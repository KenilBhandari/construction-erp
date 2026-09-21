"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/modal";
import { formatINR } from "@/lib/utils";
import type { ProjectDTO } from "@/types/project";
import { statusLabel, statusTone } from "./project-status";

interface ListResponse {
  data: ProjectDTO[];
  page: number;
  limit: number;
  total: number;
}

export default function ProjectsList() {
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ProjectDTO | null>(null);
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

  async function handleDelete() {
    if (!deleting) return;
    setDeletePending(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/projects/${deleting._id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed.");
      setDeleting(null);
      refresh();
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setDeletePending(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Projects"
        description="Create projects, track budget and progress. Each project holds its own sites."
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
                <TR key={p._id}>
                  <TD>
                    <Link href={`/dashboard/projects/${p._id}`} className="font-medium text-primary hover:underline">
                      {p.name}
                    </Link>
                    <p className="text-xs text-text-muted">{p.location}</p>
                  </TD>
                  <TD>{p.clientName}</TD>
                  <TD className="tnum">{p.progress}%</TD>
                  <TD numeric>{formatINR(p.budget)}</TD>
                  <TD>
                    <Badge tone={statusTone(p.status)}>{statusLabel(p.status)}</Badge>
                  </TD>
                  <TD>
                    <div className="flex gap-2">
                      <Link href={`/dashboard/projects/${p._id}`} className="text-sm text-primary hover:underline">
                        View
                      </Link>
                      <Link href={`/dashboard/projects/${p._id}/edit`} className="text-sm text-text-muted hover:underline">
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleting(p);
                          setDeleteError(null);
                        }}
                        className="text-sm text-danger hover:underline"
                      >
                        Delete
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

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title={`Delete ${deleting?.name ?? "project"}?`}
        description={deleteError ?? "This cannot be undone. Projects with sites cannot be deleted."}
        pending={deletePending}
      />
    </div>
  );
}
