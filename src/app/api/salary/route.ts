import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth, idempotencyKeyFrom } from "@/lib/api";
import { objectIdSchema, paginationSchema } from "@/lib/validation";
import { salaryComputeSchema } from "@/lib/schemas";
import { toDayDate } from "@/lib/utils";
import { computeAndSaveSalary } from "@/lib/salary";
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
    const status = url.searchParams.get("status")?.trim() ?? "";
    const from = url.searchParams.get("from")?.trim() ?? "";
    const to = url.searchParams.get("to")?.trim() ?? "";

    const filter: Record<string, unknown> = {};
    if (labour) {
      const parsed = objectIdSchema.safeParse(labour);
      if (parsed.success) filter.labour = parsed.data;
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
        .sort({ periodEnd: -1 })
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
      site: body.site ?? null,
      project: body.project ?? null,
      notes: body.notes ?? null,
      idempotencyKey: headerKey ?? undefined,
    });
    return ok(saved);
  } catch (err) {
    return fail(err, 422);
  }
}
