import { z } from "zod";
import { objectIdSchema } from "@/lib/validation";
import { PROJECT_STATUSES } from "@/types/project";
import { SITE_STATUSES } from "@/types/site";
import { LABOUR_STATUSES } from "@/types/labour";
import { ATTENDANCE_STATUSES } from "@/types/attendance";
import { STOCK_UNITS, TRANSACTION_TYPES } from "@/types/inventory";
import { EXPENSE_CATEGORIES, EXPENSE_TYPES, PAYMENT_METHODS } from "@/types/finance";

const optionalDate = z.coerce.date().nullish();
const optionalText = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform((v: string | null | undefined) => (v === "" ? null : (v ?? null)));

export const projectCreateSchema = z.object({
  name: z.string().trim().min(2, "Project name is required.").max(120),
  clientName: z.string().trim().min(2, "Client name is required.").max(120),
  clientPhone: optionalText,
  location: z.string().trim().min(2, "Location is required.").max(200),
  startDate: optionalDate,
  expectedEndDate: optionalDate,
  budget: z.coerce.number().min(0, "Budget must be 0 or more."),
  contractValue: z.coerce.number().min(0, "Contract value must be 0 or more."),
  status: z.enum(PROJECT_STATUSES).default("active"),
  progress: z.coerce.number().min(0).max(100).default(0),
  description: optionalText,
});

export const projectUpdateSchema = projectCreateSchema.partial();

export const siteCreateSchema = z.object({
  name: z.string().trim().min(2, "Site name is required.").max(120),
  project: objectIdSchema,
  location: optionalText,
  supervisor: optionalText,
  startDate: optionalDate,
  expectedEndDate: optionalDate,
  status: z.enum(SITE_STATUSES).default("active"),
  progress: z.coerce.number().min(0).max(100).default(0),
  notes: optionalText,
});

export const siteUpdateSchema = siteCreateSchema.partial().omit({ project: true }).extend({
  project: objectIdSchema.optional(),
});

export const labourCreateSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(120),
  phone: z.string().trim().min(6, "Phone looks too short.").max(15),
  photo: optionalText,
  skill: z.string().trim().min(2, "Skill is required.").max(60),
  dailyRate: z.coerce.number().min(0, "Daily rate must be 0 or more."),
  hourlyRate: z.coerce.number().min(0, "Hourly rate must be 0 or more."),
  joiningDate: optionalDate,
  status: z.enum(LABOUR_STATUSES).default("active"),
  assignedSite: objectIdSchema.nullish(),
  notes: optionalText,
});

export const labourUpdateSchema = labourCreateSchema.partial();

export const assignmentCreateSchema = z.object({
  labour: objectIdSchema,
  site: objectIdSchema,
  from: optionalDate,
  notes: optionalText,
});

const dayString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-mm-dd.")
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()), {
    message: "Invalid date.",
  });

const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM.")
  .nullish()
  .transform((v) => v ?? null);

export const attendanceBulkSchema = z.object({
  date: dayString,
  site: objectIdSchema,
  records: z
    .array(
      z.object({
        labour: objectIdSchema,
        status: z.enum(ATTENDANCE_STATUSES),
        checkIn: timeString,
        checkOut: timeString,
        overtimeHours: z.coerce.number().min(0).default(0),
        notes: optionalText,
      }),
    )
    .min(1, "Add at least one record.")
    .max(500, "Too many records at once."),
});

export const attendanceUpdateSchema = z.object({
  status: z.enum(ATTENDANCE_STATUSES).optional(),
  checkIn: timeString.optional(),
  checkOut: timeString.optional(),
  overtimeHours: z.coerce.number().min(0).optional(),
  notes: optionalText.optional(),
});

export const overtimeCreateSchema = z.object({
  labour: objectIdSchema,
  site: objectIdSchema,
  date: dayString,
  hours: z.coerce.number().min(0.1, "Hours must be more than 0.").max(24),
  rate: z.coerce.number().min(0).nullish(),
  notes: optionalText,
});

export const overtimeUpdateSchema = z.object({
  hours: z.coerce.number().min(0.1).max(24).optional(),
  rate: z.coerce.number().min(0).optional(),
  notes: optionalText.optional(),
});

export const salaryComputeSchema = z.object({
  labour: objectIdSchema,
  site: objectIdSchema.nullish(),
  project: objectIdSchema.nullish(),
  periodStart: dayString,
  periodEnd: dayString,
  // Canonical explicit recovery for this settlement; 0 = no recovery this period.
  advanceRecovery: z.coerce.number().min(0).default(0),
  notes: optionalText,
});

