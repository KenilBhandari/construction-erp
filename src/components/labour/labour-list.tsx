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
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { AssignSiteDialog } from "@/components/labour/assign-dialog";
import { formatINR } from "@/lib/utils";
import type { LabourDTO } from "@/types/labour";
import { labourSiteId, labourSiteName, SKILL_TYPES } from "@/types/labour";
import type { SiteDTO } from "@/types/site";
import { Pencil, Search, UserPlus, X } from "lucide-react";

interface ListResponse {
  data: LabourDTO[];
  page: number;
  limit: number;
  total: number;
}

export default function LabourList() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [skill, setSkill] = useState("");
  const [site, setSite] = useState("");
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [sites, setSites] = useState<SiteDTO[]>([]);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<LabourDTO | null>(null);

  useEffect(() => {
    fetch("/api/sites?limit=100")
      .then(async (res) => {
        const json = await res.json();
        if (res.ok && Array.isArray(json.data)) setSites(json.data);
      })
      .catch(() => {});
  }, []);

  // Fetch when filters change; updates live in promise callbacks.
  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (appliedQ) params.set("q", appliedQ);
    if (skill) params.set("skill", skill);
    if (site) params.set("site", site);
    if (status) params.set("status", status);
    fetch(`/api/labour?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load labour.");
        setData(json);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [appliedQ, skill, site, status, page, reloadKey]);

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

  function resetPage() {
    setPage(1);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const skillOptions = [
    { value: "", label: "All" },
    ...SKILL_TYPES.filter((s) => s !== "Other").map((s) => ({ value: s, label: s })),
  ];
  const siteOptions = [
    { value: "", label: "All sites" },
    ...sites.map((s) => ({ value: s._id, label: s.name })),
  ];
  const statusOptions = [
    { value: "", label: "All" },
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <PageHeader
        title="Labour"
        action={
          <Link href="/dashboard/labour/new">
            <Button>Add Labour</Button>
          </Link>
        }
      />

      {/* Phone: search + status on one row, skill + site below. */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex flex-row gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            />
            <Input
              aria-label="Search labour"
              placeholder="Search labour…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 pl-10 pr-10 text-sm"
            />
            {q && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQ("")}
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
              onChange={(v) => { setStatus(v); resetPage(); }}
            />
          </div>
        </div>
        <div className="flex flex-row gap-2">
          <div className="min-w-0 flex-1">
            <ComboSelect
              ariaLabel="Filter by site"
              value={site}
              options={siteOptions}
              onChange={(v) => { setSite(v); resetPage(); }}
            />
          </div>
          <div className="w-[132px] shrink-0">
            <ComboSelect
              ariaLabel="Filter by skill"
              value={skill}
              options={skillOptions}
              onChange={(v) => { setSkill(v); resetPage(); }}
            />
          </div>
        </div>
      </div>

      {/* Desktop: original row, untouched. */}
      <div className="hidden sm:flex sm:flex-row sm:gap-3">
        <div className="flex-1">
          <Input
            aria-label="Search labour"
            placeholder="Search name, phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 text-sm sm:h-10"
          />
        </div>
        <div className="w-44 shrink-0">
          <ComboSelect
            ariaLabel="Filter by skill"
            value={skill}
            options={[{ value: "", label: "All skills" }, ...SKILL_TYPES.filter((s) => s !== "Other").map((s) => ({ value: s, label: s }))]}
            onChange={(v) => { setSkill(v); resetPage(); }}
          />
        </div>
        <div className="w-44 shrink-0 sm:w-48">
          <ComboSelect
            ariaLabel="Filter by site"
            value={site}
            options={siteOptions}
            onChange={(v) => { setSite(v); resetPage(); }}
          />
        </div>
        <div className="w-44 shrink-0">
          <ComboSelect
            ariaLabel="Filter by status"
            value={status}
            options={[{ value: "", label: "All statuses" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]}
            onChange={(v) => { setStatus(v); resetPage(); }}
          />
        </div>
      </div>

      {loading && <TableSkeleton rows={6} />}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error} <button type="button" className="underline" onClick={refresh}>Retry</button>
        </p>
      )}

      {!loading && !error && data && data.data.length === 0 && (
        <EmptyState
          title="No labourers found"
          description="Register your first worker to start assigning sites and marking attendance."
          action={
            <Link href="/dashboard/labour/new">
              <Button>Add Labour</Button>
            </Link>
          }
        />
      )}

      {!loading && !error && data && data.data.length > 0 && (
        <>
          {/* Phone cards — desktop table below stays untouched. */}
          <ul className="flex flex-col gap-2 sm:hidden">
            {data.data.map((l) => {
              const siteName = labourSiteName(l);
              return (
                <li key={l._id}>
                  <Card className="cursor-pointer p-3 active:bg-background">
                    <div
                      className="flex flex-col gap-1.5"
                      onClick={() => router.push(`/dashboard/labour/${l._id}`)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/dashboard/labour/${l._id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="min-w-0 truncate text-[15px] font-medium text-primary hover:underline"
                        >
                          {l.name}
                        </Link>
                        <Badge tone={l.status === "active" ? "success" : "neutral"} className="shrink-0">
                          {l.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className={`min-w-0 truncate text-xs ${siteName ? "text-text-muted" : "text-text-muted italic"}`}>
                        {l.skill}{siteName ? ` · ${siteName}` : " · Unassigned"}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-[15px] font-semibold tnum text-text">
                          {formatINR(l.dailyRate)}<span className="text-xs font-normal text-text-muted">/day</span>
                        </p>
                        <div className="-mr-1.5 flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                          <Link
                            href={`/dashboard/labour/${l._id}/edit`}
                            aria-label={`Edit ${l.name}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            aria-label={`Assign ${l.name}`}
                            onClick={() => setAssigning(l)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                          >
                            <UserPlus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>

          <div className="hidden sm:block">
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Skill</TH>
                <TH>Site</TH>
                <TH numeric>Daily Rate</TH>
                <TH>Status</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <tbody>
              {data.data.map((l) => (
                <TR
                  key={l._id}
                  className="cursor-pointer hover:bg-background/70"
                  onClick={() => router.push(`/dashboard/labour/${l._id}`)}
                >
                  <TD>
                    <span className="font-medium text-primary">{l.name}</span>
                  </TD>
                  <TD>{l.skill}</TD>
                  <TD className={labourSiteName(l) ? "" : "text-text-muted italic"}>{labourSiteName(l) ?? "—"}</TD>
                  <TD numeric>{formatINR(l.dailyRate)}</TD>
                  <TD>
                    <Badge tone={l.status === "active" ? "success" : "neutral"}>
                      {l.status === "active" ? "Active" : "Inactive"}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/dashboard/labour/${l._id}/edit`}
                        aria-label={`Edit ${l.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        aria-label={`Assign ${l.name}`}
                        onClick={() => setAssigning(l)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-primary/10 hover:text-primary"
                      >
                        <UserPlus className="h-4 w-4" />
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted sm:text-sm">
            <p className="tnum">{data.total} worker(s) · Page {data.page} of {totalPages}</p>
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

      {assigning && (
        <AssignSiteDialog
          labourId={assigning._id}
          labourName={assigning.name}
          currentSiteId={labourSiteId(assigning)}
          open
          onClose={() => setAssigning(null)}
          onAssigned={refresh}
        />
      )}
    </div>
  );
}
