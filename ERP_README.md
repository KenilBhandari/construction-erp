# Construction Labour & Project Management App

## 1. Product Vision

Build a clean, modern, responsive web application for managing construction projects, labour, sites, attendance, salaries, materials, expenses, billing, and project profitability.

The application should feel like a **real business management tool**, not a generic admin dashboard or an AI-generated SaaS template.

The primary goals are:

* Simple day-to-day operation
* Fast data entry
* Clear financial visibility
* Easy labour and attendance management
* Site-wise tracking
* Minimal unnecessary complexity
* Easy-to-understand source code
* Easy future customization by the owner/developer
* Responsive on desktop, tablet, and mobile
* Professional construction/business-oriented UI

The application should prioritize **clarity and maintainability over technical sophistication**.

Do NOT introduce unnecessary infrastructure such as:

* Redis
* Kafka
* RabbitMQ
* Microservices
* Complex event systems
* WebSockets unless genuinely required
* Kubernetes
* Elasticsearch
* Over-engineered caching layers
* Complex state-management libraries

Use straightforward Next.js architecture, MongoDB, Context API, localStorage where appropriate, and clean reusable components.

---

# 2. Technology Stack

## Frontend

* Next.js
* TypeScript
* React
* Tailwind CSS
* Context API
* localStorage for appropriate client-side persistence/caching
* Responsive CSS
* Reusable UI components

Prefer the Next.js App Router.

Use TypeScript strictly.

Avoid `any` wherever reasonably possible.

---

# 3. Backend / Database

## MongoDB

MongoDB should be the primary persistent database.

Use a simple and understandable database layer.

Recommended:

* MongoDB
* Mongoose

Keep schemas readable.

Do not create unnecessarily abstract repository/service architectures unless they genuinely improve maintainability.

The developer should be able to open a model file and immediately understand the structure.

---

# 4. Authentication

Implement a simple authentication system.

Possible structure:

* Login
* Logout
* Current user/session
* Protected dashboard routes

For the first version, there is no need for a sophisticated enterprise RBAC system.

Keep the architecture ready for future roles such as:

* Admin
* Manager
* Accountant
* Site Supervisor

But don't overbuild permissions in V1.

---

# 5. Application Layout

The application should have a standard business application layout.

## Desktop

Left sidebar:

* Dashboard
* Projects
* Sites
* Labour
* Attendance
* Salary
* Stock
* Expenses
* Payments
* Reports
* Settings

Top bar:

* Current project/site context where relevant
* Search if useful
* Notifications
* User profile
* Mobile sidebar trigger

Main content:

* Page title
* Short contextual description
* Primary action
* Filters
* Content

## Mobile

Use a proper mobile navigation pattern.

Do not simply shrink the desktop sidebar.

The application should remain comfortable to use on a phone because attendance and site-related operations may happen directly from construction sites.

---

# 6. Visual Design / UI Direction

Primary brand color:

`#FF6321`

Use this as the main accent rather than flooding the entire interface with orange.

Suggested visual language:

* White / very light neutral background
* Dark charcoal text
* Subtle borders
* Muted secondary text
* Orange for primary actions and important highlights
* Light neutral surfaces
* Very limited shadows
* Moderate border radius
* Strong typography hierarchy

## Important

Do NOT make the application look like:

* Generic AI dashboard
* Dribbble concept
* Overly rounded SaaS template
* Excessively colorful analytics dashboard
* Glassmorphism UI
* Excessive gradients
* Every card having huge rounded corners
* Every section being placed inside a floating card

The interface should feel closer to a **mature construction/accounting/business application**.

Use spacing, typography, borders and hierarchy to create visual quality rather than excessive decoration.

---

# 7. Border Radius

Avoid excessive rounded UI.

Use a restrained radius system.

For example:

* Inputs: moderate radius
* Buttons: moderate radius
* Cards: small/moderate radius
* Tables: minimal rounding
* Main containers: subtle rounding

Not every element should look like a pill.

Pills should mainly be used for:

* Status
* Tags
* Small filters
* Payment state
* Project state

---

# 8. Typography

Use a clean modern sans-serif font.

Prioritize readability.

Typography should clearly differentiate:

* Page heading
* Section heading
* Body text
* Metadata
* Numbers
* Labels
* Status

Financial numbers should be visually prominent without becoming oversized.

