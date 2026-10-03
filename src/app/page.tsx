"use client";
// Same page, now with a small self-contained motion system.
// Replaces Reveal. Keeps LandingNav, LandingFooter, LandingSignIn, Badge, Card, ProductPreview.
import { JSX, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Check, X, MapPin, Clock, Building2, Users, Wallet,
  Package, Receipt, HandCoins, LineChart,
} from "lucide-react";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingSignIn } from "@/components/landing/landing-signin";
import { ProductPreview } from "@/components/landing/product-preview";
import { Badge } from "@/components/ui/badge";
// import { Tag } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { signIn } from "next-auth/react";

const MODULES = ["Attendance", "Salaries", "Materials", "Expenses", "Client payments", "Project margin"];

const PAIN = {
  before: [
    "Attendance on paper, retyped into Excel at night",
    "Salary day means arguing over who worked how many days",
    "Cement and steel go missing and nobody knows when",
    "You learn a project lost money after it is finished",
  ],
  after: [
    "Attendance marked on the phone, at the site, in seconds",
    "Salary is calculated from attendance. Nothing to argue about",
    "Every bag and bar is recorded when it is used",
    "Labour, material and margin are visible every evening",
  ],
};

const WORKFLOW = [
  { n: "1", title: "Mark attendance", body: "Present, half-day, absent, overtime. One tap per worker, or mark the whole site present at once." },
  { n: "2", title: "Pay from attendance", body: "Salaries are built from what was marked. Advances are subtracted automatically." },
  { n: "3", title: "Record materials", body: "Log what arrived and what was used. Low stock is flagged before work stops." },
  { n: "4", title: "Track expenses", body: "Every rupee spent is tied to a project and a site, not lost in a notebook." },
  { n: "5", title: "Collect client payments", body: "See what is billed, what is received and what is still due, per project." },
  { n: "6", title: "Know your margin", body: "Labour cost, material cost and profit, live, for every project." },
];

const FEATURES = [
  { icon: Users, title: "Labour and attendance", body: "Register workers once. Mark attendance daily with overtime. See unmarked workers before the day ends." },
  { icon: Wallet, title: "Salaries", body: "Gross, overtime and advances combined into a net amount. Status moves from Pending to Paid." },
  { icon: Package, title: "Materials and stock", body: "Track purchases and consumption per site. Get warned when stock runs low." },
  { icon: Receipt, title: "Expenses", body: "Log site expenses against the right project so costs never float around unassigned." },
  { icon: HandCoins, title: "Client payments", body: "Record every payment received and see the balance owed by each client." },
  { icon: LineChart, title: "Project dashboard", body: "One screen answers: how much have we spent, how much have we earned, are we on track." },
];

const FAQS = [
  { q: "How long until I can use it?", a: "Sign in with Google, add a project and a site, register your workers, and you can mark attendance the same day." },
  { q: "Do my supervisors need training?", a: "No. Entry screens ask for project, site and date first, then the entry itself. If your supervisor can use WhatsApp, they can use this." },
  { q: "Will it work on a phone at the site?", a: "Yes. It is designed for phones first: large buttons, readable rows, and your last project and site remembered." },
  { q: "Can I trust the salary numbers?", a: "The formula is simple and visible: attendance times rate, plus overtime, minus advances. You can check any figure by hand." },
  { q: "What if I run more than one project?", a: "Everything is organized by project and site, so each one has its own labour, materials, expenses and margin." },
  { q: "What does it not do?", a: "It is not a full accounting package and does not file taxes. It does the daily site loop well and leaves the rest alone." },
];

const SALARY = [
  ["Gross", "Days present × rate"],
  ["Plus overtime", "Hours × rate"],
  ["Less advances", "Full history"],
  ["Net payable", "Pending, then Paid"],
];

/* ---------- Motion system ---------- */
const MOTION_CSS = `
.oe-anim{opacity:0;transform:translateY(14px);transition:opacity .65s cubic-bezier(.2,.7,.2,1),transform .65s cubic-bezier(.2,.7,.2,1)}
.oe-anim.oe-on{opacity:1;transform:none}
.oe-pop{opacity:0;transform:scale(.5)}
.oe-on .oe-pop{animation:oe-pop .45s cubic-bezier(.3,1.5,.5,1) forwards}
@keyframes oe-pop{to{opacity:1;transform:scale(1)}}
.oe-bar{transform:scaleX(0);transform-origin:left;transition:transform .6s cubic-bezier(.2,.7,.2,1)}
.oe-on .oe-bar{transform:scaleX(1)}
.oe-faq[open] .oe-faq-body{animation:oe-fade .3s ease-out}
@keyframes oe-fade{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.oe-cta{transition:transform .2s ease,background-color .2s ease}
.oe-cta:hover{transform:translateY(-1px)}
.oe-cta:active{transform:translateY(0)}
.oe-cta:hover .oe-arrow{transform:translateX(3px)}
.oe-arrow{transition:transform .2s ease}
@media (prefers-reduced-motion:reduce){
  .oe-anim,.oe-pop,.oe-bar{opacity:1;transform:none;transition:none;animation:none}
  .oe-on .oe-pop{animation:none}
  .oe-faq[open] .oe-faq-body{animation:none}
  .oe-cta,.oe-arrow{transition:none}
}`;

