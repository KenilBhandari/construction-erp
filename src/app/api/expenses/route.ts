import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema, paginationSchema } from "@/lib/validation";
import { expenseCreateSchema } from "@/lib/schemas";
import { toDayDate, dayRange } from "@/lib/utils";
import { Expense } from "@/models/Expense";
import { Project } from "@/models/Project";
import { Site } from "@/models/Site";
import { EXPENSE_CATEGORIES } from "@/types/finance";

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
    const project = url.searchParams.get("project")?.trim() ?? "";
    const site = url.searchParams.get("site")?.trim() ?? "";
    const category = url.searchParams.get("category")?.trim() ?? "";
    const from = url.searchParams.get("from")?.trim() ?? "";
    const to = url.searchParams.get("to")?.trim() ?? "";

    const filter: Record<string, unknown> = {};
    for (const [key, value] of [
      ["project", project],
      ["site", site],
    ] as const) {
      if (value) {
        const parsed = objectIdSchema.safeParse(value);
        if (parsed.success) filter[key] = parsed.data;
      }
    }
    if (category && (EXPENSE_CATEGORIES as readonly string[]).includes(category)) {
      filter.category = category;
    }
    if (from || to) {
      const { start, end } = dayRange(from || to, to || from);
      filter.date = { $gte: start, $lte: end };
    }

    const [data, total, totals] = await Promise.all([
      Expense.find(filter)
        .populate("project", "name")
        .populate("site", "name")
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Expense.countDocuments(filter),
      Expense.aggregate([
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
    const body = expenseCreateSchema.parse(await req.json());

    if (body.project) {
      const exists = await Project.exists({ _id: body.project });
      if (!exists) return fail(new Error("Selected project not found."), 404);
    }
    if (body.site) {
      const site = await Site.findById(body.site).select("project").lean();
      if (!site) return fail(new Error("Selected site not found."), 404);
    }

    const created = await Expense.create({
      project: body.project ? new Types.ObjectId(body.project) : null,
      site: body.site ? new Types.ObjectId(body.site) : null,
      date: toDayDate(body.date),
      category: body.category,
      description: body.description,
      amount: body.amount,
      vendor: body.vendor ?? null,
      paymentMethod: body.paymentMethod,
      reference: body.reference ?? null,
      notes: body.notes ?? null,
      expenseType: body.expenseType ?? null,
      labour: body.labour ? new Types.ObjectId(body.labour) : null,
      labourAdvance: body.labourAdvance ? new Types.ObjectId(body.labourAdvance) : null,
    });

    return ok(created, { status: 201 });
  } catch (err) {
    return fail(err, 422);
  }
}