---

# 9. Dashboard

The dashboard should immediately answer:

### "How is my construction business/project doing today?"

Top-level summary:

* Active Projects
* Active Sites
* Total Labour
* Today's Attendance
* Pending Labour Payments
* Current Month Expenses
* Client Payments Received
* Outstanding Client Payments
* Current Project Profit/Loss

Example:

```text
Active Projects          4
Active Sites             7
Today's Labour           42 / 51
Monthly Expenses        ₹4,85,000
Pending Client Payment  ₹2,10,000
Current Profit           ₹3,45,000
```

## Dashboard sections

### Today's Overview

Show:

* Labour present
* Labour absent
* Overtime
* Today's material usage
* Today's expenses

### Project Overview

Show projects with:

* Project name
* Client
* Location
* Progress
* Budget
* Actual expense
* Remaining budget
* Status

### Recent Activity

Examples:

* 12 labourers marked present at Site A
* ₹25,000 material purchase added
* ₹50,000 client payment received
* 4 hours overtime recorded
* 10 bags cement consumed

### Financial Summary

Simple chart/visualization:

* Budget
* Expenses
* Payments received
* Pending amount

Do not overload the dashboard with 15+ charts.

---

# 10. Labour Management

Create a dedicated Labour module.

## Labour fields

Each labour record should contain:

```text
Name
Phone
Photo (optional)
Skill Type
Daily Rate
Hourly Rate
Joining Date
Status
Assigned Site
Notes
```

Skill types could include:

* Mason
* Helper
* Carpenter
* Electrician
* Plumber
* Painter
* Welder
* Operator
* General Labour
* Other

Allow custom skill types in the future.

---

# 11. Labour List

Provide:

* Search
* Skill filter
* Site filter
* Status filter
* Sort
* Pagination

Columns:

```text
Name
Phone
Skill
Site
Rate
Status
Actions
```

Actions:

* View
* Edit
* Assign site
* Attendance
* Salary history
* Delete/deactivate

Prefer deactivation instead of permanent deletion for important historical labour records.

---

# 12. Labour Detail Page

Each labourer should have a detailed profile.

Sections:

### Basic Information

* Name
* Phone
* Skill
* Joining date
* Current site

### Attendance Summary

* Present days
* Absent days
* Half days
* Overtime hours

### Salary Summary

* Current period salary
* Paid
* Advance
* Remaining

### Attendance History

A simple table/calendar.

### Payment History

Show:

```text
Date
Type
Amount
Description
```

---

# 13. Site Management

Sites belong to projects.

A project can have multiple sites.

Example:

```text
Project: Patel Residence

Sites:
- Main Building
- Parking Area
- Boundary Wall
- Garden Area
```

## Site fields

```text
Site Name
Project
Location
Supervisor
Start Date
Expected End Date
Status
Progress %
Notes
```

---

# 14. Labour Assignment

Labour can be assigned to a specific site.

Example:

```text
Ramesh
Mason
Assigned Site: Main Building
Daily Rate: ₹900
```

Allow:

* Assign
* Reassign
* View assigned workers
* View historical assignments

Historical attendance must not break if a labourer changes sites.

---

# 15. Attendance Management

Attendance should be one of the most important modules.

## Attendance modes

Allow:

* Site-wise attendance
* Date-wise attendance
* Labour-wise attendance

Default workflow:

```text
Select Date
↓
Select Project
↓
Select Site
↓
List assigned labour
↓
Mark attendance
```

Attendance statuses:

* Present
* Absent
* Half Day
* Leave

Optional:

* Check-in time
* Check-out time
* Overtime hours
* Notes

---

# 16. Fast Attendance UI

For daily usage, optimize for speed.

Example:

```text
Site: Main Building
Date: 18 Sep 2026

Ramesh      Mason       [Present] [Absent] [Half]
Suresh      Helper      [Present] [Absent] [Half]
Mahesh      Carpenter   [Present] [Absent] [Half]
```

Include:

* Mark all present
* Save attendance
* Clear
* Overtime input

Do not force users to open a modal for every labourer.

---

# 17. Overtime

Track overtime separately.

Fields:

```text
Labour
Date
Site
Hours
Rate
Amount
```

Calculation:

```text
Overtime Amount =
Overtime Hours × Hourly Overtime Rate
```

Allow either:

