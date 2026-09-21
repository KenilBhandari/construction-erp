import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { projectUpdateSchema } from "@/lib/schemas";
import { Project } from "@/models/Project";
import { Site } from "@/models/Site";

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
    const project = await Project.findById(id).lean();
    if (!project) return fail(new Error("Project not found."), 404);
    const siteCount = await Site.countDocuments({ project: id });
    return ok({ ...project, siteCount });
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
    const body = projectUpdateSchema.parse(await req.json());
    const updated = await Project.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    }).lean();
    if (!updated) return fail(new Error("Project not found."), 404);
    return ok(updated);
  } catch (err) {
    return fail(err, 422);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const id = await getId(params);
    await connectDB();
    const siteCount = await Site.countDocuments({ project: id });
    if (siteCount > 0) {
      return fail(
        new Error(
          `Cannot delete project with ${siteCount} site(s). Delete or move its sites first.`,
        ),
        400,
      );
    }
    const deleted = await Project.findByIdAndDelete(id).lean();
    if (!deleted) return fail(new Error("Project not found."), 404);
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
