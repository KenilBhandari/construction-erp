import { z } from "zod";
import { Types } from "mongoose";

/** Mongo ObjectId string validation for API routes. */
export const objectIdSchema = z
  .string()
  .refine((val) => Types.ObjectId.isValid(val), {
    message: "Invalid id",
  });

/**
 * Common pagination query parsing: ?page=1&limit=20
 *
 * `searchParams.get()` returns null when a param is absent, and
 * `z.coerce.number()` turns null into 0 (failing min(1)) while `.default()`
 * only covers undefined — so missing params must map to undefined first.
 */
const nullToUndefined = (v: unknown) =>
  v === null || v === undefined || v === "" ? undefined : v;

export const paginationSchema = z.object({
  page: z.preprocess(
    nullToUndefined,
    z.coerce.number().int().min(1).default(1),
  ),
  limit: z.preprocess(
    nullToUndefined,
    z.coerce.number().int().min(1).max(100).default(20),
  ),
});

/** Friendly error message for forms (never leak Mongo errors to UI). */
export function toUserErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Please check the form and try again.";
  }
  if (error instanceof Error) {
    // Duplicate key (e.g. attendance already recorded)
    if (error.message.includes("E11000")) {
      return "This record already exists.";
    }
    return error.message;
  }
  return "Something went wrong. Please try again.";
}
