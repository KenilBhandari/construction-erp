"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  REFERENCE_TTL_MS,
  REFERENCE_URLS,
  REVALIDATE_AFTER_MS,
  scopesForDomain,
  type MutationDomain,
  type ReferenceScope,
} from "@/lib/cache-tags";
import {
  LIST_REVALIDATE_AFTER_MS,
  LIST_TTL_MS,
  decideListRead,
  listScopesForDomain,
  type ListScope,
} from "@/lib/list-cache";
import {
  dashboardDirtiedBy,
  decideDashboardRead,
  reviveDashboardSummary,
  todayKeyUTC,
  type DashboardEntry,
} from "@/lib/dashboard-cache";
import type { DashboardSummary } from "@/lib/dashboard";

interface CacheEntry {
  at: number;
  data: unknown[];
}

interface ListEntry {
  at: number;
  data: unknown;
}

interface CacheContextValue {
  /** Raw dirty scopes (e.g. "sites" means next read refetches). */
  dirty: Set<ReferenceScope>;
  markDirty: (scope: ReferenceScope) => void;
  /** One call per mutation — fans out to reference AND page-1 list scopes. */
  markDirtyFor: (domain: MutationDomain) => void;
  clearDirty: (scope: ReferenceScope) => void;
  /** In-memory entries shared across pages within the session. */
  getEntry: (scope: ReferenceScope) => CacheEntry | null;
  setEntry: (scope: ReferenceScope, data: unknown[]) => void;
  /** Dirty default-view list scopes (page-1 cache). */
  listDirty: Set<ListScope>;
  /** Memory-only page-1 entries (never localStorage). */
  getListEntry: (scope: ListScope) => ListEntry | null;
  setListEntry: (scope: ListScope, data: unknown) => void;
  /**
   * Dashboard entry is dirty when any dashboard-affecting mutation ran
   * since the last successful dashboard fetch. Cleared only on success —
   * a failed fetch keeps it dirty so the next visit retries fresh.
   */
  dashboardDirty: boolean;
  /** Memory-only full-summary entry (never localStorage). Single scope. */
  getDashboardEntry: () => DashboardEntry | null;
  setDashboardEntry: (data: DashboardSummary, dayKey: string) => void;
  markDashboardDirty: () => void;
}

const CacheContext = createContext<CacheContextValue | null>(null);

const LS_PREFIX = "erp.cache.";

function readLS(scope: ReferenceScope): CacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_PREFIX + scope);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!Array.isArray(parsed.data) || typeof parsed.at !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLS(scope: ReferenceScope, entry: CacheEntry) {
  try {
    localStorage.setItem(LS_PREFIX + scope, JSON.stringify(entry));
  } catch {
    // Ignore quota/private-mode errors.
  }
}

// Module-level in-flight dedupe: two pages mounting the same scope
// at once share one network request.
const inflight = new Map<ReferenceScope, Promise<unknown[]>>();

async function fetchScope(scope: ReferenceScope): Promise<unknown[]> {
  const existing = inflight.get(scope);
  if (existing) return existing;
  const p = fetch(REFERENCE_URLS[scope])
    .then(async (r) => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `Failed to load ${scope}.`);
      return Array.isArray(j.data) ? (j.data as unknown[]) : [];
    })
    .finally(() => {
      inflight.delete(scope);
    });
  inflight.set(scope, p);
  return p;
}

