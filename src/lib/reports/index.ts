/**
 * Reporting layer — consumes canonical domain calculations, never duplicates them.
 * See definitions.ts for the locked formula meanings.
 */
export * from "@/lib/reports/scope";
export { REPORT_DEFINITIONS } from "@/lib/reports/definitions";
export * from "@/lib/reports/salary";
export * from "@/lib/reports/records";
export * from "@/lib/reports/labour-runner";
export * from "@/lib/reports/material-runner";
export * from "@/lib/reports/expense-runner";
export * from "@/lib/reports/pdf";
