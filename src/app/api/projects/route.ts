import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { paginationSchema } from "@/lib/validation";
import { projectCreateSchema } from "@/lib/schemas";
import { Project } from "@/models/Project";
import { PROJECT_STATUSES } from "@/types/project";

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

    const filter: Record<string, unknown> = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { clientName: { $regex: q, $options: "i" } },
        { location: { $regex: q, $options: "i" } },
      ];
    }
    if (status && (PROJECT_STATUSES as readonly string[]).includes(status)) {
      filter.status = status;
    }

    const [data, total] = await Promise.all([
      Project.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Project.countDocuments(filter),
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
    const body = projectCreateSchema.parse(await req.json());
    const created = await Project.create(body);
    return ok(created, { status: 201 });
  } catch (err) {
    return fail(err, 422);
  }
}
