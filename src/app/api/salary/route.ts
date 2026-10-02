import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth, idempotencyKeyFrom } from "@/lib/api";
import { objectIdSchema, paginationSchema } from "@/lib/validation";
import { salaryComputeSchema } from "@/lib/schemas";
import { toDayDate } from "@/lib/utils";
import { computeAndSaveSalary } from "@/lib/salary";
import { Labour } from "@/models/Labour";
import { Salary } from "@/models/Salary";
import { SALARY_STATUSES } from "@/types/salary";

export async function GET(req: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    await connectDB();
    const url = new URL(req.url);
    const { page, limit } = paginationSchema.parse({
      page: url.searchParams.get("page"),
      limit: url.searchParams.get("limit"),
    });
    const labour = url.searchParams.get("labour")?.trim() ?? "";
    const q = url.searchParams.get("q")?.trim() ?? "";
    const status = url.searchParams.get("status")?.trim() ?? "";
    const from = url.searchParams.get("from")?.trim() ?? "";
    const to = url.searchParams.get("to")?.trim() ?? "";
    const sort = url.searchParams.get("sort")?.trim() ?? "";
    // Date toggle sorts by period start; default keeps legacy periodEnd desc.
    const sortSpec: Record<string, 1 | -1> =
      sort === "start-asc"
        ? { periodStart: 1, periodEnd: 1 }
        : sort === "start-desc"
          ? { periodStart: -1, periodEnd: -1 }
          : { periodEnd: -1 };

    const filter: Record<string, unknown> = {};
    if (labour) {
      const parsed = objectIdSchema.safeParse(labour);
      if (parsed.success) filter.labour = parsed.data;
    }
    // Worker text search (same `q` convention as /api/labour and /api/overtime):
    // resolve matching labour ids first, then constrain. An explicit `labour`
    // id intersects — a selected worker outside the search yields no rows.
    if (q) {
      const matched = await Labour.find({
        $or: [
          { name: { $regex: q, $options: "i" } },
          { phone: { $regex: q, $options: "i" } },
        ],
      })
        .select("_id")
        .lean();
      const ids = matched.map((l) => l._id);
      if (labour && filter.labour) {
        const selected = String(filter.labour);
        filter.labour = ids.some((id) => String(id) === selected)
          ? filter.labour
          : { $in: [] };
      } else {
        filter.labour = { $in: ids };
      }
    }
    if (status) {
      const parts = status.split(",").map((s) => s.trim()).filter(Boolean);
      const valid = parts.filter((s) => (SALARY_STATUSES as readonly string[]).includes(s));
      if (valid.length === 1) filter.status = valid[0];
      else if (valid.length > 1) filter.status = { $in: valid } as unknown as string;
    }
    if (from || to) {
      const overlap: Record<string, unknown>[] = [];
      if (from) overlap.push({ periodEnd: { $gte: toDayDate(from) } });
      if (to) overlap.push({ periodStart: { $lte: toDayDate(to) } });
      filter.$and = overlap;
    }

    const [data, total] = await Promise.all([
      Salary.find(filter)
        .populate("labour", "name")
        .populate({ path: "site", select: "name", strictPopulate: false })
        .populate({ path: "project", select: "name", strictPopulate: false })
        .populate({ path: "earningsBreakdown.site", select: "name", strictPopulate: false })
        .populate({ path: "earningsBreakdown.project", select: "name", strictPopulate: false })
        .sort(sortSpec)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Salary.countDocuments(filter),
    ]);

    return ok({ data, page, limit, total });
  } catch (err) {
    return fail(err);
  }
}

/** Calculate (or recalculate) salary for a labourer + period. */
export async function POST(req: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    await connectDB();
    const body = salaryComputeSchema.parse(await req.json());
    const headerKey = idempotencyKeyFrom(req);
    if (headerKey) {
      const existingByKey = await Salary.findOne({ idempotencyKey: headerKey }).lean();
      if (existingByKey) return ok(existingByKey);
    }
    const saved = await computeAndSaveSalary({
      labourId: body.labour,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      advanceRecovery: body.advanceRecovery ?? 0,
      deductions: body.deductions ?? 0,
      site: body.site ?? null,
      project: body.project ?? null,
      notes: body.notes ?? null,
      idempotencyKey: headerKey ?? undefined,
    });
    if (!saved) return fail(new Error("Failed to calculate salary."), 500);
    const populated = await Salary.findById(saved._id)
      .populate("labour", "name")
      .populate({ path: "site", select: "name", strictPopulate: false })
      .populate({ path: "project", select: "name", strictPopulate: false })
      .populate({ path: "earningsBreakdown.site", select: "name", strictPopulate: false })
      .populate({ path: "earningsBreakdown.project", select: "name", strictPopulate: false })
      .lean();
    return ok(populated ?? saved);
  } catch (err) {
    return fail(err, 422);
  }
}
