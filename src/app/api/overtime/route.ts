import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth, idempotencyKeyFrom } from "@/lib/api";
import { objectIdSchema, paginationSchema } from "@/lib/validation";
import { overtimeCreateSchema } from "@/lib/schemas";
import { toDayDate, dayRange } from "@/lib/utils";
import { calculateOvertimeAmount } from "@/lib/calculations";
import { recomputeSalariesFor, handleAttendanceChangeForReconciliation } from "@/lib/salary";
import { Overtime } from "@/models/Overtime";
import { Labour } from "@/models/Labour";
import { Site } from "@/models/Site";

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
    if (headerKey) {
      const existing = await Overtime.findOne({ idempotencyKey: headerKey }).lean();
      if (existing) return ok(existing, { status: 200 });
    }

    const [labour, site] = await Promise.all([
      Labour.findById(body.labour).select("hourlyRate").lean(),
      Site.findById(body.site).select("project").lean(),
    ]);
    if (!labour) return fail(new Error("Worker not found."), 404);
    if (!site?.project) return fail(new Error("Selected site not found."), 404);

    const day = toDayDate(body.date);
    const existingOt = await Overtime.findOne({ labour: new Types.ObjectId(body.labour), date: day }).lean();
    if (existingOt) return fail(new Error("Overtime already exists for this worker on this date. Edit the existing record instead."), 409);

    const rate = body.rate ?? labour.hourlyRate;
    const amount = Math.round(calculateOvertimeAmount(body.hours, rate));

    let created;
    try {
      created = await Overtime.create({
        labour: new Types.ObjectId(body.labour),
        site: new Types.ObjectId(body.site),
        project: site.project,
        date: day,
        hours: body.hours,
        rate,
        amount,
        notes: body.notes ?? null,
        idempotencyKey: headerKey ?? undefined,
      });
    } catch (e: unknown) {
      const msg = (e as { code?: number; message?: string })?.message ?? "";
      const code = (e as { code?: number })?.code;
      if (code === 11000 || msg.includes("duplicate key") || msg.includes("E11000")) {
        if (headerKey) {
          const again = await Overtime.findOne({ idempotencyKey: headerKey }).lean();
          if (again) return ok(again);
        }
        return fail(new Error("Overtime already exists for this worker on this date. Edit the existing record instead."), 409);
      }
      throw e;
    }

    try {
      await recomputeSalariesFor([body.labour], created.date);
      await handleAttendanceChangeForReconciliation([body.labour], created.date);
    } catch (err) {
      console.warn("[overtime] salary recompute skipped:", (err as Error).message);
    }

    return ok(created, { status: 201 });
  } catch (err) {
    return fail(err, 422);
  }
}
