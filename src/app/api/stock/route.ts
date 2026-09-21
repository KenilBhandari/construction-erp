import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema, paginationSchema } from "@/lib/validation";
import { stockCreateSchema } from "@/lib/schemas";
import { toDayDate, dayRange } from "@/lib/utils";
import { applyStockEffect, stockEffect } from "@/lib/stock";
import { StockTransaction } from "@/models/StockTransaction";
import { Material } from "@/models/Material";
import { Site } from "@/models/Site";
import { TRANSACTION_TYPES } from "@/types/inventory";

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
    const material = url.searchParams.get("material")?.trim() ?? "";
    const project = url.searchParams.get("project")?.trim() ?? "";
    const site = url.searchParams.get("site")?.trim() ?? "";
    const type = url.searchParams.get("type")?.trim() ?? "";
    const from = url.searchParams.get("from")?.trim() ?? "";
    const to = url.searchParams.get("to")?.trim() ?? "";

    const filter: Record<string, unknown> = {};
    for (const [key, value] of [
      ["material", material],
      ["project", project],
      ["site", site],
    ] as const) {
      if (value) {
        const parsed = objectIdSchema.safeParse(value);
        if (parsed.success) filter[key] = parsed.data;
      }
    }
    if (type) {
      const types = type
        .split(",")
        .map((t) => t.trim())
        .filter((t) => (TRANSACTION_TYPES as readonly string[]).includes(t));
      if (types.length > 0) filter.type = { $in: types };
    }
    if (from || to) {
      const { start, end } = dayRange(from || to, to || from);
      filter.date = { $gte: start, $lte: end };
    }

    const [data, total, totals] = await Promise.all([
      StockTransaction.find(filter)
        .populate("material", "name unit")
        .populate("project", "name")
        .populate("site", "name")
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      StockTransaction.countDocuments(filter),
      StockTransaction.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            quantity: { $sum: "$quantity" },
            amount: { $sum: "$total" },
          },
        },
      ]),
    ]);

    return ok({
      data,
      page,
      limit,
      total,
      totalQuantity: totals[0]?.quantity ?? 0,
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
    const body = stockCreateSchema.parse(await req.json());

    const material = await Material.findById(body.material).lean();
    if (!material) return fail(new Error("Material not found."), 404);

    let project: Types.ObjectId | null = null;
    if (body.site) {
      const site = await Site.findById(body.site).select("project").lean();
      if (!site?.project) return fail(new Error("Selected site not found."), 404);
      project = site.project as Types.ObjectId;
    }

    const rate = body.rate ?? (body.type === "purchase" ? material.defaultPurchaseRate : 0);
    const total = body.type === "purchase" ? Math.round(body.quantity * rate) : 0;

    const created = await StockTransaction.create({
      material: new Types.ObjectId(body.material),
      project,
      site: body.site ? new Types.ObjectId(body.site) : null,
      date: toDayDate(body.date),
      type: body.type,
      quantity: body.quantity,
      unit: material.unit,
      rate,
      total,
      supplier: body.supplier ?? null,
      invoiceNumber: body.invoiceNumber ?? null,
      purpose: body.purpose ?? null,
      notes: body.notes ?? null,
    });

    try {
      await applyStockEffect(body.material, stockEffect(body.type, body.quantity));
    } catch (stockErr) {
      // Roll back the ledger entry so stock and transactions stay in sync.
      await StockTransaction.findByIdAndDelete(created._id);
      return fail(stockErr, 400);
    }

    return ok(created, { status: 201 });
  } catch (err) {
    return fail(err, 422);
  }
}
