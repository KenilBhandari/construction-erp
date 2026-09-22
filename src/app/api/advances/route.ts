import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema, paginationSchema } from "@/lib/validation";
import { advanceCreateSchema } from "@/lib/schemas";
import { toDayDate, dayRange } from "@/lib/utils";
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
        .populate({ path: "site", select: "name", strictPopulate: false })
        .populate({ path: "project", select: "name", strictPopulate: false })
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

    let siteOid: Types.ObjectId | null = null;
    let projectOid: Types.ObjectId | null = null;
    if (body.site) {
      const siteDoc = await Site.findById(body.site).select("project").lean();
      if (!siteDoc) return fail(new Error("Selected site not found."), 404);
      siteOid = new Types.ObjectId(body.site);
      const siteProjectId = String(siteDoc.project);
      if (body.project && String(body.project) !== siteProjectId) {
        return fail(new Error("Selected project does not match the site's project."), 422);
      }
      projectOid = body.project ? new Types.ObjectId(body.project) : new Types.ObjectId(siteProjectId);
    } else if (body.project) {
      projectOid = new Types.ObjectId(body.project);
    }

    const created = await LabourAdvance.create({
      labour: new Types.ObjectId(body.labour),
      site: siteOid,
      project: projectOid,
      date: toDayDate(body.date),
      amount: body.amount,
      reason: body.reason ?? null,
      paymentMethod: body.paymentMethod ?? null,
      reference: body.reference ?? null,
      notes: body.notes ?? null,
    });

    // Advances have zero automatic effect on salary (Phase 3) — no recompute.

    return ok(created, { status: 201 });
  } catch (err) {
    return fail(err, 422);
  }
}
