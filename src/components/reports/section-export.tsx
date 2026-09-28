"use client";

import { Button } from "@/components/ui/button";

/** Server-generated PDF for the full report scope (not just displayed rows). One button, one goal. */
export function PdfButton({ href, label }: { href: string; label: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        window.location.href = href;
      }}
      aria-label={`Print report as PDF`}
    >
      {label}
    </Button>
  );
}
