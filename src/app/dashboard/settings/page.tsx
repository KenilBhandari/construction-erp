import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { signOutAction } from "@/components/layout/actions";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  const session = await auth();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Settings"
        description="Account and application information."
      />
      <Card className="p-5">
        <h2 className="text-base font-semibold text-text">Signed in as</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-text-muted">Name</dt>
            <dd className="mt-0.5 font-medium">{session?.user?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Email</dt>
            <dd className="mt-0.5 font-medium">{session?.user?.email ?? "—"}</dd>
          </div>
        </dl>
        <form action={signOutAction} className="mt-4">
          <Button variant="outline" size="sm" type="submit">
            Sign out
          </Button>
        </form>
      </Card>
      <Card className="p-5">
        <h2 className="text-base font-semibold text-text">Application</h2>
        <p className="mt-1 text-sm leading-6 text-text-muted">
          Construction ERP v1 — projects, sites, labour, attendance, salary,
          inventory, expenses, payments and reports. Roles beyond the signed-in
          user (manager, accountant, supervisor) are future work; keep the
          code simple until then.
        </p>
      </Card>
    </div>
  );
}