// One reveal primitive for the whole page. Fires once when scrolled into view.
function Anim({
  as: Tag = "div",
  delay = 0,
  className = "",
  children,
  ...rest
}: {
  as?: keyof JSX.IntrinsicElements | React.ElementType;
  delay?: number;
  className?: string;
  children: React.ReactNode;
  [key: string]: any;
}) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setOn(true); return; }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`oe-anim ${on ? "oe-on" : ""} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col bg-background text-text">
      <style>{MOTION_CSS}</style>
      <LandingNav />

      <main id="main" className="flex flex-1 flex-col">
        {/* HERO: the one orchestrated entrance, staggered top to bottom */}
        <section aria-labelledby="hero-heading" className="border-b border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-12 sm:px-6 sm:pb-14 sm:pt-16 lg:pt-20">
            <div className="mx-auto max-w-3xl text-center">
              <Anim>
                <Badge tone="primary" className="px-3 py-1 text-[13px]">Built for construction businesses</Badge>
              </Anim>
              <Anim delay={80}>
                <h1
                  id="hero-heading"
                  className="mt-5 text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]"
                >
                  Know exactly what every site is costing you, every single day.
                </h1>
              </Anim>
              <Anim delay={160}>
                <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-text-muted sm:text-lg sm:leading-8">
                  Mark attendance on your phone and salaries calculate themselves. Record materials
                  and expenses as they happen. Stop finding out about losses after the project ends.
                </p>
              </Anim>
              <Anim delay={240}>
                <div className="mt-7 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
                  <LandingSignIn className="oe-cta w-full sm:w-auto" />
                  <a
                    href="#product"
                    className="oe-cta inline-flex items-center justify-center rounded-md border border-border bg-surface px-5 py-3 text-[15px] font-medium text-text hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    See it in action
                  </a>
                </div>
                <p className="mt-4 text-[13px] leading-5 text-text-muted">
                  Sign in with Google in one click. No setup call, no installation, works on any phone.
                </p>
              </Anim>
            </div>
            <Anim delay={340} className="mt-10 sm:mt-12">
              <div
                id="product"
                role="region"
                aria-label="Preview of the Orange ERP dashboard and attendance screens"
                className="scroll-mt-20 overflow-hidden rounded-lg border border-border bg-background shadow-sm"
              >
                <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5">
                  <span className="flex gap-1.5" aria-hidden="true">
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                  </span>
                  {/* Quiet live indicator */}
                  <span className="relative ml-2 flex h-2 w-2" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                  </span>
                  <p className="min-w-0 flex-1 truncate text-xs text-text-muted">Today&apos;s operations</p>
                  <span className="ml-auto hidden shrink-0 sm:inline-flex">
                    <Badge tone="neutral">Sample data</Badge>
                  </span>
                </div>
                <div className="p-3 sm:p-5">
                  <ProductPreview />
                </div>
              </div>
            </Anim>

            <ul
              aria-label="Modules included"
              className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-x-4 gap-y-2 text-[13px] font-medium text-text-muted sm:flex sm:max-w-none sm:flex-wrap sm:justify-center sm:gap-x-6"
            >
              {MODULES.map((m, i) => (
                <Anim as="li" key={m} delay={420 + i * 50} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  {m}
                </Anim>
              ))}
            </ul>
          </div>
        </section>

        {/* BEFORE / AFTER: items arrive one by one, icons pop */}
        <section aria-labelledby="pain-heading" className="border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <Anim className="max-w-2xl">
              <h2 id="pain-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Your sites are busy. Your paperwork should not be.
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-text-muted">
                Most construction owners lose money in small leaks: a missed overtime entry, a
                cement bag nobody logged, a payment nobody chased. Orange ERP closes those leaks.
              </p>
            </Anim>
            <div className="mt-8 grid gap-3 md:grid-cols-2">
              <Card className="p-5 sm:p-6">
                <h3 className="text-[15px] font-semibold text-text">Without Orange ERP</h3>
                <ul className="mt-4 flex flex-col gap-3 text-sm leading-6 text-text-muted">
                  {PAIN.before.map((t, i) => (
                    <Anim as="li" key={t} delay={i * 110} className="flex items-start gap-2.5">
                      <X className="oe-pop mt-1 h-4 w-4 shrink-0 text-danger" style={{ animationDelay: `${i * 110 + 150}ms` }} aria-hidden="true" />
                      <span>{t}</span>
                    </Anim>
                  ))}
                </ul>
              </Card>
              <Card className="border-primary/30 bg-primary-light/40 p-5 sm:p-6">
                <h3 className="text-[15px] font-semibold text-text">With Orange ERP</h3>
                <ul className="mt-4 flex flex-col gap-3 text-sm leading-6 text-text">
                  {PAIN.after.map((t, i) => (
                    <Anim as="li" key={t} delay={300 + i * 110} className="flex items-start gap-2.5">
                      <Check className="oe-pop mt-1 h-4 w-4 shrink-0 text-success" style={{ animationDelay: `${300 + i * 110 + 150}ms` }} aria-hidden="true" />
                      <span>{t}</span>
                    </Anim>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </section>

        {/* WORKFLOW */}
        <section id="workflow" aria-labelledby="workflow-heading" className="scroll-mt-16 border-b border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <Anim className="max-w-2xl">
              <h2 id="workflow-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">One entry feeds the next</h2>
              <p className="mt-3 text-[15px] leading-7 text-text-muted">
                You enter each thing once, at the moment it happens. The totals appear on their own.
              </p>
            </Anim>
            <ol className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {WORKFLOW.map((s, i) => (
                <Anim as="li" key={s.n} delay={(i % 3) * 90} className="h-full rounded-lg border border-border bg-background p-5">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">{s.n}</span>
                  <h3 className="mt-3 text-[15px] font-semibold text-text">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-text-muted">{s.body}</p>
                </Anim>
              ))}
            </ol>
          </div>
        </section>

        {/* FEATURES + salary formula */}
        <section id="features" aria-labelledby="features-heading" className="scroll-mt-16 border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <Anim className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <h2 id="features-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">Everything a day on site produces</h2>
                <p className="mt-3 text-[15px] leading-7 text-text-muted">Six focused modules. No bloat, no feature you will never open.</p>
              </div>
              <a
                href="#get-started"
                className="oe-cta inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text hover:bg-background"
              >
                Start free <ArrowRight className="oe-arrow h-4 w-4" aria-hidden="true" />
              </a>
            </Anim>

            <ul className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <Anim as="li" key={f.title} delay={(i % 3) * 90} className="h-full">
                  <Card className="flex h-full flex-col p-5">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-primary-light text-primary">
                      <f.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    <h3 className="mt-3.5 text-[15px] font-semibold text-text">{f.title}</h3>
                    <p className="mt-1.5 flex-1 text-sm leading-6 text-text-muted">{f.body}</p>
                  </Card>
                </Anim>
              ))}
            </ul>

            {/* The memorable moment: the formula "calculates" left to right */}
            <Anim className="mt-3 rounded-lg border border-primary/30 bg-primary-light/40 p-5 sm:p-7">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-xl">
                  <h3 className="text-lg font-semibold text-text">Salary day without the arguments</h3>
                  <p className="mt-1.5 text-sm leading-6 text-text-muted">
                    No hidden payroll engine. Every worker&apos;s pay comes from attendance you
                    already marked, and every figure can be checked with a calculator.
                  </p>
                </div>
                <dl className="grid w-full max-w-xl grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border text-center sm:grid-cols-4">
                  {SALARY.map(([k, v], i) => (
                    <div key={k} className="relative bg-surface px-3 py-3.5">
                      <dt className={`text-[13px] font-semibold ${i === 3 ? "text-primary" : "text-text"}`}>{k}</dt>
                      <dd className="mt-0.5 text-xs text-text-muted">{v}</dd>
                      <span
                        className="oe-bar absolute inset-x-0 bottom-0 h-0.5 bg-primary"
                        style={{ transitionDelay: `${500 + i * 280}ms` }}
                        aria-hidden="true"
                      />
                    </div>
                  ))}
                </dl>
              </div>
            </Anim>
          </div>
        </section>

        {/* ON SITE */}
        <section aria-labelledby="site-heading" className="border-b border-border bg-surface">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-12">
            <Anim>
              <h2 id="site-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">Made for dusty hands and small screens</h2>
              <p className="mt-3 text-[15px] leading-7 text-text-muted">
                Your supervisors work from the site, on a phone, in a hurry. So the app is built
                for that, not squeezed down from a desktop screen.
              </p>
              <ul className="mt-5 flex flex-col gap-2.5 text-sm leading-6 text-text">
                {[
                  "Mark a full site present in seconds",
                  "Date defaults to today, project and site are remembered",
                  "Large buttons and easy to read rows",
                  "Low stock, pending pay and unmarked workers show up on their own",
                  "Anything destructive asks you to confirm first",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
                      <Check className="h-3 w-3" aria-hidden="true" />
                    </span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Anim>
            <div className="flex flex-col gap-3">
              <Anim delay={100}>
                <Card className="bg-background p-5">
                  <div className="flex items-center gap-2.5">
                    <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <p className="text-sm font-medium text-text">A normal day at Main Building</p>
                  </div>
                  <ol className="mt-3 flex flex-col gap-2 text-sm leading-6 text-text-muted">
                    {[
                      ["7:55 am", "Supervisor opens Today's Operations"],
                      ["8:02 am", "12 present, 1 half-day, overtime noted. Saved."],
                      ["1:10 pm", "15 bags of cement used, recorded on the spot"],
                      ["6:40 pm", "You see labour cost, material cost and margin without a single phone call"],
                    ].map(([time, text], i) => (
                      <Anim as="li" key={time} delay={250 + i * 220} className="flex gap-2.5">
                        <span className="w-12 shrink-0 text-xs font-semibold leading-6 text-primary">{time}</span>
                        {text}
                      </Anim>
                    ))}
                  </ol>
                </Card>
              </Anim>
              <Anim delay={200}>
                <Card className="bg-background p-5">
                  <div className="flex items-center gap-2.5">
                    <Clock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <p className="text-sm font-medium text-text">You always know where you are</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-muted">
                    Every entry screen shows the project, the site and the date before it asks for
                    anything else, so nothing gets recorded against the wrong place.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge tone="primary">Patel Residence</Badge>
                    <Badge tone="neutral">Main Building</Badge>
                    <Badge tone="neutral">Today</Badge>
                    <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                      <Building2 className="h-3.5 w-3.5" aria-hidden="true" /> Organized by project
                    </span>
                  </div>
                </Card>
              </Anim>
            </div>
          </div>
        </section>

        {/* FAQ: answers fade open */}
        <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-16 border-b border-border">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-5">
            <Anim className="lg:col-span-2">
              <h2 id="faq-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">Questions owners ask first</h2>
              <p className="mt-3 text-[15px] leading-7 text-text-muted">Straight answers, including what the app does not do.</p>
              <a
                href="#get-started"
                className="oe-cta mt-5 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
              >
                Create my first project <ArrowRight className="oe-arrow h-4 w-4" aria-hidden="true" />
              </a>
            </Anim>
            <Anim delay={100} className="lg:col-span-3">
              <div className="divide-y divide-border rounded-lg border border-border bg-surface">
                {FAQS.map((f) => (
                  <details key={f.q} className="oe-faq group px-5 py-4">
                    <summary className="cursor-pointer list-none text-[15px] font-medium text-text marker:hidden focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center justify-between gap-3">
                        {f.q}
                        <ArrowRight className="h-4 w-4 shrink-0 rotate-90 text-text-muted transition-transform duration-200 group-open:-rotate-90" aria-hidden="true" />
                      </span>
                    </summary>
                    <p className="oe-faq-body mt-2 text-sm leading-6 text-text-muted">{f.a}</p>
                  </details>
                ))}
              </div>
            </Anim>
          </div>
        </section>

        {/* FINAL CTA */}
        <section id="get-started" aria-labelledby="cta-heading" className="scroll-mt-16 bg-background">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <Anim className="rounded-lg border border-primary/30 bg-primary-light/40 px-6 py-10 text-center sm:px-12 sm:py-14">
              <h2 id="cta-heading" className="mx-auto max-w-xl text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
                Tomorrow morning, mark attendance from the site and watch the numbers build themselves.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[15px] leading-7 text-text-muted">
                Sign in with Google, add your first project and workers, and you are running in
                minutes. No forms, no waiting, no setup call.
              </p>
              <div className="mx-auto mt-6 flex max-w-2xl flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
                <LandingSignIn className="oe-cta w-full sm:w-auto" />
                <a
                  href="#features"
                  className="oe-cta inline-flex items-center justify-center rounded-md border border-border bg-surface px-5 py-3 text-[15px] font-medium text-text hover:bg-background"
                >
                  Review features
                </a>
                <button
                  type="button"
                  onClick={() => signIn("direct-access", { callbackUrl: "/dashboard" })}
                  className="oe-cta inline-flex items-center justify-center rounded-md border border-border bg-surface px-5 py-3 text-[15px] font-medium text-text hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Direct Access
                </button>
              </div>
              <p className="mt-4 text-xs leading-5 text-text-muted">
                Prefer a standalone page?{" "}
                <Link href="/login" className="text-primary hover:underline">Sign in at /login</Link>
              </p>
            </Anim>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}