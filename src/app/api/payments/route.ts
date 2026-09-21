import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema, paginationSchema } from "@/lib/validation";
import { paymentCreateSchema } from "@/lib/schemas";
import { toDayDate, dayRange } from "@/lib/utils";
import { ClientPayment } from "@/models/ClientPayment";
import { Project } from "@/models/Project";

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
    const from = url.searchParams.get("from")?.trim() ?? "";
    const to = url.searchParams.get("to")?.trim() ?? "";

    const filter: Record<string, unknown> = {};
    if (project) {
      const parsed = objectIdSchema.safeParse(project);
      if (parsed.success) filter.project = parsed.data;
    }
    if (from || to) {
      const { start, end } = dayRange(from || to, to || from);
      filter.date = { $gte: start, $lte: end };
    }

    const [data, total, totals] = await Promise.all([
      ClientPayment.find(filter)
        .populate("project", "name clientName")
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ClientPayment.countDocuments(filter),
      ClientPayment.aggregate([
        { $match: filter },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
      ]),
    ]);

    return ok({
      data,
      page,
      limit,
      total,
      totalReceived: totals[0]?.amount ?? 0,
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
    const body = paymentCreateSchema.parse(await req.json());

    const exists = await Project.exists({ _id: body.project });
    if (!exists) return fail(new Error("Selected project not found."), 404);

    const created = await ClientPayment.create({
      project: new Types.ObjectId(body.project),
      date: toDayDate(body.date),
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      reference: body.reference ?? null,
      notes: body.notes ?? null,
    });

    return ok(created, { status: 201 });
  } catch (err) {
    return fail(err, 422);
  }
}
