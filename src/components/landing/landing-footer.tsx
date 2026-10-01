import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <p className="text-sm font-semibold text-text">Orange ERP</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              Labour &amp; project management for construction teams — projects, sites, attendance,
              salary, stock, expenses and client payments.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 text-sm sm:flex sm:gap-12">
            <div>
              <p className="font-medium text-text">Product</p>
              <ul className="mt-3 flex flex-col gap-2 text-text-muted">
                <li><a href="#product" className="hover:text-text hover:underline">Overview</a></li>
                <li><a href="#workflow" className="hover:text-text hover:underline">Workflow</a></li>
                <li><a href="#features" className="hover:text-text hover:underline">Features</a></li>
                <li><a href="#faq" className="hover:text-text hover:underline">FAQ</a></li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-text">App</p>
              <ul className="mt-3 flex flex-col gap-2 text-text-muted">
                <li><a href="#get-started" className="hover:text-text hover:underline">Get started</a></li>
                <li><Link href="/login" className="hover:text-text hover:underline">Sign in</Link></li>
              </ul>
            </div>
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Orange ERP — built for day-to-day site operations.</p>
          <p>Sign-in is via Google. Your data stays in your workspace database.</p>
        </div>
      </div>
    </footer>
  );
}
