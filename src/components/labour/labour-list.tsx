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
import { AssignSiteDialog } from "@/components/labour/assign-dialog";
import { formatINR } from "@/lib/utils";
import type { LabourDTO } from "@/types/labour";
import { labourSiteId, labourSiteName, SKILL_TYPES } from "@/types/labour";
import type { SiteDTO } from "@/types/site";
import { siteProjectName } from "@/types/site";

interface ListResponse {
  data: LabourDTO[];
  page: number;
  limit: number;
  total: number;
}

export default function LabourList() {
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [skill, setSkill] = useState("");
  const [site, setSite] = useState("");
  const [status, setStatus] = useState("active");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [sites, setSites] = useState<SiteDTO[]>([]);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<LabourDTO | null>(null);
  const [toggling, setToggling] = useState<LabourDTO | null>(null);
  const [togglePending, setTogglePending] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

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
    const params = new URLSearchParams({ page: String(page), limit: "20", sort });
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
  }, [appliedQ, skill, site, status, sort, page, reloadKey]);

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

  async function handleToggleStatus() {
    if (!toggling) return;
    const next = toggling.status === "active" ? "inactive" : "active";
    setTogglePending(true);
    setToggleError(null);
    try {
      const res = await fetch(`/api/labour/${toggling._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed.");
      setToggling(null);
      refresh();
    } catch (err) {
      setToggleError((err as Error).message);
    } finally {
      setTogglePending(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Labour"
        description="Register workers, assign them to sites, track status."
        action={
          <Link href="/dashboard/labour/new">
            <Button>Add Labour</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <div className="col-span-2">
          <Input
            aria-label="Search labour"
            placeholder="Search name, phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select aria-label="Filter by skill" value={skill} onChange={(e) => { setSkill(e.target.value); resetPage(); }}>
          <option value="">All skills</option>
          {SKILL_TYPES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        <Select aria-label="Filter by site" value={site} onChange={(e) => { setSite(e.target.value); resetPage(); }}>
          <option value="">All sites</option>
          {sites.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name} · {siteProjectName(s)}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
        <Select aria-label="Sort" value={sort} onChange={(e) => { setSort(e.target.value); resetPage(); }}>
          <option value="newest">Newest</option>
          <option value="name">Name</option>
          <option value="rate">Highest daily rate</option>
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
                <TR key={l._id}>
                  <TD>
                    <Link href={`/dashboard/labour/${l._id}`} className="font-medium text-primary hover:underline">
                      {l.name}
                    </Link>
                    <p className="text-xs text-text-muted tnum">{l.phone}</p>
                  </TD>
                  <TD>{l.skill}</TD>
                  <TD>{labourSiteName(l) ?? "—"}</TD>
                  <TD numeric>{formatINR(l.dailyRate)}</TD>
                  <TD>
                    <Badge tone={l.status === "active" ? "success" : "neutral"}>
                      {l.status === "active" ? "Active" : "Inactive"}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/dashboard/labour/${l._id}`} className="text-sm text-primary hover:underline">
                        View
                      </Link>
                      <Link href={`/dashboard/labour/${l._id}/edit`} className="text-sm text-text-muted hover:underline">
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => setAssigning(l)}
                        className="text-sm text-text-muted hover:underline"
                      >
                        Assign
                      </button>
                      <button
                        type="button"
                        onClick={() => { setToggling(l); setToggleError(null); }}
                        className="text-sm text-danger hover:underline"
                      >
                        {l.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>

          <div className="flex items-center justify-between text-sm text-text-muted">
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

      <ConfirmDialog
        open={toggling !== null}
        onClose={() => setToggling(null)}
        onConfirm={handleToggleStatus}
        title={toggling?.status === "active" ? `Deactivate ${toggling?.name}?` : `Activate ${toggling?.name}?`}
        description={toggleError ?? (toggling?.status === "active" ? "They will be hidden from attendance lists but history is kept." : "They will appear in attendance lists again.")}
        confirmLabel={toggling?.status === "active" ? "Deactivate" : "Activate"}
        pending={togglePending}
      />
    </div>
  );
}