* Labour's default hourly rate
* Custom overtime rate

---

# 18. Salary System

Salary should be calculated primarily from attendance.

Support:

### Daily wage

```text
Present Days × Daily Rate
```

### Half day

```text
Half Day × Daily Rate × 0.5
```

### Hourly

```text
Total Hours × Hourly Rate
```

### Overtime

```text
Overtime Hours × Overtime Rate
```

Then:

```text
Gross Salary
+ Overtime
- Advances
- Other deductions
= Net Payable
```

---

# 19. Salary Period

Support:

* Weekly
* Monthly
* Custom date range

Salary screen:

```text
Labour
Period
Present
Half Days
Overtime
Gross Salary
Advance
Net Payable
Status
```

Statuses:

* Pending
* Partially Paid
* Paid

---

# 20. Advance Payments

A labourer may receive advances.

Example:

```text
Ramesh

Salary: ₹24,000
Advance: ₹5,000
Net payable: ₹19,000
```

Advance record:

```text
Date
Labour
Amount
Reason
Site
Notes
```

Maintain a complete history.

---

# 21. Stock Management

Manage construction materials.

Examples:

* Cement
* Sand
* Steel
* Bricks
* Aggregate
* Tiles
* Paint
* Pipes
* Electrical material
* Wood
* Other

---

# 22. Material Master

Fields:

```text
Material Name
Category
Unit
Current Stock
Minimum Stock
Default Purchase Rate
Notes
```

Units:

* Bag
* Kg
* Ton
* Cubic Feet
* Cubic Meter
* Piece
* Liter
* Meter

---

# 23. Stock Transactions

Every stock change should be represented as a transaction.

Types:

* Purchase
* Consumption
* Adjustment
* Return

Example:

```text
18 Sep
Cement
+100 Bags
Purchase

19 Sep
Cement
-20 Bags
Used at Main Building
```

Current stock should be derived from transactions or updated consistently when transactions are created.

Avoid complicated inventory systems.

---

# 24. Material Purchase

Purchase entry:

```text
Supplier
Date
Project
Site
Material
Quantity
Unit
Rate
Total
Invoice Number
Notes
```

Automatically calculate:

```text
Quantity × Rate = Total
```

---

# 25. Material Consumption

Consumption entry:

```text
Date
Project
Site
Material
Quantity
Purpose
Notes
```

Example:

```text
Cement
20 Bags
Main Building
Slab Work
```

---

# 26. Low Stock Alert

If:

```text
Current Stock <= Minimum Stock
```

show:

```text
Low Stock
```

Dashboard can show:

```text
Low Stock Items

Cement       18 bags
Steel        120 kg
Paint        12 liters
```

No complicated notification infrastructure is required.

---

# 27. Expense Management

Track all project expenses.

Expense categories:

* Labour
* Material
* Transport
* Equipment
* Electricity
* Water
* Contractor
* Miscellaneous
* Other

Fields:

```text
Date
Project
Site
Category
Description
Amount
Vendor
Payment Method
Reference
Notes
```

---

# 28. Automatic Project Expense

Project expense should be calculated from relevant records.

Conceptually:

```text
Total Project Expense =
Material Expense
+ Labour Expense
+ Other Expenses
```

Avoid manually maintaining multiple conflicting totals.

Where possible, derive financial summaries from underlying records.

---

# 29. Project Management

Project fields:

```text
Project Name
Client Name
Client Phone
Location
Start Date
Expected End Date
Budget
Status
Description
```

Statuses:

* Planning
* Active
* On Hold
* Completed
* Cancelled

---

# 30. Project Detail Page

The project detail page should become the central management page.

Header:

```text
Patel Residence
Ahmedabad

Active
65% Complete
```

Summary:

```text
Budget             ₹25,00,000
Actual Expense     ₹16,80,000
Remaining          ₹8,20,000
Client Received    ₹20,00,000
Pending            ₹5,00,000
```

Sections:

* Overview
* Sites
* Labour
* Attendance
* Materials
* Expenses
* Client Payments
* Profit/Loss
* Activity

---

# 31. Project Progress

Allow manual progress tracking.

Example:

```text
Overall Progress: 65%
```

Optionally track site progress:

```text
Main Building      75%
Parking             50%
Boundary Wall       90%
```

Use a simple progress bar.