export function CacheProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState<Set<ReferenceScope>>(new Set());
  const [listDirty, setListDirty] = useState<Set<ListScope>>(new Set());
  const [dashboardDirty, setDashboardDirty] = useState(false);
  const memRef = useRef<Map<ReferenceScope, CacheEntry>>(new Map());
  // Page-1 list responses: session memory only, never persisted.
  const listMemRef = useRef<Map<ListScope, ListEntry>>(new Map());
  // Full dashboard summary: single session-memory entry, never persisted.
  const dashboardRef = useRef<DashboardEntry | null>(null);
  const [, bump] = useState(0);

  const getEntry = useCallback((scope: ReferenceScope): CacheEntry | null => {
    return memRef.current.get(scope) ?? readLS(scope);
  }, []);

  const setEntry = useCallback((scope: ReferenceScope, data: unknown[]) => {
    const entry = { at: Date.now(), data };
    memRef.current.set(scope, entry);
    writeLS(scope, entry);
    setDirty((prev) => {
      if (!prev.has(scope)) return prev;
      const next = new Set(prev);
      next.delete(scope);
      return next;
    });
    bump((n) => n + 1);
  }, []);

  const markDirty = useCallback((scope: ReferenceScope) => {
    setDirty((prev) => {
      if (prev.has(scope)) return prev;
      const next = new Set(prev);
      next.add(scope);
      return next;
    });
  }, []);

  const markListDirty = useCallback((scope: ListScope) => {
    setListDirty((prev) => {
      if (prev.has(scope)) return prev;
      const next = new Set(prev);
      next.add(scope);
      return next;
    });
  }, []);

  const getListEntry = useCallback((scope: ListScope): ListEntry | null => {
    return listMemRef.current.get(scope) ?? null;
  }, []);

  const setListEntry = useCallback((scope: ListScope, data: unknown) => {
    listMemRef.current.set(scope, { at: Date.now(), data });
    setListDirty((prev) => {
      if (!prev.has(scope)) return prev;
      const next = new Set(prev);
      next.delete(scope);
      return next;
    });
    bump((n) => n + 1);
  }, []);

  const markDashboardDirty = useCallback(() => {
    setDashboardDirty(true);
  }, []);

  const getDashboardEntry = useCallback((): DashboardEntry | null => {
    return dashboardRef.current;
  }, []);

  /**
   * Record a successful dashboard fetch. Clearing dirty here — and only
   * here — guarantees a failed fetch keeps the dashboard dirty so the
   * next visit retries fresh.
   */
  const setDashboardEntry = useCallback((data: DashboardSummary, dayKey: string) => {
    dashboardRef.current = { dayKey, data };
    setDashboardDirty(false);
    bump((n) => n + 1);
  }, []);

  const markDirtyFor = useCallback(
    (domain: MutationDomain) => {
      for (const s of scopesForDomain(domain)) markDirty(s);
      for (const s of listScopesForDomain(domain)) markListDirty(s);
      // Every mutation domain dirties the dashboard (see DASHBOARD_DIRTY_DOMAINS).
      if (dashboardDirtiedBy(domain)) markDashboardDirty();
    },
    [markDirty, markDashboardDirty],
  );

  const clearDirty = useCallback((scope: ReferenceScope) => {
    setDirty((prev) => {
      if (!prev.has(scope)) return prev;
      const next = new Set(prev);
      next.delete(scope);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      dirty,
      markDirty,
      markDirtyFor,
      clearDirty,
      getEntry,
      setEntry,
      listDirty,
      getListEntry,
      setListEntry,
      dashboardDirty,
      getDashboardEntry,
      setDashboardEntry,
      markDashboardDirty,
    }),
    [
      dirty,
      markDirty,
      markDirtyFor,
      clearDirty,
      getEntry,
      setEntry,
      listDirty,
      getListEntry,
      setListEntry,
      dashboardDirty,
      getDashboardEntry,
      setDashboardEntry,
      markDashboardDirty,
    ],
  );

  return <CacheContext.Provider value={value}>{children}</CacheContext.Provider>;
}

function useCacheContext(): CacheContextValue {
  const ctx = useContext(CacheContext);
  if (!ctx) throw new Error("useReferenceData must be used inside <CacheProvider>.");
  return ctx;
}

/**
 * Reference dropdown data with stale-while-revalidate:
 * cached value renders instantly, background fetch refreshes it.
 * Dirty flag (set via markDirtyFor after mutations) forces a blocking refetch.
 */
