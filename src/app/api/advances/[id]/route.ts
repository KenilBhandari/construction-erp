import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { advanceUpdateSchema } from "@/lib/schemas";
import { toDayDate } from "@/lib/utils";
import { LabourAdvance } from "@/models/LabourAdvance";
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
    const record = await LabourAdvance.findById(id)
      .populate("labour", "name")
      .populate({ path: "site", select: "name", strictPopulate: false })
      .populate({ path: "project", select: "name", strictPopulate: false })
      .lean();
    if (!record) return fail(new Error("Advance not found."), 404);
    return ok(record);
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
    const body = advanceUpdateSchema.parse(await req.json());

    let siteOid: Types.ObjectId | null | undefined = undefined;
    let projectOid: Types.ObjectId | null | undefined = undefined;
    if (body.site !== undefined) {
      if (body.site) {
        const siteDoc = await Site.findById(body.site).select("project").lean();
        if (!siteDoc) return fail(new Error("Selected site not found."), 404);
        const siteProjectId = String(siteDoc.project);
        if (body.project !== undefined && body.project && String(body.project) !== siteProjectId) {
          return fail(new Error("Selected project does not match the site's project."), 422);
        }
        siteOid = new Types.ObjectId(body.site);
        if (body.project !== undefined) {
          projectOid = body.project ? new Types.ObjectId(body.project) : new Types.ObjectId(siteProjectId);
        } else {
          projectOid = new Types.ObjectId(siteProjectId);
        }
      } else {
        siteOid = null;
        if (body.project !== undefined) {
          projectOid = body.project ? new Types.ObjectId(body.project) : null;
        }
      }
    } else if (body.project !== undefined) {
      projectOid = body.project ? new Types.ObjectId(body.project) : null;
    }

    const updated = await LabourAdvance.findByIdAndUpdate(
      id,
      {
        ...(body.date !== undefined ? { date: toDayDate(body.date) } : {}),
        ...(body.amount !== undefined ? { amount: body.amount } : {}),
        ...(body.reason !== undefined ? { reason: body.reason } : {}),
        ...(body.paymentMethod !== undefined ? { paymentMethod: body.paymentMethod } : {}),
        ...(body.reference !== undefined ? { reference: body.reference } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(siteOid !== undefined ? { site: siteOid } : {}),
        ...(projectOid !== undefined ? { project: projectOid } : {}),
      },
      { new: true, runValidators: true },
    )
      .populate("labour", "name")
      .populate({ path: "site", select: "name", strictPopulate: false })
      .populate({ path: "project", select: "name", strictPopulate: false })
      .lean();
    if (!updated) return fail(new Error("Advance not found."), 404);
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
    const deleted = await LabourAdvance.findByIdAndDelete(id).lean();
    if (!deleted) return fail(new Error("Advance not found."), 404);
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
