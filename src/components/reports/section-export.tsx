"use client";

import { Button } from "@/components/ui/button";

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Per-section CSV export — client-side from already-fetched data, no new deps.
 * First rows carry the report title + active scope so the file is self-describing.
 */
export function SectionExport({
  title,
  filename,
  scope,
  headers,
  rows,
}: {
  title: string;
  filename: string;
  scope: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  function download() {
    const lines = [
      [title],
      [`Scope: ${scope || "All records"}`],
      [`Exported: ${new Date().toISOString().slice(0, 10)}`],
      [],
      headers,
      ...rows,
    ];
    const csv = lines.map((r) => r.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={download} aria-label={`Export ${title} as CSV`}>
      CSV
    </Button>
  );
}

/** Print button — relies on the global print stylesheet. */
export function PrintButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()} aria-label="Print reports">
      Print
    </Button>
  );
}

/** Server-generated PDF for the full report scope (not just displayed rows). */
export function PdfButton({ href, label }: { href: string; label: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        window.location.href = href;
      }}
      aria-label={`Download ${label} as PDF`}
    >
      PDF
    </Button>
  );
}
