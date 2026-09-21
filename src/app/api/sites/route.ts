import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema, paginationSchema } from "@/lib/validation";
import { siteCreateSchema } from "@/lib/schemas";
import { Site } from "@/models/Site";
import { SITE_STATUSES } from "@/types/site";
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
    const q = url.searchParams.get("q")?.trim() ?? "";
    const status = url.searchParams.get("status")?.trim() ?? "";
    const project = url.searchParams.get("project")?.trim() ?? "";

    const filter: Record<string, unknown> = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { supervisor: { $regex: q, $options: "i" } },
        { location: { $regex: q, $options: "i" } },
      ];
    }
    if (status && (SITE_STATUSES as readonly string[]).includes(status)) {
      filter.status = status;
    }
    if (project) {
      const parsed = objectIdSchema.safeParse(project);
      if (parsed.success) filter.project = parsed.data;
    }

    const [data, total] = await Promise.all([
      Site.find(filter)
        .populate("project", "name")
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Site.countDocuments(filter),
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
    const body = siteCreateSchema.parse(await req.json());
    const projectExists = await Project.exists({ _id: body.project });
    if (!projectExists) return fail(new Error("Selected project not found."), 404);
    const created = await Site.create(body);
    return ok(created, { status: 201 });
  } catch (err) {
    return fail(err, 422);
  }
}

export async function DELETE(req: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const body = await req.json();
    const ids = body.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return fail(new Error("At least one site ID is required."), 400);
    }

    await connectDB();
    // Future steps: also block when attendance/salary/stock reference this site.

    const deleted = await Site.deleteMany({ _id: { $in: ids } });
    return ok({
      deleted: true,
      count: deleted.deletedCount,
    });
  } catch (err) {
    return fail(err);
  }
}