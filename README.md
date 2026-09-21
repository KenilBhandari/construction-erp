# Construction ERP — Labour & Project Management

A clean, responsive web app for managing construction projects, sites, labour,
attendance, salary, stock, expenses, client payments and profitability.
Built for one developer to own: simple Next.js + MongoDB, no over-engineering.

The full product spec lives in [ERP_README.md](./ERP_README.md).

## Tech Stack

- Next.js 16 (App Router) + TypeScript (strict) + React 19
- Tailwind CSS v4 + hand-rolled UI primitives + Lucide icons
- MongoDB + Mongoose (primary database, source of truth)
- Auth.js v5 — Google OAuth only
- React Context + localStorage for light client state (no data-fetching library)

## Requirements

- Node.js 20+
- A MongoDB database: [Atlas](https://www.mongodb.com/atlas) (recommended)
  or local `mongod` / Docker.

## Installation

```bash
npm install
cp .env.example .env.local
# fill in MONGODB_URI, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET
npm run dev        # http://localhost:3000
```

Google OAuth: create credentials in
[Google Cloud Console](https://console.cloud.google.com/apis/credentials)
(OAuth client → Web application), add `http://localhost:3000/api/auth/callback/google`
as an authorized redirect URI, and paste the client ID/secret into `.env.local`.

## Environment Variables

| Var | Purpose |
| --- | ------- |
| `MONGODB_URI` | MongoDB connection string |
| `AUTH_SECRET` | Session encryption (`openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth (Auth.js v5 names; legacy `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` also work) |
| `NEXTAUTH_URL` | App URL (`http://localhost:3000` in dev) |

## MongoDB Setup

Atlas: create a free cluster → Database Access user → Network Access
(your IP) → copy the connection string into `MONGODB_URI`.

Local Docker alternative:

```bash
docker run -d -p 27017:27017 --name erp-mongo mongo:7
# MONGODB_URI=mongodb://127.0.0.1:27017/construction-erp
```

## Development / Production

```bash
npm run dev     # start dev server
npm run lint    # eslint
npm run build   # production build (also type-checks)
npm start       # serve production build
```

## Database Seed

Realistic demo data (3 projects, 5 sites, 15 labourers, 7 days attendance,
salaries, stock, expenses, payments):

```bash
npm run seed
```

Clears domain collections (keeps users). Requires `MONGODB_URI`.
Users are created automatically on first Google sign-in — no seeded logins.

## Project Structure

```text
src/
  app/
    login/                 # Google sign-in
    dashboard/             # protected: projects, sites, labour, attendance,
                           # salary, materials, stock, purchases, expenses,
                           # payments, reports, settings
    api/                   # projects, sites, labour, assignments, attendance,
                           # overtime, salary, advances, materials, stock,
                           # expenses, payments
  components/
    ui/                    # Button, Input, Table, Badge, Modal, …
    layout/                # sidebar, topbar, app shell
    projects|labour|attendance|overtime|salary|inventory|finance/
  context/                 # ProjectContext (selected project/site → localStorage)
  lib/
    mongodb.ts             # cached Mongoose connection
    auth.ts                # Auth.js config (Google only)
    calculations.ts        # salary / profit formulas (single source of truth)
    salary.ts              # salary computation + auto-recompute
    stock.ts               # stock effects with negative-stock guards
    finance.ts             # derived project finance (one formula)
    dashboard.ts           # dashboard + report aggregations
    schemas.ts             # zod API validation
    utils.ts               # formatting, dates, day normalization
  models/                  # Mongoose schemas (readable, one per file)
  types/                   # DTOs + client-safe constants
scripts/seed.ts            # demo data
```

## Business Calculations

All formulas live in `src/lib/calculations.ts`; derivations in
`src/lib/salary.ts`, `src/lib/stock.ts`, `src/lib/finance.ts`.

- **Salary** (per worker, per period, from attendance):
  `present × daily + half × daily × 0.5 + OT hrs × hourly + OT records
  − advances − deductions = net`. Status derives from paid vs net.
  Editing attendance/overtime/advances auto-recomputes affected periods.
- **Overtime**: `hours × rate` (defaults to worker's hourly rate).
- **Stock**: purchase/return add, consumption subtracts, adjustment is signed.
  Consumption that would drive stock negative is rejected (conditional update).
- **Project finance** (all figures estimated):
  `expense = purchases + attendance labour (current rates) + OT records
  + manual expenses`; `pending = contract − received`;
  `profit = contract − expense`. Salary and purchases count automatically —
  manual expenses must not duplicate them.
- **Dates** are normalized to UTC midnight (`toDayDate`) so same-day
  records always match.

## Definition of Done (V1)

Auth, dashboard, projects, sites, labour + assignments, attendance,
overtime, salary + advances, materials, purchases, consumption, low-stock
alerts, expenses, client payments, project P&L, reports — all persisted in
MongoDB, responsive, validated, with loading/empty/error states.
