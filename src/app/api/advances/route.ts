import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema, paginationSchema } from "@/lib/validation";
import { advanceCreateSchema } from "@/lib/schemas";
import { toDayDate, dayRange } from "@/lib/utils";
import { recomputeSalariesFor } from "@/lib/salary";
import { LabourAdvance } from "@/models/LabourAdvance";
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
    const labour = url.searchParams.get("labour")?.trim() ?? "";
    const site = url.searchParams.get("site")?.trim() ?? "";
    const from = url.searchParams.get("from")?.trim() ?? "";
    const to = url.searchParams.get("to")?.trim() ?? "";

    const filter: Record<string, unknown> = {};
    if (labour) {
      const parsed = objectIdSchema.safeParse(labour);
      if (parsed.success) filter.labour = parsed.data;
    }
    if (site) {
      const parsed = objectIdSchema.safeParse(site);
      if (parsed.success) filter.site = parsed.data;
    }
    if (from || to) {
      const { start, end } = dayRange(from || to, to || from);
      filter.date = { $gte: start, $lte: end };
    }

    const [data, total, totals] = await Promise.all([
      LabourAdvance.find(filter)
        .populate("labour", "name")
        .populate("site", "name")
        .sort({ date: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      LabourAdvance.countDocuments(filter),
      LabourAdvance.aggregate([
        { $match: filter },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
      ]),
    ]);

    return ok({
      data,
      page,
      limit,
      total,
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
    const body = advanceCreateSchema.parse(await req.json());

    const labourExists = await Labour.exists({ _id: body.labour });
    if (!labourExists) return fail(new Error("Worker not found."), 404);
    if (body.site) {
      const siteExists = await Site.exists({ _id: body.site });
      if (!siteExists) return fail(new Error("Selected site not found."), 404);
    }

    const created = await LabourAdvance.create({
      labour: new Types.ObjectId(body.labour),
      site: body.site ? new Types.ObjectId(body.site) : null,
      date: toDayDate(body.date),
      amount: body.amount,
      reason: body.reason ?? null,
      notes: body.notes ?? null,
    });

    try {
      await recomputeSalariesFor([body.labour], created.date);
    } catch (err) {
      console.warn("[advances] salary recompute skipped:", (err as Error).message);
    }

    return ok(created, { status: 201 });
  } catch (err) {
    return fail(err, 422);
  }
}