export const salaryUpdateSchema = z.object({
  site: objectIdSchema.nullish().optional(),
  project: objectIdSchema.nullish().optional(),
  advanceRecovery: z.coerce.number().min(0).optional(),
  // Legacy alias — accepted but mapped to advanceRecovery; do not diverge.
  advances: z.coerce.number().min(0).optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  deductions: z.coerce.number().min(0).optional(),
  paymentMethod: z.string().trim().max(30).nullish().optional(),
  paymentReference: optionalText.optional(),
  notes: optionalText.optional(),
});

export const advanceCreateSchema = z.object({
  labour: objectIdSchema,
  site: objectIdSchema.nullish(),
  project: objectIdSchema.nullish(),
  date: dayString,
  amount: z.coerce.number().min(1, "Amount must be at least ₹1."),
  reason: optionalText,
  paymentMethod: z.enum(PAYMENT_METHODS).nullish(),
  reference: optionalText,
  notes: optionalText,
});

export const advanceUpdateSchema = z.object({
  date: dayString.optional(),
  amount: z.coerce.number().min(1).optional(),
  reason: optionalText.optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullish().optional(),
  reference: optionalText.optional(),
  notes: optionalText.optional(),
  site: objectIdSchema.nullish(),
  project: objectIdSchema.nullish(),
});

export const materialCreateSchema = z.object({
  name: z.string().trim().min(2, "Material name is required.").max(120),
  category: z.string().trim().min(2, "Category is required.").max(60),
  unit: z.enum(STOCK_UNITS),
  minimumStock: z.coerce.number().min(0).default(0),
  defaultPurchaseRate: z.coerce.number().min(0).default(0),
  openingStock: z.coerce.number().min(0).default(0),
  notes: optionalText,
});

export const materialUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  category: z.string().trim().min(2).max(60).optional(),
  unit: z.enum(STOCK_UNITS).optional(),
  minimumStock: z.coerce.number().min(0).optional(),
  defaultPurchaseRate: z.coerce.number().min(0).optional(),
  notes: optionalText.optional(),
});

const stockBaseSchema = z.object({
  material: objectIdSchema,
  site: objectIdSchema.nullish(),
  date: dayString,
  type: z.enum(TRANSACTION_TYPES),
  quantity: z.coerce.number(),
  rate: z.coerce.number().min(0).nullish(),
  supplier: optionalText,
  invoiceNumber: optionalText,
  purpose: optionalText,
  notes: optionalText,
});

export const stockCreateSchema = stockBaseSchema.superRefine((v, ctx) => {
  if (v.type === "adjustment") {
    if (v.quantity === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Adjustment quantity cannot be zero (use + or −)." });
    }
    if (!v.notes) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Adjustments need a reason in notes." });
    }
  } else if (v.quantity <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Quantity must be more than 0." });
  }
  if ((v.type === "purchase" || v.type === "consumption") && !v.site) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Site is required for purchases and consumption." });
  }
});

/** Material/site/type never change on edit — quantities and details only. */
export const stockUpdateSchema = z.object({
  quantity: z.coerce.number().optional(),
  rate: z.coerce.number().min(0).optional(),
  date: dayString.optional(),
  supplier: optionalText.optional(),
  invoiceNumber: optionalText.optional(),
  purpose: optionalText.optional(),
  notes: optionalText.optional(),
});

export const expenseCreateSchema = z.object({
  project: objectIdSchema.nullish(),
  site: objectIdSchema.nullish(),
  date: dayString,
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().trim().min(2, "Description is required.").max(300),
  amount: z.coerce.number().min(1, "Amount must be at least ₹1."),
  vendor: optionalText,
  paymentMethod: z.enum(PAYMENT_METHODS).default("Cash"),
  reference: optionalText,
  notes: optionalText,
  expenseType: z.enum(EXPENSE_TYPES).nullish(),
  labour: objectIdSchema.nullish(),
  labourAdvance: objectIdSchema.nullish(),
});

export const expenseUpdateSchema = expenseCreateSchema.partial();

export const paymentCreateSchema = z.object({
  project: objectIdSchema,
  date: dayString,
  amount: z.coerce.number().min(1, "Amount must be at least ₹1."),
  paymentMethod: z.enum(PAYMENT_METHODS).default("Cash"),
  reference: optionalText,
  notes: optionalText,
});

export const paymentUpdateSchema = paymentCreateSchema.partial().omit({ project: true });
