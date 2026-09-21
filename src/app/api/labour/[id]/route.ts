import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { labourUpdateSchema } from "@/lib/schemas";
import { Labour } from "@/models/Labour";
import { LabourAssignment } from "@/models/LabourAssignment";

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
    const labour = await Labour.findById(id)
      .populate("assignedSite", "name")
      .lean();
    if (!labour) return fail(new Error("Labour not found."), 404);
    const assignments = await LabourAssignment.find({ labour: id })
      .populate("site", "name")
      .sort({ from: -1 })
      .lean();
    return ok({ ...labour, assignments });
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
    const body = labourUpdateSchema.parse(await req.json());
    // Site changes must go through /api/assignments to preserve history.
    if (body.assignedSite !== undefined) {
      return fail(
        new Error("Use Assign Site to change sites — it keeps history intact."),
        400,
      );
    }
    const updated = await Labour.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    })
      .populate("assignedSite", "name")
      .lean();
    if (!updated) return fail(new Error("Labour not found."), 404);
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
    // Prefer deactivation: hard delete only when no assignment history.
    // (Attendance/salary guards will extend this in later steps.)
    const historyCount = await LabourAssignment.countDocuments({ labour: id });
    if (historyCount > 0) {
      return fail(
        new Error(
          "This labourer has site history — deactivate instead of deleting to keep records intact.",
        ),
        400,
      );
    }
    const deleted = await Labour.findByIdAndDelete(id).lean();
    if (!deleted) return fail(new Error("Labour not found."), 404);
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
