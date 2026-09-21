import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { siteUpdateSchema } from "@/lib/schemas";
import { Site } from "@/models/Site";
import { Project } from "@/models/Project";

async function getId(params: Promise<{ id: string }>) {
  const { id } = await params;
  return objectIdSchema.parse(id);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const id = await getId(params);
    await connectDB();
    const site = await Site.findById(id).populate("project", "name").lean();
    if (!site) return fail(new Error("Site not found."), 404);
    return ok(site);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const id = await getId(params);
    await connectDB();
    const body = siteUpdateSchema.parse(await req.json());
    if (body.project) {
      const projectExists = await Project.exists({ _id: body.project });
      if (!projectExists) return fail(new Error("Selected project not found."), 404);
    }
    const updated = await Site.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    })
      .populate("project", "name")
      .lean();
    if (!updated) return fail(new Error("Site not found."), 404);
    return ok(updated);
  } catch (err) {
    return fail(err, 422);
  }
}

