import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema, paginationSchema } from "@/lib/validation";
import { labourCreateSchema } from "@/lib/schemas";
import { Labour } from "@/models/Labour";
import { LabourAssignment } from "@/models/LabourAssignment";
import { Site } from "@/models/Site";
import { LABOUR_STATUSES } from "@/types/labour";

const SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  name: { name: 1 },
  rate: { dailyRate: -1 },
};

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
    const q = url.searchParams.get("q")?.trim() ?? "";
    const skill = url.searchParams.get("skill")?.trim() ?? "";
    const site = url.searchParams.get("site")?.trim() ?? "";
    const status = url.searchParams.get("status")?.trim() ?? "";
    const sort = url.searchParams.get("sort")?.trim() ?? "newest";

    const filter: Record<string, unknown> = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ];
    }
    if (skill) filter.skill = skill;
    if (status && (LABOUR_STATUSES as readonly string[]).includes(status)) {
      filter.status = status;
    }
    if (site) {
      const parsed = objectIdSchema.safeParse(site);
      if (parsed.success) filter.assignedSite = parsed.data;
    }

    const [data, total] = await Promise.all([
      Labour.find(filter)
        .populate("assignedSite", "name")
        .sort(SORTS[sort] ?? SORTS.newest)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Labour.countDocuments(filter),
    ]);

    return ok({ data, page, limit, total });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    await connectDB();
    const body = labourCreateSchema.parse(await req.json());
    if (body.assignedSite) {
      const siteExists = await Site.exists({ _id: body.assignedSite });
      if (!siteExists) return fail(new Error("Selected site not found."), 404);
    }
    const created = await Labour.create({
      ...body,
      assignedSite: body.assignedSite ?? null,
    });
    // Open an assignment record so history starts at registration (§14).
    if (created.assignedSite) {
      await LabourAssignment.create({
        labour: created._id,
        site: created.assignedSite,
        from: created.joiningDate ?? new Date(),
      });
      // Trim history to 10 most recent — delete oldest beyond 10.
      const history = await LabourAssignment.find({ labour: created._id }).sort({ from: -1 }).select("_id").lean();
      if (history.length > 10) {
        const keepIds = history.slice(0, 10).map((h) => h._id);
        await LabourAssignment.deleteMany({ labour: created._id, _id: { $nin: keepIds } });
      }
    }
    return ok(created, { status: 201 });
  } catch (err) {
    return fail(err, 422);
  }
}
