import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-16">
      <main className="w-full max-w-2xl border border-border bg-surface p-8 rounded-lg">
        <p className="text-sm font-medium text-text-muted">Construction ERP</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text">
          Labour &amp; Project Management
        </h1>
        <p className="mt-3 text-base leading-7 text-text-muted">
          Foundation is set up. Authentication (Google login), dashboard,
          projects, labour, attendance, salary, stock, expenses and payments
          will be built in the next steps.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <span className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">
            Step 1 — Scaffolding complete
          </span>
          <Link
            href="/login"
            className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium text-text hover:bg-background"
          >
            Go to login
          </Link>
        </div>
        <dl className="mt-8 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-text-muted">Stack</dt>
            <dd className="mt-1 font-medium">Next.js + TS</dd>
          </div>
          <div>
            <dt className="text-text-muted">Database</dt>
            <dd className="mt-1 font-medium">MongoDB</dd>
          </div>
          <div>
            <dt className="text-text-muted">Auth</dt>
            <dd className="mt-1 font-medium">Google OAuth</dd>
          </div>
          <div>
            <dt className="text-text-muted">Brand</dt>
            <dd className="mt-1 font-medium tnum">#FF6321</dd>
          </div>
        </dl>
      </main>
    </div>
  );
}
