import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { formatDateShort, formatINR } from "@/lib/utils";
import { Labour } from "@/models/Labour";
import { LabourAssignment } from "@/models/LabourAssignment";
import { Attendance } from "@/models/Attendance";
import { Salary } from "@/models/Salary";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { LabourActions } from "@/components/labour/labour-actions";
import { LabourWriteOffSection } from "@/components/labour/labour-write-off";
import { LabourAttendanceHistory } from "@/components/labour/labour-attendance-history";

export default async function LabourDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();
  await connectDB();

  const labour = await Labour.findById(id)
    .populate("assignedSite", "name")
    .lean();
  if (!labour) notFound();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  const labourFilter = { labour: new Types.ObjectId(id) };
  const monthFilter = { labour: new Types.ObjectId(id), date: { $gte: monthStart, $lte: monthEnd } };
  const [assignments, attendanceAgg, salaryAgg] = await Promise.all([
    LabourAssignment.find({ labour: id })
      .populate("site", "name")
      .sort({ from: -1, _id: -1 })
      .limit(25)
      .lean(),
    Attendance.aggregate([
      { $match: monthFilter },
      { $group: { _id: "$status", days: { $sum: 1 }, ot: { $sum: "$overtimeHours" } } },
    ]),
    Salary.aggregate([
      { $match: labourFilter },
      {
        $group: {
          _id: null,
          periods: { $sum: 1 },
          net: { $sum: "$net" },
          paid: { $sum: "$paidAmount" },
        },
      },
    ]),
  ]);

  const attByStatus: Record<string, number> = {};
  let attOT = 0;
  for (const row of attendanceAgg as { _id: string; days: number; ot: number }[]) {
    attByStatus[row._id] = row.days;
    attOT += row.ot ?? 0;
  }
  const salaryTotals = salaryAgg[0] as
    | { periods: number; net: number; paid: number }
    | undefined;

  const lid = String(labour._id);
  // Populated at runtime; typed as ObjectId by the schema.
  const assigned = labour.assignedSite as unknown as {
    _id: unknown;
    name: unknown;
  } | null;
  const siteId = assigned ? String(assigned._id) : null;
  const siteName = assigned ? String(assigned.name) : null;

  const hasNotes = !!labour.notes?.trim();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={labour.name}
        action={
          <LabourActions
            labourId={lid}
            labourName={labour.name}
            status={labour.status}
            currentSiteId={siteId}
          />
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <Card className="p-5 flex flex-col h-full">
          <h2 className="text-base font-semibold text-text">Basic Information</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-text-muted">Phone</dt>
              <dd className="mt-0.5 font-medium tnum">{labour.phone}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Skill</dt>
              <dd className="mt-0.5 font-medium">{labour.skill}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Daily Rate</dt>
              <dd className="mt-0.5 font-medium tnum">{formatINR(labour.dailyRate)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">OT Hourly Rate</dt>
              <dd className="mt-0.5 font-medium tnum">{formatINR(labour.hourlyRate)}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Joining Date</dt>
              <dd className={`mt-0.5 font-medium ${labour.joiningDate ? "" : "text-text-muted italic"}`}>
                {labour.joiningDate ? formatDateShort(labour.joiningDate) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Status</dt>
              <dd className="mt-0.5">
                <Badge tone={labour.status === "active" ? "success" : "neutral"}>
                  {labour.status === "active" ? "Active" : "Inactive"}
                </Badge>
              </dd>
            </div>
          </dl>
          {hasNotes && (
            <p className="mt-3 text-sm leading-6 text-text">
              <span className="text-text-muted">Notes: </span>{labour.notes!.trim()}
            </p>
          )}
        </Card>

        <Card className="p-4 flex flex-col h-full">
          <h2 className="text-sm font-semibold text-text">Current Site</h2>
          <p className="mt-2 text-sm">
            {siteName ? (
              <span className="font-medium text-text">{siteName}</span>
            ) : (
              <span className="text-text-muted italic">—</span>
            )}
          </p>
          <h2 className="mt-4 text-sm font-semibold text-text">Attendance this month</h2>
          <dl className="mt-2 grid grid-cols-4 gap-2 text-xs">
            <div>
              <dt className="text-text-muted">Present</dt>
              <dd className="mt-0.5 font-semibold tnum text-sm">{attByStatus.present ?? 0}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Half Day</dt>
              <dd className="mt-0.5 font-semibold tnum text-sm">{attByStatus["half-day"] ?? 0}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Absent</dt>
              <dd className="mt-0.5 font-semibold tnum text-sm">{attByStatus.absent ?? 0}</dd>
            </div>
            <div>
              <dt className="text-text-muted">OT hours</dt>
              <dd className="mt-0.5 font-semibold tnum text-sm">{attOT}</dd>
            </div>
          </dl>
          <h2 className="mt-4 text-sm font-semibold text-text">Salary Summary</h2>
          {salaryTotals ? (
            <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-text-muted">To Pay</dt>
                <dd className="mt-0.5 font-semibold tnum text-sm">{formatINR(salaryTotals.net)}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Paid</dt>
                <dd className="mt-0.5 font-semibold tnum text-sm">{formatINR(salaryTotals.paid)}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Remaining balance</dt>
                <dd className="mt-0.5 font-semibold tnum text-sm">
                  {formatINR(salaryTotals.net - salaryTotals.paid)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-1 text-xs leading-6 text-text-muted">
              No salary calculated yet.
            </p>
          )}
        </Card>
      </div>

      <LabourWriteOffSection labourId={lid} />

      <LabourAttendanceHistory labourId={lid} />

      {assignments.length > 0 && (
        <Card className="p-5">
          <h2 className="text-base font-semibold text-text">Assignment History</h2>
          <div className="mt-3 max-h-[320px] overflow-auto rounded-md border border-border">
            <Table>
              <THead>
                <TR>
                  <TH>Site</TH>
                  <TH>From</TH>
                  <TH>To</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <tbody>
                {assignments.map((a) => {
                  const siteName =
                    a.site && typeof a.site === "object" && "name" in a.site
                      ? String((a.site as { name: unknown }).name)
                      : "—";
                  const isUnspecSite = siteName === "—";
                  const isUnspecTo = !a.to;
                  return (
                    <TR key={String(a._id)}>
                      <TD className={isUnspecSite ? "font-medium text-text-muted italic" : "font-medium"}>{siteName}</TD>
                      <TD>{formatDateShort(a.from)}</TD>
                      <TD className={isUnspecTo ? "text-text-muted italic" : ""}>{a.to ? formatDateShort(a.to) : "—"}</TD>
                      <TD>
                        {a.to ? (
                          <Badge tone="neutral">Closed</Badge>
                        ) : (
                          <Badge tone="primary">Current</Badge>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
