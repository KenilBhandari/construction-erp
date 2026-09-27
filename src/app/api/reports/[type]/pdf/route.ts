import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { connectDB } from "@/lib/mongodb";
import { fail, requireAuth } from "@/lib/api";
import { Site } from "@/models/Site";
import { Labour } from "@/models/Labour";
import { getBulkAdvanceSummaries } from "@/lib/advances";
import {
  getProjectReport,
  getSiteReport,
  getLabourReportDetail,
  getMaterialReport,
  getExpenseRunnerReport,
  getPaymentRunnerReport,
  getCashFlow,
  getSalaryAnalysis,
  getAdvanceReport,
  ProjectPdf,
  SitePdf,
  LabourPdf,
  MaterialsPdf,
  ExpensesPdf,
  PaymentsPdf,
  CashFlowPdf,
  SalaryPdf,
} from "@/lib/reports";

/** Full-history PDF for a report scope — same service as the screen, never recalculated. */
const PDF_PAGE_SIZE = 10000;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { type } = await params;
    if (
      type !== "project" &&
      type !== "site" &&
      type !== "labour" &&
      type !== "materials" &&
      type !== "expenses" &&
      type !== "payments" &&
      type !== "cashflow" &&
      type !== "salary"
    ) {
      return fail(new Error("Unknown report type."), 404);
    }
    await connectDB();
    const url = new URL(req.url);
    const projectId = url.searchParams.get("project")?.trim() || undefined;
    const siteId = url.searchParams.get("site")?.trim() || undefined;
    const labourId = url.searchParams.get("worker")?.trim() || undefined;
    const materialId = url.searchParams.get("material")?.trim() || undefined;
    const category = url.searchParams.get("category")?.trim() || undefined;
    const from = url.searchParams.get("from")?.trim() || undefined;
    const to = url.searchParams.get("to")?.trim() || undefined;
    const generatedAt = new Date().toISOString().slice(0, 10);

    if (type === "materials") {
      if (!materialId) return fail(new Error("Material is required."), 422);
      const report = await getMaterialReport({ materialId, projectId, siteId, from, to, pageSize: PDF_PAGE_SIZE });
      const buffer = await renderToBuffer(
        createElement(MaterialsPdf, { report, scope: { from, to, generatedAt } }) as unknown as Parameters<typeof renderToBuffer>[0],
      );
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="materials-${materialId.slice(-6)}.pdf"`,
        },
      });
    }

    if (type === "expenses") {
      const report = await getExpenseRunnerReport({ projectId, siteId, category, from, to, pageSize: PDF_PAGE_SIZE });
      const buffer = await renderToBuffer(
        createElement(ExpensesPdf, { report, scope: { from, to, generatedAt } }) as unknown as Parameters<typeof renderToBuffer>[0],
      );
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="expenses-${generatedAt}.pdf"`,
        },
      });
    }

    if (type === "project") {
      if (!projectId) return fail(new Error("Project is required."), 422);
      const report = await getProjectReport({ projectId, from, to, siteId, pageSize: PDF_PAGE_SIZE });
      let siteName: string | undefined;
      if (siteId) siteName = (await Site.findById(siteId).select("name").lean())?.name as string | undefined;
      const buffer = await renderToBuffer(
        createElement(ProjectPdf, { report, scope: { from, to, siteName, generatedAt } }) as unknown as Parameters<typeof renderToBuffer>[0],
      );
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="project-financials-${projectId.slice(-6)}.pdf"`,
        },
      });
    }

    if (type === "site") {
      if (!siteId) return fail(new Error("Site is required."), 422);
      const report = await getSiteReport({ siteId, from, to, pageSize: PDF_PAGE_SIZE });
      const buffer = await renderToBuffer(
        createElement(SitePdf, { report, scope: { from, to, generatedAt } }) as unknown as Parameters<typeof renderToBuffer>[0],
      );
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="site-performance-${siteId.slice(-6)}.pdf"`,
        },
      });
    }

    if (type === "labour") {
      if (!labourId) return fail(new Error("Worker is required."), 422);
      const report = await getLabourReportDetail({
        labourId,
        projectId,
        siteId,
        from,
        to,
        pageSize: PDF_PAGE_SIZE,
      });
      const buffer = await renderToBuffer(
        createElement(LabourPdf, { report, scope: { from, to, generatedAt } }) as unknown as Parameters<typeof renderToBuffer>[0],
      );
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="labour-attendance-${labourId.slice(-6)}.pdf"`,
        },
      });
    }

    if (type === "payments") {
      const report = await getPaymentRunnerReport({ projectId, from, to, pageSize: PDF_PAGE_SIZE });
      const buffer = await renderToBuffer(
        createElement(PaymentsPdf, { report, scope: { from, to, generatedAt } }) as unknown as Parameters<typeof renderToBuffer>[0],
      );
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="client-payments-${generatedAt}.pdf"`,
        },
      });
    }

    if (type === "cashflow") {
      const months = await getCashFlow({ projectId, from, to });
      const buffer = await renderToBuffer(
        createElement(CashFlowPdf, { months, scope: { from, to, generatedAt } }) as unknown as Parameters<typeof renderToBuffer>[0],
      );
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="cash-flow-${generatedAt}.pdf"`,
        },
      });
    }

    // salary — worker/period sums only, never Salary.site/project slicing.
    const [salaryRows, advanceRows] = await Promise.all([
      getSalaryAnalysis({ from, to, labourId }),
      (async () => {
        if (!labourId) {
          const r = await getAdvanceReport({ from, to });
          return r.rows;
        }
        const m = await getBulkAdvanceSummaries([labourId]);
        const s = m.get(labourId);
        if (!s || (s.totalGiven === 0 && s.outstanding === 0)) return [];
        const w = await Labour.findById(labourId).select("name").lean();
        return [
          {
            labourId,
            name: (w?.name as string) ?? "—",
            given: s.totalGiven,
            recovered: s.totalRecovered,
            writtenOff: s.totalWrittenOff,
            outstanding: s.outstanding,
          },
        ];
      })(),
    ]);
    const buffer = await renderToBuffer(
      createElement(SalaryPdf, { salaryRows, advanceRows, scope: { from, to, generatedAt } }) as unknown as Parameters<typeof renderToBuffer>[0],
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="salary-advances-${generatedAt}.pdf"`,
      },
    });
  } catch (err) {
    return fail(err);
  }
}
