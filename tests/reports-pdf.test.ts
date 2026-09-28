import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { MaterialsPdf, ExpensesPdf, SalaryPdf, LabourPdf } from "@/lib/reports/pdf";
import type { MaterialReport } from "@/lib/reports/material-runner";
import type { ExpenseRunnerReport } from "@/lib/reports/expense-runner";
import type { LabourReportDetail } from "@/lib/reports/labour-runner";

/**
 * PDF smoke — every report doc renders to a non-empty buffer. This also
 * exercises the bundled-font registration (₹ glyph): a missing font file
 * throws here instead of in production.
 */
describe("report PDFs render", () => {
  it("materials", async () => {
    const report = {
      header: { name: "Cement", unit: "Bag" },
      summary: { opening: 0, purchased: 100, consumed: 30, returned: 0, adjustments: 0, closing: 70, current: 70 },
      trend: [{ month: "Sep 2026", purchased: 100, consumed: 30 }],
      history: {
        total: 1,
        rows: [{ _id: "a", date: "2026-09-05", type: "purchase", quantity: 100, siteName: "S1" }],
      },
    } as unknown as MaterialReport;
    const buf = await renderToBuffer(
      createElement(MaterialsPdf, { report, scope: { generatedAt: "2026-09-28" } }) as never,
    );
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("expenses with rupee amounts", async () => {
    const report = {
      summary: { total: 2000, count: 1 },
      byCategory: [{ label: "Transport", amount: 2000, share: 100 }],
      trend: [{ month: "Sep 2026", amount: 2000 }],
      history: {
        total: 1,
        rows: [{ _id: "a", date: "2026-09-11", projectName: "P1", siteName: "S1", category: "Transport", description: "Truck", amount: 2000 }],
      },
    } as unknown as ExpenseRunnerReport;
    const buf = await renderToBuffer(
      createElement(ExpensesPdf, { report, scope: { generatedAt: "2026-09-28" } }) as never,
    );
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("salary + advances", async () => {
    const buf = await renderToBuffer(
      createElement(SalaryPdf, {
        salaryRows: [{ labourId: "l", name: "Ramesh", earned: 600, paid: 0, outstanding: 600 }],
        advanceRows: [{ labourId: "l", name: "Ramesh", given: 5000, recovered: 0, writtenOff: 0, outstanding: 5000 }],
        scope: { generatedAt: "2026-09-28" },
      }) as never,
    );
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("labour with attendance history", async () => {
    const report = {
      header: { name: "Ramesh", skill: "Mason" },
      attendance: { present: 1, half: 0, absent: 0, otHours: 2 },
      cost: { earned: 600, overtime: 200, total: 800 },
      salary: { paid: 0, outstanding: 0 },
      advanceOutstanding: 5000,
      history: {
        total: 1,
        rows: [{ _id: "a", date: "2026-09-10", projectName: "P1", siteName: "S1", status: "present", otHours: 2 }],
      },
    } as unknown as LabourReportDetail;
    const buf = await renderToBuffer(
      createElement(LabourPdf, { report, scope: { generatedAt: "2026-09-28" } }) as never,
    );
    expect(buf.length).toBeGreaterThan(1000);
  });
});
