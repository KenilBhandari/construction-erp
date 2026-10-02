"use server";

import { signIn } from "@/lib/auth";

/**
 * Google sign-in action, kept in its own module so it can be imported from
 * Client Components (like the landing page). Inline `"use server"` actions
 * are only allowed in Server Components.
 */
export async function signInWithGoogle(): Promise<void> {
  await signIn("google", { redirectTo: "/dashboard" });
}
