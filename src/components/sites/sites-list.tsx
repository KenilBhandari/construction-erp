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
import type { SiteDTO } from "@/types/site";
import { siteProjectName } from "@/types/site";
import type { ProjectDTO } from "@/types/project";

interface ListResponse {
  data: SiteDTO[];
  page: number;
  limit: number;
  total: number;
}

export default function SitesList() {
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [status, setStatus] = useState("");
  const [project, setProject] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [projects, setProjects] = useState<ProjectDTO[]>([]);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SiteDTO | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  useEffect(() => {
    fetch("/api/projects?limit=100")
      .then((r) => r.json())
      .then((json) => {
        if (Array.isArray(json.data)) setProjects(json.data);
      })
      .catch(() => {});
  }, []);

  // Fetch from the API when filters change. All state updates live in
  // the promise callbacks, keeping the effect body free of synchronous
  // setState (per hooks lint). No data-fetching library, per README.
  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (appliedQuery) params.set("q", appliedQuery);
    if (status) params.set("status", status);
    if (project) params.set("project", project);
    fetch(`/api/sites?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load sites.");
        setData(json);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [appliedQuery, status, project, page, reloadKey]);

  function refresh() {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      setAppliedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function handleDelete(): Promise<boolean> {
    const ids = deleting ? [deleting._id] : selectedIds;

    if (ids.length === 0) return false;

    setDeletePending(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/sites", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Delete failed.");
      }

      setDeleting(null);
      setSelectedIds([]);
      refresh();
      return true;
    } catch (err) {
      setDeleteError((err as Error).message);
      return false;
    } finally {
      setDeletePending(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Sites"
        description="Sites belong to projects. Assign labour and track progress site-wise."
        action={
          <Link href="/dashboard/sites/new">
            <Button>Add Site</Button>
          </Link>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Input
            aria-label="Search sites"
            placeholder="Search name, supervisor, location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select
          aria-label="Filter by project"
          value={project}
          onChange={(e) => {
            setProject(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="on-hold">On Hold</option>
          <option value="completed">Completed</option>
        </Select>
      </div>

      {loading && <TableSkeleton rows={6} />}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}{" "}
          <button type="button" className="underline" onClick={refresh}>
            Retry
          </button>
        </p>
      )}

{!loading && !error && data && data.data.length === 0 && (
  <EmptyState
    title={query ? "No sites found" : "No sites yet"}
    description={
      query
        ? `No sites match "${query}". Try searching for something else or clear your filters.`
        : "Add a site under a project to start assigning labour and marking attendance."
    }
    action={
      query ? (
        <Button variant="outline" onClick={() => setQuery("")}>
          Clear Search
        </Button>
      ) : (
        <Link href="/dashboard/sites/new">
          <Button>Add Site</Button>
        </Link>
      )
    }
  />
)}
      {/* {selectedIds.length > 0 && (
        <div className="flex items-center justify-between border border-border px-4 py-3">
          <span className="text-sm text-text-muted">
            {selectedIds.length} site{selectedIds.length > 1 ? "s" : ""}{" "}
            selected
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDeleteError(null);
              setBulkDeleteOpen(true);
            }}
          >
            Delete Selected
          </Button>
        </div>
      )} */}
      {!loading && !error && data && data.data.length > 0 && (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Site</TH>
                <TH>Project</TH>
                <TH>Supervisor</TH>
                <TH>Progress</TH>
                <TH>Status</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <tbody>
              {data.data.map((s) => (
                <TR key={s._id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      {/* LATER WILL ADD FOR BULK DELETE */}
                      {/* <input
                        type="checkbox"
                        checked={selectedIds.includes(s._id)}
                        onChange={(e) => {
                          setSelectedIds((prev) =>
                            e.target.checked
                              ? [...prev, s._id]
                              : prev.filter((id) => id !== s._id),
                          );
                        }}
                        className="h-4 w-4 accent-[#FF6321]"
                      /> */}

                      <Link href={`/dashboard/sites/${s._id}`} className="font-medium hover:underline">{s.name}</Link>
                    </div>
                    {s.location && (
                      <p className="text-xs text-text-muted">{s.location}</p>
                    )}
                  </TD>
                  <TD>{siteProjectName(s)}</TD>
                  <TD>{s.supervisor ?? "—"}</TD>
                  <TD className="tnum">{s.progress}%</TD>
                  <TD>
                    <Badge
                      tone={
                        s.status === "active"
                          ? "primary"
                          : s.status === "completed"
                            ? "success"
                            : "warning"
                      }
                    >
                      {s.status}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex gap-2">
                      <Link
                        href={`/dashboard/sites/${s._id}/edit`}
                        className="text-sm text-text-muted hover:underline"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleting(s);
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
              {data.total} site(s) · Page {data.page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleting !== null || bulkDeleteOpen}
        onClose={() => {
          setDeleting(null);
          setBulkDeleteOpen(false);
          setDeleteError(null);
        }}
        onConfirm={async () => {
          const success = await handleDelete();

          if (success) {
            setDeleting(null);
            setBulkDeleteOpen(false);
          }
        }}
        title={
          deleting
            ? `Delete ${deleting.name}?`
            : `Delete ${selectedIds.length} selected sites?`
        }
        description={
          deleteError ??
          (deleting
            ? "This cannot be undone. Historical attendance linked to this site should be reassigned first."
            : `This will permanently delete ${selectedIds.length} selected site${
                selectedIds.length > 1 ? "s" : ""
              }. This action cannot be undone.`)
        }
        pending={deletePending}
      />
    </div>
  );
}
