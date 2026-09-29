import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { fail, ok, requireAuth } from "@/lib/api";
import { objectIdSchema, paginationSchema } from "@/lib/validation";
import { assignmentCreateSchema } from "@/lib/schemas";
import { Labour } from "@/models/Labour";
import { LabourAssignment } from "@/models/LabourAssignment";
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

    const filter: Record<string, unknown> = {};
    if (labour) {
      filter.labour = objectIdSchema.parse(labour);
    }

    const [data, total] = await Promise.all([
      LabourAssignment.find(filter)
        .populate("site", "name")
        .sort({ from: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      LabourAssignment.countDocuments(filter),
    ]);

    return ok({ data, page, limit, total });
  } catch (err) {
    return fail(err);
  }
}

/**
 * Assign (or reassign) a labourer to a site. Closes the open assignment
 * and opens a new one; updates Labour.assignedSite. History is preserved.
 * site: null unassigns — closes the open assignment without opening one.
 */
export async function POST(req: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    await connectDB();
    const body = assignmentCreateSchema.parse(await req.json());

    const labour = await Labour.findById(body.labour);
    if (!labour) return fail(new Error("Labour not found."), 404);

    const from = body.from ?? new Date();

    if (!body.site) {
      // Unassign: close any open assignment, clear the current site.
      await LabourAssignment.updateMany(
        { labour: body.labour, to: null },
        { $set: { to: from } },
      );
      labour.assignedSite = null;
      await labour.save();
      return ok({ unassigned: true }, { status: 200 });
    }

    const siteExists = await Site.exists({ _id: body.site });
    if (!siteExists) return fail(new Error("Selected site not found."), 404);

    // Close any open assignment the day the new one starts.
    await LabourAssignment.updateMany(
      { labour: body.labour, to: null },
      { $set: { to: from } },
    );

    const created = await LabourAssignment.create({
      labour: body.labour,
      site: body.site,
      from,
      notes: body.notes ?? null,
    });

    labour.assignedSite = new Types.ObjectId(body.site);
    await labour.save();

    // Trim history to 10 most recent — delete oldest beyond 10.
    const history = await LabourAssignment.find({ labour: body.labour }).sort({ from: -1 }).select("_id").lean();
    if (history.length > 10) {
      const keepIds = history.slice(0, 10).map((h) => h._id);
      await LabourAssignment.deleteMany({ labour: body.labour, _id: { $nin: keepIds } });
    }

    return ok(created, { status: 201 });
  } catch (err) {
    return fail(err, 422);
  }
}