Do not build a complicated project-management/Gantt system unless explicitly required later.

---

# 32. Client Payment Tracking

Record payments received from clients.

Fields:

```text
Project
Client
Date
Amount
Payment Method
Reference
Notes
```

Payment methods:

* Cash
* Bank Transfer
* UPI
* Cheque
* Other

---

# 33. Pending Payment

Project payment summary:

```text
Contract Value       ₹25,00,000
Received             ₹18,00,000
Pending               ₹7,00,000
```

If contract value is represented by project budget, clearly label it accordingly.

Do not assume project budget and contract value are always identical. Ideally keep:

```text
Project Budget
Contract Value
```

as separate concepts if needed.

---

# 34. Profit / Loss

Basic project-level calculation:

```text
Revenue / Contract Value
-
Actual Project Expense
=
Gross Project Profit
```

Display:

```text
Contract Value      ₹25,00,000
Total Expense       ₹17,50,000
Estimated Profit     ₹7,50,000
```

Also show margin where appropriate:

```text
Profit Margin = Profit / Contract Value × 100
```

Clearly label figures as estimated where expenses or revenue are incomplete.

---

# 35. Reports

Reports should be useful rather than decorative.

## Labour Report

* Total labour
* Active labour
* Labour by skill
* Attendance
* Salary payable

## Expense Report

* Expense by project
* Expense by category
* Monthly expense
* Material expense
* Labour expense

## Stock Report

* Current stock
* Low stock
* Purchases
* Consumption

## Project Financial Report

```text
Project
Contract Value
Budget
Actual Expense
Received
Pending
Estimated Profit
```

---

# 36. Search and Filters

Important modules should support useful filtering.

Global or module-specific search:

* Labour name
* Phone
* Project
* Site
* Material
* Expense

Filters:

* Date
* Project
* Site
* Status
* Category

Do not build an unnecessarily complex global search engine.

---

# 37. Local Storage and Context API

The app should use simple client-side caching where useful.

Use React Context API for lightweight application state such as:

* Current user
* Selected project
* UI preferences
* Cached reference data where appropriate
* Sidebar state
* Filters/preferences where appropriate

Use localStorage for non-sensitive client-side state such as:

```text
Selected project
Selected site
Table preferences
UI preferences
Recent filters
Draft form data where useful
```

Do NOT store sensitive authentication credentials or sensitive financial information unnecessarily in localStorage.

The MongoDB database remains the source of truth.

---

# 38. Caching Philosophy

Keep caching simple.

Preferred flow:

```text
Server / API
    ↓
React state / Context
    ↓
localStorage where useful
    ↓
UI
```

When data changes:

```text
Create / Update / Delete
        ↓
API request
        ↓
Database
        ↓
Refresh relevant local state
        ↓
Update UI
```

Do not introduce React Query/TanStack Query unless there is a clear reason to do so.

The goal is understandable code.

---

# 39. API Structure

Keep APIs simple and predictable.

Example:

```text
/api/projects
/api/projects/[id]

/api/sites
/api/sites/[id]

/api/labour
/api/labour/[id]

/api/attendance
/api/attendance/[id]

/api/salary
/api/salary/[id]

/api/materials
/api/materials/[id]

/api/stock
/api/stock/[id]

/api/expenses
/api/expenses/[id]

/api/payments
/api/payments/[id]
```

Use standard HTTP methods:

```text
GET
POST
PUT/PATCH
DELETE
```

Do not create strange action-heavy APIs unless necessary.

---

# 40. Database Models

Suggested models:

```text
User
Project
Site
Labour
LabourAssignment
Attendance
Overtime
Salary
LabourAdvance
Material
StockTransaction
Expense
ClientPayment
```

Keep relationships understandable.

Example:

```text
Project
  ├── Sites
  ├── Labour Assignments
  ├── Expenses
  ├── Stock Transactions
  └── Client Payments
```

---

# 41. Data Integrity

Important rules:

### Attendance

One labour should not accidentally receive duplicate attendance for the same date/site.

### Stock

Consumption should not silently create negative inventory unless explicitly allowed.

### Salary

Salary calculations should use attendance records for the selected period.

### Payments

Client payments must remain linked to a project.

### Expenses

Expenses should remain linked to their project/site where applicable.

---

# 42. Forms

Forms should be clean and easy to use.

Use:

* Clear labels
* Helpful placeholders
* Inline validation
* Required field indicators
* Useful error messages
* Loading state
* Success feedback

Avoid giant forms.

Group related fields.

Example:

```text
Project Information

Project Name
Client Name
Client Phone

Location

Start Date
Expected End Date

Financial

Contract Value
Budget

Status
```

---

# 43. Tables

Tables should be professional and readable.

Use:

* Sticky header where useful
* Proper spacing
* Row hover
* Clear typography
* Status badges
* Right-aligned financial values
* Responsive handling

Do not cram 15 columns into mobile.

On mobile, convert complex tables into:

* Stacked cards
* Horizontal scroll
* Important fields + "View details"

depending on the specific module.

---

# 44. Empty States

Every major module needs a proper empty state.

Example:

```text
No projects yet

Create your first project to start tracking
sites, labour, expenses and payments.

[Create Project]
```

Avoid blank white screens.

---

# 45. Loading States

Use clean skeletons/spinners where necessary.

Do not make loading screens overly animated.

Keep animations subtle.

---

# 46. Error Handling

Show understandable messages.

Bad:

```text
MongoServerError 11000
```

Better:

```text
This labourer's attendance has already been recorded for this date.
```

Log technical details appropriately for development, but show human-readable errors to users.

---

# 47. Notifications

Keep notifications simple.

Examples:

```text
Attendance saved successfully.
Project updated.
Payment recorded.
Material purchase added.
Stock is below minimum level.
```

No need for a complicated notification service.

---

# 48. Responsive Design

The app must work well at:

* Mobile
* Tablet
* Laptop
* Desktop
* Large desktop

Pay special attention to:

* Attendance
* Labour
* Expense entry
* Stock entry
* Project overview

because these may be used on-site.

---

# 49. Accessibility

Implement basic accessibility correctly.

* Proper labels
* Keyboard navigation
* Focus states
* Semantic buttons
* Accessible dialogs
* Sufficient contrast
* Meaningful error messages

Do not rely solely on color for status.

Example:

Instead of only orange/green:

```text
● Paid
● Pending
● Partially Paid
```

---

# 50. UX Principles

The application should follow these principles:

### 1. Don't make users think

If a user wants to mark attendance, it should take seconds.

### 2. Show context

Always make it obvious:

```text
Which project?
Which site?
Which date?
```

### 3. Reduce repeated entry

Remember recent project/site selections when appropriate.

### 4. Don't overload screens

Use tabs and sections where necessary.

### 5. Keep financial information visible

But don't turn every page into a financial dashboard.

### 6. Use sensible defaults

For example:

Attendance date defaults to today.

### 7. Confirm destructive actions

Delete/deactivate actions should require confirmation.

---

# 51. Design System

Create a small reusable design system.

Components should include:

```text
Button
Input
Select
Textarea
DatePicker
Modal
Drawer
Dropdown
Badge
Card
Table
Tabs
ProgressBar
Toast
ConfirmDialog
EmptyState
LoadingSkeleton
PageHeader
StatCard
```

Do not build a giant component framework.

Components should remain understandable.

---

# 52. Color System

Primary:

```text
#FF6321
```

Use it for:

* Primary buttons
* Active navigation
* Important links
* Progress highlights
* Key actions

Supporting colors should be neutral and restrained.

Suggested conceptual palette:

```text
Background: very light neutral
Surface: white
Text: dark charcoal
Secondary text: muted gray
Border: light gray
Primary: #FF6321
Success: restrained green
Warning: amber
Danger: restrained red
```

Do not use orange everywhere.

---

# 53. Icons

Use a clean icon library such as Lucide.

Icons should support the UI rather than dominate it.

Avoid:

* Giant decorative icons
* Emoji-based UI
* Random icon styles

---

# 54. Charts

Use charts only when they communicate something useful.

Possible charts:

### Project Expenses

Monthly expense trend.

### Budget vs Actual

Simple comparison.

### Payment Summary

Received vs pending.

### Expense Breakdown

Material vs labour vs other.

Do not create charts just because the dashboard "needs charts."

---

# 55. Project Dashboard Example

A project page could look approximately like:

