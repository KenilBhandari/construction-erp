import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  ArrowRight,
  BarChart3,
  Box,
  Building2,
  Check,
  ClipboardCheck,
  Clock,
  MapPin,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingSignIn } from "@/components/landing/landing-signin";
import { ProductPreview } from "@/components/landing/product-preview";
import { Reveal } from "@/components/landing/reveal";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Orange ERP — Labour & Project Management for Construction",
  description:
    "Manage construction projects, sites, labour, attendance, salary, stock, expenses and client payments in one calm, site-ready workspace.",
};

const MODULES = [
  "Projects",
  "Sites",
  "Labour",
  "Attendance",
  "Overtime",
  "Salary",
  "Stock",
  "Expenses",
  "Payments",
  "Reports",
];

const WORKFLOW = [
  {
    n: "01",
    title: "Create project & sites",
    body: "One project, multiple sites — e.g. Main Building, Parking, Boundary Wall — each with supervisor, dates and progress.",
  },
  {
    n: "02",
    title: "Register & assign labour",
    body: "Mason, helper, carpenter, electrician and more. Assign each worker to a site; history is preserved on reassignment.",
  },
  {
    n: "03",
    title: "Mark attendance in seconds",
    body: "Pick date → project → site, then Present / Absent / Half / Leave down the list. Overtime recorded alongside.",
  },
  {
    n: "04",
    title: "Salary follows attendance",
    body: "Present × daily rate, half-day × 0.5, plus overtime — minus advances. Weekly, monthly or custom periods.",
  },
  {
    n: "05",
    title: "Track materials & spend",
    body: "Purchases, consumption and expenses stay linked to project and site. Low stock surfaces on the dashboard.",
  },
  {
    n: "06",
    title: "Collect & reconcile",
    body: "Client payments against contract value, pending balances, and estimated project profit — derived, not re-typed.",
  },
];

const FEATURES = [
  {
    icon: ClipboardCheck,
    route: "/dashboard/attendance",
    title: "Attendance supervisors actually use",
    body: "Site-wise muster with mark-all-present, overtime input and save — no modal per worker. Date defaults to today and remembers recent project/site.",
  },
  {
    icon: Users,
    route: "/dashboard/labour",
    title: "Labour records with memory",
    body: "Skill, rates, site, status and notes — plus attendance summary, salary position and payment history per worker. Deactivate, don't lose history.",
  },
  {
    icon: Wallet,
    route: "/dashboard/salary",
    title: "Salary from attendance, not spreadsheets",
    body: "Gross + overtime − advances − deductions = net payable. Pending, partially paid and paid states stay visible until closed.",
  },
  {
    icon: Box,
    route: "/dashboard/stock",
    title: "Stock that matches the site",
    body: "Cement, steel, sand and more in bags, kg, tonnes or feet. Every purchase, consumption, return and adjustment is a transaction with low-stock flags.",
  },
  {
    icon: Receipt,
    route: "/dashboard/expenses",
    title: "Expenses & payments, linked",
    body: "Labour, material, transport, equipment and contractor costs tied to project/site — next to client receipts in cash, UPI, bank or cheque.",
  },
  {
    icon: BarChart3,
    route: "/dashboard/reports",
    title: "One honest dashboard",
    body: "Active work, today's labour, pending client money, margin, low stock and recent activity. Useful reports — not fifteen decorative charts.",
  },
];

const FAQS = [
  {
    q: "How do I get in?",
    a: "This version signs in with Google only. First sign-in creates your user automatically, then you land on the dashboard. Use Open app or Sign in above.",
  },
  {
    q: "Does it work on a phone at site?",
    a: "Yes — attendance, labour, expense and stock entry are designed mobile-first with large touch targets, sticky headers and tables that collapse gracefully. The bottom dock on phones keeps modules one tap away.",
  },
  {
    q: "How is salary calculated?",
    a: "From attendance in the selected period: present days × daily rate, half-days × half rate, plus overtime hours × rate, minus advances and deductions. The app shows present, half-days, overtime, gross, advance and net payable per worker.",
  },
  {
    q: "Where do project totals come from?",
    a: "They are derived from underlying records — material, labour and other expenses for cost; receipts against contract value for pending; contract minus cost for estimated profit. You don't maintain competing totals by hand.",
  },
  {
    q: "What does it not do?",
    a: "No Gantt charts, no complex payroll engine, no notification infrastructure, no over-built permissions in V1. It focuses on fast entry, site-wise tracking and clear financial visibility.",
  },
];

