import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { toUserErrorMessage } from "@/lib/validation";

/** Require Google session for API routes. Returns session or a 401 response. */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  }
  return { session, error: null };
}

export function ok<T>(data: T, init?: { status?: number }) {
  return NextResponse.json(data, { status: init?.status ?? 200 });
}

export function fail(error: unknown, status = 400) {
  return NextResponse.json({ error: toUserErrorMessage(error) }, { status });
}

export function idempotencyKeyFrom(req: Request): string | null {
  const h = req.headers.get("x-idempotency-key") ?? req.headers.get("X-Idempotency-Key");
  if (!h) return null;
  const v = h.trim();
  return v.length ? v.slice(0, 128) : null;
}