```text
---------------------------------------------------------
Patel Residence                         [Edit Project]
Ahmedabad
Active · 65% Complete

Budget        ₹25.0L
Expenses      ₹16.8L
Received      ₹20.0L
Pending        ₹5.0L
---------------------------------------------------------

[Overview] [Sites] [Labour] [Materials] [Expenses]
[Payments] [Profit & Loss]

Overview

Progress
████████████████░░░░ 65%

Budget vs Expense

Budget          ₹25,00,000
Actual          ₹16,80,000
Remaining        ₹8,20,000

Recent Activity

18 Sep  Attendance recorded
18 Sep  Cement purchase ₹12,000
17 Sep  Client payment ₹50,000
```

---

# 56. Main Navigation

Recommended:

```text
Dashboard

Projects

Sites

Labour
  ├── All Labour
  ├── Attendance
  ├── Overtime
  └── Salary

Inventory
  ├── Materials
  ├── Stock
  └── Purchases

Finance
  ├── Expenses
  ├── Client Payments
  └── Reports

Settings
```

Avoid having 15 top-level sidebar items.

Group related functionality.

---

# 57. Project-Centric Workflow

The overall application should feel project-centric.

Typical user flow:

```text
Create Project
      ↓
Create Sites
      ↓
Register Labour
      ↓
Assign Labour to Sites
      ↓
Record Attendance
      ↓
Calculate Salary
      ↓
Record Material Purchases
      ↓
Record Material Consumption
      ↓
Record Expenses
      ↓
Record Client Payments
      ↓
Monitor Project Progress
      ↓
Review Profit/Loss
```

The UI should support this natural workflow.

---

# 58. Example Day-to-Day Workflow

A site supervisor opens the app in the morning.

Dashboard:

```text
Today's Attendance

Main Building
12 Labour

[Mark Attendance]
```

They click it.

```text
Ramesh      Present
Suresh      Present
Mahesh      Absent
Raj         Half Day
```

Save.

Later:

```text
Material Used

Cement
15 Bags

Steel
120 Kg
```

At the end of the day:

```text
Overtime

Ramesh
2 hours
```

The system updates relevant salary calculations.

The project manager can then see:

```text
Today's Labour Cost
Today's Material Cost
Total Project Expense
```

without manually calculating everything.

---

# 59. Code Quality Requirements

The code must be written for a developer who will take ownership of it afterward.

Prioritize:

* Readability
* Simple functions
* Clear naming
* Small reusable components
* Explicit types
* Simple data flow
* Minimal abstraction
* Useful comments
* Predictable folder structure

Avoid:

* Clever one-liners
* Extremely generic components
* Over-abstraction
* Massive utility files
* Magic constants everywhere
* Deeply nested providers
* Unnecessary design patterns
* Complex state machines
* Premature optimization

---

# 60. Suggested Folder Structure

Use a structure along these lines:

```text
src/
  app/
    dashboard/
    projects/
    sites/
    labour/
    attendance/
    salary/
    inventory/
    expenses/
    payments/
    reports/
    settings/

    api/
      projects/
      sites/
      labour/
      attendance/
      salary/
      materials/
      stock/
      expenses/
      payments/

  components/
    ui/
    layout/
    dashboard/
    projects/
    labour/
    attendance/
    inventory/
    finance/

  context/
    AuthContext.tsx
    ProjectContext.tsx
    AppContext.tsx

  lib/
    mongodb.ts
    utils.ts
    calculations.ts
    validation.ts

  models/
    User.ts
    Project.ts
    Site.ts
    Labour.ts
    Attendance.ts
    Salary.ts
    Material.ts
    StockTransaction.ts
    Expense.ts
    ClientPayment.ts

  types/
    project.ts
    labour.ts
    attendance.ts
    finance.ts
    inventory.ts
```

The exact structure can be adjusted if the framework requires it, but keep the underlying idea.

---

# 61. Calculation Utilities

Keep business calculations in clear utility functions.

For example:

```text
calculateLabourSalary()
calculateOvertimeAmount()
calculateNetSalary()
calculateStockBalance()
calculateProjectExpense()
calculatePendingPayment()
calculateProjectProfit()
```

This is preferable to duplicating financial formulas throughout components.

---

# 62. Important Financial Principle

Do not make the UI responsible for permanently calculating and storing every total.

For example, avoid:

```text
Project.totalExpense
Project.totalProfit
Project.pendingPayment
```

being manually changed from five different screens without a clear source of truth.