export default async function Home() {
  // Signed-in visitors never see marketing — same rule as /login.
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex min-h-full flex-col bg-background text-text">
      <LandingNav />

      <main id="main" className="flex flex-1 flex-col">
        {/* ============ HERO ============ */}
        <section aria-labelledby="hero-heading" className="border-b border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-12 sm:px-6 sm:pb-14 sm:pt-16 lg:pt-20">
            <div className="mx-auto max-w-3xl text-center">
              <Reveal>
                <Badge tone="primary" className="px-3 py-1 text-[13px]">
                  Orange ERP · for construction teams
                </Badge>
              </Reveal>
              <Reveal delay={60}>
                <h1
                  id="hero-heading"
                  className="mt-5 text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-text sm:text-5xl lg:text-[3.4rem]"
                >
                  Labour, sites, and money — in one calm place.
                </h1>
              </Reveal>
              <Reveal delay={120}>
                <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-text-muted sm:text-lg sm:leading-8">
                  Orange ERP runs the daily loop of a construction business: mark attendance at the
                  site, pay salaries from that attendance, track materials and expenses, collect
                  client payments — and always know where each project stands.
                </p>
              </Reveal>
              <Reveal delay={170}>
                <div className="mt-7 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
                  <LandingSignIn className="w-full sm:w-auto" />
                  <a
                    href="#product"
                    className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-5 py-3 text-[15px] font-medium text-text transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    See how it works
                  </a>
                </div>
                <p className="mt-4 text-[13px] leading-5 text-text-muted">
                  Google sign-in, right here · New users are created automatically · Works on phone at site
                </p>
              </Reveal>
            </div>

            {/* Product visual */}
            <Reveal delay={120} className="mt-10 sm:mt-12">
              <div
                id="product"
                role="region"
                aria-label="Illustrative preview of the Orange ERP dashboard and attendance screens"
                className="scroll-mt-20 overflow-hidden rounded-lg border border-border bg-background"
              >
                <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5">
                  <span className="flex gap-1.5" aria-hidden="true">
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                  </span>
                  <p className="ml-2 min-w-0 flex-1 truncate font-mono text-xs text-text-muted">
                    app / dashboard — today&apos;s operations
                  </p>
                  <span className="ml-auto hidden shrink-0 sm:inline-flex">
                    <Badge tone="neutral">Illustrative preview</Badge>
                  </span>
                </div>
                <div className="p-3 sm:p-5">
                  <ProductPreview />
                </div>
              </div>
              <p className="mt-3 text-center text-xs leading-5 text-text-muted">
                Preview recreated from the actual dashboard and attendance screens with representative
                demo values. The interface you sign into is the same restrained UI — no marketing mock.
              </p>
            </Reveal>

            <Reveal delay={80}>
              <ul
                aria-label="Modules included"
                className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-x-4 gap-y-2 text-left text-[13px] font-medium text-text-muted sm:flex sm:max-w-none sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-5"
              >
                {MODULES.map((m) => (
                  <li key={m} className="inline-flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                    {m}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* ============ WORKFLOW ============ */}
        <section id="workflow" aria-labelledby="workflow-heading" className="scroll-mt-16 border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="max-w-2xl">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-primary">Workflow</p>
              <h2 id="workflow-heading" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Follows the way sites already run
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-text-muted">
                Project-centric by design. Each step feeds the next, so end-of-day numbers appear
                without re-typing or reconciling spreadsheets.
              </p>
            </div>
            <ol className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {WORKFLOW.map((s, i) => (
                <Reveal
                  as="li"
                  key={s.n}
                  delay={Math.min(i * 50, 200)}
                  className="h-full rounded-lg border border-border bg-surface p-5"
                >
                  <p className="font-mono text-xs font-medium text-primary tnum">{s.n}</p>
                  <h3 className="mt-2 text-[15px] font-semibold text-text">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-text-muted">{s.body}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ============ FEATURES ============ */}
        <section id="features" aria-labelledby="features-heading" className="scroll-mt-16 border-b border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-primary">Product</p>
                <h2 id="features-heading" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  Everything a day on site produces
                </h2>
                <p className="mt-3 text-[15px] leading-7 text-text-muted">
                  Six tightly-scoped modules. Each one matches a screen already in the app — same
                  labels, same logic, same restraint.
                </p>
              </div>
              <a
                href="#get-started"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface"
              >
                Get started <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>

            <ul className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <Reveal as="li" key={f.title} delay={Math.min(i * 50, 200)} className="h-full">
                  <Card className="flex h-full flex-col p-5">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-primary-light text-primary">
                      <f.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    <h3 className="mt-3.5 text-[15px] font-semibold text-text">{f.title}</h3>
                    <p className="mt-1.5 flex-1 text-sm leading-6 text-text-muted">{f.body}</p>
                    <p className="mt-3 font-mono text-xs text-text-muted">{f.route}</p>
                  </Card>
                </Reveal>
              ))}
            </ul>

            {/* Salary formula — authentic detail */}
            <Reveal>
              <div className="mt-3 rounded-lg border border-border bg-background p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-xl">
                    <h3 className="text-[15px] font-semibold text-text">Salary math, stated plainly</h3>
                    <p className="mt-1.5 text-sm leading-6 text-text-muted">
                      No hidden payroll engine. The same formula everywhere — attendance first,
                      overtime added, advances subtracted.
                    </p>
                  </div>
                  <dl className="grid w-full max-w-xl grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border text-center sm:grid-cols-4">
                    {[
                      ["Gross", "Present × rate"],
                      ["+ Overtime", "Hours × rate"],
                      ["− Advances", "Full history"],
                      ["= Net payable", "Pending → Paid"],
                    ].map(([k, v]) => (
                      <div key={k} className="bg-surface px-3 py-3">
                        <dt className="text-[13px] font-semibold tnum text-text">{k}</dt>
                        <dd className="mt-0.5 text-xs text-text-muted">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ============ SITE-READY ============ */}
        <section aria-labelledby="site-heading" className="border-b border-border">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-12">
            <Reveal>
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-wide text-primary">On site</p>
                <h2 id="site-heading" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  Built for dusty hands and small screens
                </h2>
                <p className="mt-3 text-[15px] leading-7 text-text-muted">
                  Attendance and entries often happen from the site itself — on a phone, in a hurry.
                  The app stays comfortable there instead of shrinking the desktop sidebar.
                </p>
                <ul className="mt-5 flex flex-col gap-2.5 text-sm leading-6 text-text">
                  {[
                    "Fast muster: mark a full site present in seconds",
                    "Date defaults to today; project and site remembered",
                    "Large touch targets, sticky headers, readable rows",
                    "Low stock, pending pay and unmarked workers surface automatically",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div className="flex flex-col gap-3">
                <Card className="p-5">
                  <div className="flex items-center gap-2.5">
                    <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <p className="text-sm font-medium text-text">Morning at Main Building</p>
                  </div>
                  <ol className="mt-3 flex flex-col gap-2 text-sm leading-6 text-text-muted">
                    <li className="flex gap-2.5"><span className="shrink-0 whitespace-nowrap font-mono text-xs leading-6 text-primary">07:55</span> Supervisor opens Today&apos;s Operations</li>
                    <li className="flex gap-2.5"><span className="shrink-0 whitespace-nowrap font-mono text-xs leading-6 text-primary">08:02</span> 12 present, 1 half-day, overtime noted — saved</li>
                    <li className="flex gap-2.5"><span className="shrink-0 whitespace-nowrap font-mono text-xs leading-6 text-primary">13:10</span> 15 bags cement consumed, recorded on the spot</li>
                    <li className="flex gap-2.5"><span className="shrink-0 whitespace-nowrap font-mono text-xs leading-6 text-primary">18:40</span> Manager sees labour cost, material cost, margin — no calls needed</li>
                  </ol>
                </Card>
                <Card className="p-5">
                  <div className="flex items-center gap-2.5">
                    <Clock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <p className="text-sm font-medium text-text">Context is always visible</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-muted">
                    Which project? Which site? Which date? Every entry screen answers all three
                    before asking for anything else — destructive actions always confirm first.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone="primary">Patel Residence</Badge>
                    <Badge tone="neutral">Main Building</Badge>
                    <Badge tone="neutral">Today</Badge>
                    <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                      <Building2 className="h-3.5 w-3.5" aria-hidden="true" /> Project-centric
                    </span>
                  </div>
                </Card>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ============ FAQ ============ */}
        <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-16 border-b border-border bg-surface">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-primary">FAQ</p>
              <h2 id="faq-heading" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Honest answers
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-text-muted">
                No sales claims here — just how the app works today and what it deliberately leaves out.
              </p>
              <a
                href="#get-started"
                className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
              >
                Get started <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
            <div className="lg:col-span-3">
              <div className="divide-y divide-border rounded-lg border border-border bg-background">
                {FAQS.map((f) => (
                  <details key={f.q} className="group px-5 py-4">
                    <summary className="cursor-pointer list-none text-[15px] font-medium text-text marker:hidden focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center justify-between gap-3">
                        {f.q}
                        <ArrowRight className="h-4 w-4 shrink-0 rotate-90 text-text-muted transition-transform group-open:-rotate-90" aria-hidden="true" />
                      </span>
                    </summary>
                    <p className="mt-2 text-sm leading-6 text-text-muted">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============ FINAL CTA / SIGN-IN ============ */}
        <section id="get-started" aria-labelledby="cta-heading" className="scroll-mt-16 bg-background">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <Reveal>
              <div className="rounded-lg border border-border bg-surface px-6 py-10 text-center sm:px-12 sm:py-14">
                <Badge tone="primary">Get started</Badge>
                <h2 id="cta-heading" className="mx-auto mt-4 max-w-xl text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
                  Create your first project today.
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-[15px] leading-7 text-text-muted">
                  One click with Google — no separate login screen. New users are created
                  automatically, then add a project and its sites, register labour, and mark
                  tomorrow&apos;s attendance from the site itself.
                </p>
                <div className="mx-auto mt-6 flex max-w-md flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
                  <LandingSignIn className="w-full sm:w-auto" />
                  <a
                    href="#features"
                    className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-5 py-3 text-[15px] font-medium text-text transition-colors hover:bg-background"
                  >
                    Review features
                  </a>
                </div>
                <p className="mt-4 text-xs leading-5 text-text-muted">
                  Prefer the standalone page? <Link href="/login" className="text-primary hover:underline">Sign in at /login</Link>
                </p>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
