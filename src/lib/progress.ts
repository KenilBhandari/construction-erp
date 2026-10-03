/**
 * Project progress is derived from its sites — projects have no progress
 * of their own. Simple average of site progress, rounded. No sites → 0%.
 */
export function derivedProjectProgress(
  sites: { progress?: number | null }[],
): number {
  if (sites.length === 0) return 0;
  const sum = sites.reduce(
    (acc, s) => acc + (typeof s.progress === "number" ? s.progress : 0),
    0,
  );
  return Math.round(sum / sites.length);
}
