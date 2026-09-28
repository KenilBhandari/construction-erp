import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth, idempotencyKeyFrom } from "@/lib/api";
import { objectIdSchema, paginationSchema } from "@/lib/validation";
import { overtimeCreateSchema } from "@/lib/schemas";
import { toDayDate, dayRange } from "@/lib/utils";
import { saveOvertime } from "@/lib/overtime";
import { Overtime } from "@/models/Overtime";

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
    const date = url.searchParams.get("date")?.trim() ?? "";
    const from = url.searchParams.get("from")?.trim() ?? "";
    const to = url.searchParams.get("to")?.trim() ?? "";
    const project = url.searchParams.get("project")?.trim() ?? "";
    const site = url.searchParams.get("site")?.trim() ?? "";
    const labour = url.searchParams.get("labour")?.trim() ?? "";

    const filter: Record<string, unknown> = {};
    if (date) filter.date = toDayDate(date);
    else if (from || to) {
      const { start, end } = dayRange(from || to, to || from);
      filter.date = { $gte: start, $lte: end };
    }
    for (const [key, value] of [
      ["project", project],
      ["site", site],
      ["labour", labour],
    ] as const) {
      if (value) {
        const parsed = objectIdSchema.safeParse(value);
        if (parsed.success) filter[key] = parsed.data;
      }
    }

    const [data, total, totals] = await Promise.all([
      Overtime.find(filter)
        .populate("labour", "name")
        .populate("site", "name")
        .populate("project", "name")
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Overtime.countDocuments(filter),
      Overtime.aggregate([
        { $match: filter },
        { $group: { _id: null, hours: { $sum: "$hours" }, amount: { $sum: "$amount" } } },
      ]),
    ]);

    return ok({
      data,
      page,
      limit,
      total,
      totalHours: totals[0]?.hours ?? 0,
      totalAmount: totals[0]?.amount ?? 0,
    });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    await connectDB();
    const body = overtimeCreateSchema.parse(await req.json());
    const headerKey = idempotencyKeyFrom(req);
    try {
      const { record } = await saveOvertime({
        labour: body.labour,
        site: body.site,
        date: body.date,
        hours: body.hours,
        rate: body.rate,
        notes: body.notes,
        idempotencyKey: headerKey ?? undefined,
      });
      return ok(record, { status: 201 });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("already exists")) return fail(e, 409);
      throw e;
    }
  } catch (err) {
    return fail(err, 422);
  }
}