Instead, calculate summaries from relevant records where practical.

For performance, simple cached/derived values can be introduced later if actually needed.

---

# 63. Seed Data

Provide useful development seed data.

Example:

```text
3 Projects
5 Sites
15 Labourers
Several attendance records
Several salary records
10 Materials
Stock transactions
Expenses
Client payments
```

This should make the dashboard look realistic during development.

Do not use lorem ipsum.

Use realistic construction/business data.

---

# 64. Sample Project

Example:

```text
Project:
Patel Residence

Client:
Rajesh Patel

Location:
Ahmedabad

Contract Value:
₹25,00,000

Budget:
₹22,00,000

Start:
01 Aug 2026

Expected Completion:
30 Nov 2026
```

Sites:

```text
Main Building
Parking
Boundary Wall
```

---

# 65. Security Basics

Even though this is a relatively simple application:

* Validate API input
* Validate IDs
* Protect authenticated routes
* Do not expose database credentials
* Use environment variables
* Never commit `.env`
* Sanitize/validate user input
* Do not store passwords in plaintext
* Do not put secrets in localStorage

---

# 66. Environment Variables

Use:

```text
MONGODB_URI=
AUTH_SECRET=
```

Keep environment configuration simple.

Provide:

```text
.env.example
```

---

# 67. Documentation

Include a clean README containing:

```text
Project overview

Tech stack

Requirements

Installation

Environment variables

MongoDB setup

Development

Production build

Database seed

Project structure
```

Also explain major business calculations.

---

# 68. Development Philosophy

This is NOT intended to be an enterprise-scale distributed system.

The goal is:

> "A well-built, professional application that one developer can understand, maintain, modify and extend."

Therefore:

**Prefer**

```text
Simple
Readable
Explicit
Maintainable
Practical
```

over:

```text
Highly abstract
Highly distributed
Highly optimized
Over-engineered
```

---

# 69. Ownership / Maintainability Requirement

The generated application should intentionally remain easy to modify.

A future developer should be able to answer quickly:

* Where is labour stored?
* Where is attendance calculated?
* Where is salary calculated?
* Where is stock updated?
* Where are project expenses calculated?
* Where is client payment stored?
* Where is the dashboard data coming from?

Avoid hiding core business logic behind excessive abstraction.

Business logic should be easy to locate.

---

# 70. Final UI Requirement

The final product should feel like a **serious construction management application**.

Think:

```text
Professional
Calm
Clean
Structured
Fast
Practical
Business-focused
```

Not:

```text
AI-generated dashboard
Colorful SaaS template
Over-designed startup landing page
Glassmorphism
Huge cards
Excessive gradients
Excessive rounded corners
```

The `#FF6321` orange should act as the brand accent, not as the entire visual identity.

Use whitespace intelligently.

Use borders to establish structure.

Use typography to establish hierarchy.

Use cards only when they provide meaningful grouping.

Tables should feel like actual business software.

Forms should feel fast.

Financial figures should be easy to scan.

Mobile should feel intentionally designed rather than merely responsive.

---

# 71. Definition of Done

The initial implementation is considered complete when:

* Authentication works
* Dashboard works
* Projects can be created/edited
* Sites can be created and linked to projects
* Labour can be registered
* Labour can be assigned to sites
* Attendance can be recorded
* Overtime can be recorded
* Salary can be calculated
* Labour advances can be recorded
* Materials can be created
* Purchases can be recorded
* Material consumption can be recorded
* Low-stock states work
* Expenses can be recorded
* Client payments can be recorded
* Project financial summaries work
* Profit/Loss calculation works
* Reports are available
* Data persists in MongoDB
* Useful client state persists through localStorage where appropriate
* UI is responsive
* Loading/empty/error states exist
* Forms have validation
* No major TypeScript errors
* No unnecessary dependencies
* README is complete
* `.env.example` exists
* Seed data exists
* Code is clean and understandable

---

# 72. Most Important Instruction

Build the application as if another developer will inherit the repository tomorrow.

Every implementation decision should favor:

**clarity > cleverness**

**maintainability > abstraction**

**simple architecture > unnecessary infrastructure**

**real usability > decorative UI**

**consistent design > excessive customization**

**business workflow > technical complexity**

The result should be a strong, production-quality foundation that can later be significantly customized without fighting against the generated codebase.

