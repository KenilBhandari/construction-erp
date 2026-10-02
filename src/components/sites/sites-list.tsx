"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ComboSelect } from "@/components/ui/combo-select";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import type { SiteDTO } from "@/types/site";
import { siteProjectName } from "@/types/site";
import type { ProjectDTO } from "@/types/project";
import { useMarkDirtyFor, usePageOneList, useReferenceData } from "@/context/CacheContext";
import { Pencil, Search, Trash2, X } from "lucide-react";

interface ListResponse {
  data: SiteDTO[];
  page: number;
  limit: number;
  total: number;
}

export default function SitesList() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [status, setStatus] = useState("");
  const [project, setProject] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  // Shared reference cache: projects dropdown served instantly from
  // memory/localStorage, revalidated quietly. No per-page fetch.
  const { items: projects } = useReferenceData<ProjectDTO>("projects");
  const markDirtyFor = useMarkDirtyFor();
  // Page-1 default-view cache: instant on repeat navigation, zero network
  // while young. Filtered views and pages 2+ always fetch fresh.
  const {
    read: readSitesPage,
    write: writeSitesPage,
    isDirty: sitesPageDirty,
  } = usePageOneList<ListResponse>("sites");
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SiteDTO | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fetch from the API when filters change. All state updates live in
  // the promise callbacks, keeping the effect body free of synchronous
  // setState (per hooks lint) except the cache paint below. No
  // data-fetching library, per README.
  useEffect(() => {
    // Default view only; manual refresh (reloadKey) always refetches so a
    // mutation the user just made is never hidden behind cache. A refresh
    // fetch still rewrites the cache via isDefault below.
    const isDefault = !appliedQuery && !status && !project && page === 1;
    const useCache = isDefault && reloadKey === 0;
    if (useCache) {
      const hit = readSitesPage();
      if (hit) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setData(hit.data);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setError(null);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(false);
        if (!hit.revalidate) return;
      }
    }
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
        if (isDefault) writeSitesPage(json);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
    // read/write are scope-bound helpers; isDirty re-runs after mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedQuery, status, project, page, reloadKey, sitesPageDirty]);

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

  function closeDelete() {
    setDeleting(null);
    setDeleteConfirmText("");
    setDeleteError(null);
  }

  async function handleDelete(): Promise<boolean> {
    const ids = deleting ? [deleting._id] : [];
    if (ids.length === 0) return false;
    if (deleteConfirmText !== "DELETE") return false;
    setDeletePending(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/sites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed.");
      closeDelete();
      markDirtyFor("sites");
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
  const canDelete = deleteConfirmText === "DELETE" && !deletePending;

  const statusOptions = [
    { value: "", label: "All" },
    { value: "active", label: "Active" },
    { value: "on-hold", label: "On Hold" },
    { value: "completed", label: "Completed" },
  ];
  const projectOptions = [
    { value: "", label: "All projects" },
    ...projects.map((p) => ({ value: p._id, label: p.name })),
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <PageHeader
        title="Sites"
        action={
          <Link href="/dashboard/sites/new">
            <Button>Add Site</Button>
          </Link>
        }
      />

      {/* Phone: search + status on one row, project picker below. */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex flex-row gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            />
            <Input
              aria-label="Search sites"
              placeholder="Search sites…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-10 pr-10 text-sm"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-text-muted hover:bg-background hover:text-text"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="w-[132px] shrink-0">
            <ComboSelect
              ariaLabel="Filter by status"
              value={status}
              options={statusOptions}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            />
          </div>
        </div>
        <ComboSelect
          ariaLabel="Filter by project"
          value={project}
          options={projectOptions}
          onChange={(v) => {
            setProject(v);
            setPage(1);
          }}
        />
      </div>

      {/* Desktop: original row, untouched. */}
      <div className="hidden sm:flex sm:flex-row sm:gap-3">
        <div className="flex-1">
          <Input
            aria-label="Search sites"
            placeholder="Search name, supervisor, location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 text-sm sm:h-10"
          />
        </div>
        <div className="w-44 shrink-0 sm:w-48">
          <ComboSelect
            ariaLabel="Filter by project"
            value={project}
            options={projectOptions}
            onChange={(v) => {
              setProject(v);
              setPage(1);
            }}
          />
        </div>
        <div className="w-44 shrink-0 sm:w-48">
          <ComboSelect
            ariaLabel="Filter by status"
            value={status}
            options={[
              { value: "", label: "All statuses" },
              { value: "active", label: "Active" },
              { value: "on-hold", label: "On Hold" },
              { value: "completed", label: "Completed" },
            ]}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          />
        </div>
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
      {!loading && !error && data && data.data.length > 0 && (
        <>
          {/* Phone cards — desktop table below stays untouched. */}
          <ul className="flex flex-col gap-2 sm:hidden">
            {data.data.map((s) => (
              <li key={s._id}>
                <Card className="cursor-pointer p-3 active:bg-background">
                  <div
                    className="flex flex-col gap-1.5"
                    onClick={() => router.push(`/dashboard/sites/${s._id}`)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/dashboard/sites/${s._id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="min-w-0 truncate text-[15px] font-medium text-primary hover:underline"
                      >
                        {s.name}
                      </Link>
                      <Badge
                        tone={
                          s.status === "active"
                            ? "primary"
                            : s.status === "completed"
                              ? "success"
                              : "warning"
                        }
                        className="shrink-0"
                      >
                        {s.status === "on-hold" ? "On Hold" : s.status === "active" ? "Active" : "Completed"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <ProgressBar value={s.progress} className="min-w-0 flex-1" />
                      <span className="shrink-0 text-xs tnum text-text-muted">
                        {s.progress}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-xs text-text-muted">
                        {siteProjectName(s)}{s.supervisor ? ` · ${s.supervisor}` : ""}
                      </p>
                      <div className="-mr-1.5 flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/dashboard/sites/${s._id}/edit`}
                          aria-label={`Edit ${s.name}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          aria-label={`Delete ${s.name}`}
                          onClick={() => {
                            setDeleting(s);
                            setDeleteConfirmText("");
                            setDeleteError(null);
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          <div className="hidden sm:block">
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
                <TR
                  key={s._id}
                  className="cursor-pointer hover:bg-background/70"
                  onClick={() => router.push(`/dashboard/sites/${s._id}`)}
                >
                  <TD>
                    <span className="font-medium text-primary">{s.name}</span>
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
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/dashboard/sites/${s._id}/edit`}
                        aria-label={`Edit ${s.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        aria-label={`Delete ${s.name}`}
                        onClick={() => {
                          setDeleting(s);
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
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted sm:text-sm">
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

      <Modal open={deleting !== null} onClose={closeDelete} title={`Delete ${deleting?.name ?? "site"}?`}>
        <div className="flex flex-col gap-3 sm:gap-4">
          <p className="text-sm leading-6 text-text-muted">This cannot be undone.</p>
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
          />
          <div className="flex flex-row justify-end gap-2">
            <Button variant="outline" onClick={closeDelete} disabled={deletePending} className="h-11 sm:h-auto">
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={!canDelete} className="h-11 sm:h-auto">
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