export function useReferenceData<T>(scope: ReferenceScope): {
  items: T[];
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
} {
  const { dirty, getEntry, setEntry } = useCacheContext();
  const [items, setItems] = useState<T[]>(() => {
    const cached = getEntry(scope);
    return (cached?.data ?? []) as T[];
  });
  const [loading, setLoading] = useState(() => getEntry(scope) === null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cached = getEntry(scope);
    const isDirty = dirty.has(scope);
    const age = cached ? Date.now() - cached.at : Infinity;
    const expired = !cached || age > REFERENCE_TTL_MS;

    // Cache-only: fresh + clean + recently revalidated. Zero network.
    // Sync sets here are intentional (instant cached paint).
    if (cached && !isDirty && !expired && age < REVALIDATE_AFTER_MS) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(cached.data as T[]);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRefreshing(false);
      return () => {
        cancelled = true;
      };
    }

    // Fast path: fresh + clean but due for revalidation. Paint cache
    // immediately, refresh quietly in the background (in-flight deduped).
    if (cached && !isDirty && !expired) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(cached.data as T[]);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRefreshing(true);
      fetchScope(scope)
        .then((fresh) => {
          if (cancelled) return;
          setEntry(scope, fresh);
          setItems(fresh as T[]);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setRefreshing(false);
        });
      return () => {
        cancelled = true;
      };
    }

    // Slow path: missing / expired / dirty — blocking fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(cached === null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRefreshing(cached !== null);
    fetchScope(scope)
      .then((fresh) => {
        if (cancelled) return;
        setEntry(scope, fresh);
        setItems(fresh as T[]);
      })
      .catch(() => {
        // Keep stale items on failure; list pages surface their own errors.
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // getEntry/setEntry are stable; re-run when scope or dirtiness changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, dirty.has(scope)]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const fresh = await fetchScope(scope);
      setEntry(scope, fresh);
      setItems(fresh as T[]);
    } finally {
      setRefreshing(false);
    }
  }, [scope, setEntry]);

  return { items, loading, refreshing, refresh };
}

export function useMarkDirtyFor(): (domain: MutationDomain) => void {
  return useCacheContext().markDirtyFor;
}

/**
 * Page-1 default-view list cache (memory-only, never localStorage).
 *
 * Callers gate on their own default view (no filters, page 1, default
 * sort, no manual refresh) and only call read()/write() inside that gate,
 * so filtered views and pages 2+ always fetch fresh.
 *
 * read() returns null when a network fetch is required, otherwise the
 * cached response plus whether a quiet background revalidation is due.
 * Dirty flags (set via markDirtyFor after mutations) force a refetch.
 */
export function usePageOneList<TResponse>(scope: ListScope): {
  read: () => { data: TResponse; revalidate: boolean } | null;
  write: (data: TResponse) => void;
  isDirty: boolean;
} {
  const { listDirty, getListEntry, setListEntry } = useCacheContext();

  const read = useCallback((): { data: TResponse; revalidate: boolean } | null => {
    const entry = getListEntry(scope);
    const decision = decideListRead({
      ageMs: entry ? Date.now() - entry.at : null,
      dirty: listDirty.has(scope),
      ttlMs: LIST_TTL_MS,
      revalidateAfterMs: LIST_REVALIDATE_AFTER_MS,
    });
    if (decision === "fetch" || !entry) return null;
    return { data: entry.data as TResponse, revalidate: decision === "revalidate" };
  }, [scope, getListEntry, listDirty]);

  const write = useCallback(
    (data: TResponse) => {
      setListEntry(scope, data);
    },
    [scope, setListEntry],
  );

  return { read, write, isDirty: listDirty.has(scope) };
}

/**
 * Full-dashboard summary with mutation-driven invalidation (no TTL, no
 * background revalidation — deliberately simpler than the list cache).
 *
 * Mount behavior:
 * - clean + cached + same UTC day -> paint cache, zero network requests.
 * - dirty / missing / previous-day entry -> blocking fetch; dirty clears
 *   only after the fetch succeeds, so a failure retries fresh next visit.
 *
 * Manual refresh() always refetches (and rewrites the entry on success).
 */
export function useDashboardSummary(): {
  data: DashboardSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const { dashboardDirty, getDashboardEntry, setDashboardEntry } = useCacheContext();
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dayKey = todayKeyUTC();
    const useCache = reloadKey === 0;
    if (useCache) {
      const entry = getDashboardEntry();
      const decision = decideDashboardRead({
        hasEntry: entry !== null,
        sameDay: entry?.dayKey === dayKey,
        dirty: dashboardDirty,
      });
      if (decision === "cache" && entry) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setData(entry.data);
        setError(null);
        setLoading(false);
        return;
      }
    }
    fetch("/api/dashboard/summary")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load dashboard.");
        const revived = reviveDashboardSummary(json as DashboardSummary);
        setData(revived);
        setError(null);
        // Clears dashboardDirty — success-only, a failure keeps it dirty.
        setDashboardEntry(revived, dayKey);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
    // getDashboardEntry/setDashboardEntry are stable; re-run when dirtiness
    // changes (a mutation while mounted) or on manual refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardDirty, reloadKey]);

  function refresh() {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  return { data, loading, error, refresh };
}
