import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { formatINR } from "@/lib/utils";
import { Labour } from "@/models/Labour";
import { LabourAssignment } from "@/models/LabourAssignment";
import { Attendance } from "@/models/Attendance";
import { Overtime } from "@/models/Overtime";
import { Salary } from "@/models/Salary";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ResponsiveDate } from "@/components/ui/responsive-date";
import { Table, THead, TH, TD, TR } from "@/components/ui/table";
import { LabourActions } from "@/components/labour/labour-actions";
import { LabourAdvanceSection, LabourSalaryRecordsSection, LabourWriteOffsSection } from "@/components/labour/labour-write-off";
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
  const [assignments, attendanceAgg, monthOtAgg, salaryAgg] = await Promise.all([
    LabourAssignment.find({ labour: id })
      .populate("site", "name")
      .sort({ from: -1, _id: -1 })
      .limit(25)
      .lean(),
    Attendance.aggregate([
      { $match: monthFilter },
      { $group: { _id: "$status", days: { $sum: 1 }, ot: { $sum: { $ifNull: ["$overtimeHours", 0] } } } },
    ]),
    Overtime.aggregate([
      { $match: monthFilter },
      { $group: { _id: null, ot: { $sum: "$hours" } } },
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
  attOT = Math.round((attOT + ((monthOtAgg as Array<{ ot: number }>)[0]?.ot ?? 0)) * 10) / 10;
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
    <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
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

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 lg:items-stretch">
        <Card className="rounded-xl p-4 sm:rounded-lg sm:p-5 flex flex-col h-full">
          <h2 className="text-[15px] font-semibold tracking-tight text-text sm:text-base sm:tracking-normal">Basic Information</h2>
          <dl className="mt-3.5 grid grid-cols-2 gap-2.5 text-sm sm:mt-4 sm:gap-4">
            <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
              <dt className="text-xs text-text-muted sm:text-sm">Phone</dt>
              <dd className="mt-0.5 truncate text-[15px] font-medium tnum sm:mt-1 sm:text-base">{labour.phone}</dd>
            </div>
            <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
              <dt className="text-xs text-text-muted sm:text-sm">Skill</dt>
              <dd className="mt-0.5 truncate text-[15px] font-medium sm:mt-1 sm:text-base">{labour.skill}</dd>
            </div>
            <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
              <dt className="text-xs text-text-muted sm:text-sm">Daily Rate</dt>
              <dd className="mt-0.5 truncate text-[15px] font-medium tnum sm:mt-1 sm:text-base">{formatINR(labour.dailyRate)}</dd>
            </div>
            <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
              <dt className="text-xs text-text-muted sm:text-sm">OT Hourly Rate</dt>
              <dd className="mt-0.5 truncate text-[15px] font-medium tnum sm:mt-1 sm:text-base">{formatINR(labour.hourlyRate)}</dd>
            </div>
            <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
              <dt className="text-xs text-text-muted sm:text-sm">Joining Date</dt>
              <dd className={`mt-0.5 truncate text-[15px] font-medium tnum sm:mt-1 sm:text-base ${labour.joiningDate ? "" : "text-text-muted italic"}`}>
                {labour.joiningDate ? <ResponsiveDate date={labour.joiningDate} /> : "—"}
              </dd>
            </div>
            <div className="min-w-0 rounded-lg bg-background px-3 py-2.5 sm:rounded-none sm:bg-transparent sm:p-0">
              <dt className="text-xs text-text-muted sm:text-sm">Status</dt>
              <dd className="mt-1 sm:mt-1.5">
                <Badge tone={labour.status === "active" ? "success" : "neutral"}>
                  {labour.status === "active" ? "Active" : "Inactive"}
                </Badge>
              </dd>
            </div>
          </dl>
          {hasNotes && (
            <div className="mt-4 border-t border-border pt-4 sm:mt-6 sm:pt-5">
              <p className="text-xs text-text-muted">Notes</p>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-text">
                {labour.notes!.trim()}
              </p>
            </div>
          )}
        </Card>

        <Card className="rounded-xl p-4 sm:rounded-lg sm:p-5 flex flex-col h-full">
          <h2 className="text-[15px] font-semibold tracking-tight text-text sm:text-base sm:tracking-normal">Current Site</h2>
          <p className="mt-1.5 truncate text-sm">
            {siteName && siteId ? (
              <Link href={`/dashboard/sites/${siteId}`} className="font-medium text-primary hover:underline">{siteName}</Link>
            ) : (
              <span className="text-text-muted italic">Unassigned</span>
            )}
          </p>
          <h2 className="mt-4 text-[15px] font-semibold tracking-tight text-text sm:mt-6 sm:text-base sm:tracking-normal">Attendance this month</h2>
          <dl className="mt-3.5 grid grid-cols-4 gap-2.5 text-xs sm:mt-4 sm:gap-4 sm:text-sm">
            <div className="min-w-0 rounded-lg bg-background px-2.5 py-2 sm:rounded-none sm:bg-transparent sm:p-0">
              <dt className="truncate text-text-muted">Present</dt>
              <dd className="mt-0.5 truncate font-semibold tnum text-sm sm:mt-1 sm:text-base">{attByStatus.present ?? 0}</dd>
            </div>
            <div className="min-w-0 rounded-lg bg-background px-2.5 py-2 sm:rounded-none sm:bg-transparent sm:p-0">
              <dt className="truncate text-text-muted">Half Day</dt>
              <dd className="mt-0.5 truncate font-semibold tnum text-sm sm:mt-1 sm:text-base">{attByStatus["half-day"] ?? 0}</dd>
            </div>
            <div className="min-w-0 rounded-lg bg-background px-2.5 py-2 sm:rounded-none sm:bg-transparent sm:p-0">
              <dt className="truncate text-text-muted">Absent</dt>
              <dd className="mt-0.5 truncate font-semibold tnum text-sm sm:mt-1 sm:text-base">{attByStatus.absent ?? 0}</dd>
            </div>
            <div className="min-w-0 rounded-lg bg-background px-2.5 py-2 sm:rounded-none sm:bg-transparent sm:p-0">
              <dt className="truncate text-text-muted">OT hours</dt>
              <dd className="mt-0.5 truncate font-semibold tnum text-sm sm:mt-1 sm:text-base">{attOT}</dd>
            </div>
          </dl>
          <h2 className="mt-4 text-[15px] font-semibold tracking-tight text-text sm:mt-6 sm:text-base sm:tracking-normal">Salary Summary</h2>
          {salaryTotals ? (
            <dl className="mt-3.5 grid grid-cols-3 gap-2.5 text-xs sm:mt-4 sm:gap-4 sm:text-sm">
              <div className="min-w-0 rounded-lg bg-background px-2.5 py-2 sm:rounded-none sm:bg-transparent sm:p-0">
                <dt className="truncate text-text-muted">To Pay</dt>
                <dd className="mt-0.5 truncate font-semibold tnum text-sm sm:mt-1 sm:text-base">{formatINR(salaryTotals.net)}</dd>
              </div>
              <div className="min-w-0 rounded-lg bg-background px-2.5 py-2 sm:rounded-none sm:bg-transparent sm:p-0">
                <dt className="truncate text-text-muted">Paid</dt>
                <dd className="mt-0.5 truncate font-semibold tnum text-sm sm:mt-1 sm:text-base">{formatINR(salaryTotals.paid)}</dd>
              </div>
              <div className="min-w-0 rounded-lg bg-background px-2.5 py-2 sm:rounded-none sm:bg-transparent sm:p-0">
                <dt className="truncate text-text-muted">Balance</dt>
                <dd className="mt-0.5 truncate font-semibold tnum text-sm sm:mt-1 sm:text-base">
                  {formatINR(salaryTotals.net - salaryTotals.paid)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-1.5 text-xs leading-6 text-text-muted sm:text-sm">
              No salary calculated yet.
            </p>
          )}
        </Card>
      </div>

      <LabourAdvanceSection labourId={lid} />

      <LabourSalaryRecordsSection labourId={lid} />

      <LabourAttendanceHistory labourId={lid} />

      <LabourWriteOffsSection labourId={lid} />

      {assignments.length > 0 && (
        <Card className="rounded-xl p-4 sm:rounded-lg sm:p-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-text sm:text-base sm:tracking-normal">Assignment History</h2>
          <div className="scroll-area mt-3.5 max-h-[320px] overflow-auto rounded-xl border border-border sm:mt-3 sm:rounded-lg">
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
                      <TD><ResponsiveDate date={a.from} /></TD>
                      <TD className={isUnspecTo ? "text-text-muted italic" : ""}>{a.to ? <ResponsiveDate date={a.to} /> : "—"}</TD>
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
