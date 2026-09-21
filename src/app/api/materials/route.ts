import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { paginationSchema } from "@/lib/validation";
import { materialCreateSchema } from "@/lib/schemas";
import { toDayDate } from "@/lib/utils";
import { applyStockEffect } from "@/lib/stock";
import { Material } from "@/models/Material";
import { StockTransaction } from "@/models/StockTransaction";

const SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  name: { name: 1 },
  stock: { currentStock: 1 },
};

export async function GET(req: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    await connectDB();
    const url = new URL(req.url);
    console.log("ddasfsdfs");
    const { page, limit } = paginationSchema.parse({
      page: url.searchParams.get("page"),
      limit: url.searchParams.get("limit"),
    });
    const q = url.searchParams.get("q")?.trim() ?? "";
    const category = url.searchParams.get("category")?.trim() ?? "";
    const lowStock = url.searchParams.get("lowStock")?.trim() ?? "";
    const sort = url.searchParams.get("sort")?.trim() ?? "newest";

    const filter: Record<string, unknown> = {};
    if (q) filter.name = { $regex: q, $options: "i" };
    if (category) filter.category = category;
    // currentStock <= minimumStock — needs field comparison.
    if (lowStock === "true") filter.$expr = { $lte: ["$currentStock", "$minimumStock"] };

    const [data, total, lowCount] = await Promise.all([
      Material.find(filter)
        .sort(SORTS[sort] ?? SORTS.newest)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Material.countDocuments(filter),
      Material.countDocuments({
        $expr: { $lte: ["$currentStock", "$minimumStock"] },
      }),
    ]);
console.log(data);

    return ok({ data, page, limit, total, lowCount });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    await connectDB();
    const body = materialCreateSchema.parse(await req.json());
    const created = await Material.create({
      name: body.name,
      category: body.category,
      unit: body.unit,
      currentStock: 0,
      minimumStock: body.minimumStock,
      defaultPurchaseRate: body.defaultPurchaseRate,
      notes: body.notes ?? null,
    });
    // Opening balance enters the ledger as an adjustment — stock always
    // derives from transactions.
    if (body.openingStock > 0) {
      await StockTransaction.create({
        material: created._id,
        project: null,
        site: null,
        date: toDayDate(new Date().toISOString().slice(0, 10)),
        type: "adjustment",
        quantity: body.openingStock,
        unit: body.unit,
        rate: 0,
        total: 0,
        notes: "Opening stock",
      });
      await applyStockEffect(String(created._id), body.openingStock);
    }
    const fresh = await Material.findById(created._id).lean();
    return ok(fresh, { status: 201 });
  } catch (err) {
    return fail(err, 422);
  }
}
